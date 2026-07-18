import type {
  AgentSession,
  AgentSessionEvent,
  ExtensionUIContext,
  ModelRegistry,
  ModelRuntime,
  SessionManager,
  ToolDefinition,
} from "@earendil-works/pi-coding-agent"
import type {
  AgentMessage,
  AgentMessagePart,
  AgentProvider,
  AgentProviderData,
  AgentQuestionInfo,
  AgentQuestionRequest,
  AgentRuntimeInfo,
  AgentSessionInfo,
  AgentSessionSummary,
  AgentThinkingLevel,
  AgentTreeNode as BridgeAgentTreeNode,
} from "@dilag/desktop-bridge"
import fsp from "node:fs/promises"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { Type } from "typebox"
import { CHANNELS } from "../shared/channels.js"
import { renderDilagSystemPrompt, syncDilagDesignSkills } from "./design-skill-pack.js"
import { getDilagSkillsDir, getPiAgentDir, getPiSessionDir } from "./paths.js"

type EventSender = (channel: string, event: unknown) => void

type PiTextContent = { type: "text"; text: string }
type PiThinkingContent = { type: "thinking"; text?: string; thinking?: string }
type PiImageContent = { type: "image"; data: string; mimeType: string }
type PiToolCall = { type: "toolCall"; id: string; name: string; arguments: Record<string, unknown> }
type PiContent = string | Array<PiTextContent | PiThinkingContent | PiImageContent | PiToolCall>
type PiMessage = {
  role: "user" | "assistant" | "toolResult" | "custom"
  content?: PiContent
  timestamp?: number
  provider?: string
  model?: string
  toolCallId?: string
  toolName?: string
  isError?: boolean
  errorMessage?: string
  stopReason?: string
  details?: unknown
}

type RequestedAgentModel = { providerID: string; modelID: string }
type AgentToolState = {
  status: "pending" | "running" | "completed" | "error"
  input?: unknown
  output?: string
  error?: string
  metadata?: Record<string, unknown>
  time?: { start?: number; end?: number }
}
type PiMessagePhase = "start" | "update" | "end"

type RuntimeSession = {
  id: string
  cwd: string
  session: AgentSession
  unsubscribe: () => void
  lastUsedAt: number
  activeMessageId?: string
  toolInputs: Map<string, unknown>
  toolMessageIds: Map<string, string>
  toolStates: Map<string, AgentToolState>
  changedFiles: Map<string, { file: string; additions: number; deletions: number }>
  terminalError?: string
}

type PendingQuestion = {
  request: AgentQuestionRequest
  resolve: (answers: string[][]) => void
  reject: () => void
}

type PiSessionTreeNode = {
  entry: {
    id: string
    parentId: string | null
    type: string
    timestamp: string
    message?: PiMessage
    summary?: string
  }
  children: PiSessionTreeNode[]
  label?: string
}

const sessions = new Map<string, RuntimeSession>()
const pendingQuestions = new Map<string, PendingQuestion>()
// Live Pi runtime sessions are memory- and event-heavy; keep only the most
// recently used idle ones resident. Streaming or question-blocked sessions are
// never evicted (they are transparently re-opened from disk on next access).
const MAX_IDLE_RUNTIME_SESSIONS = 3
const OAUTH_PROVIDER_IDS = new Set(["openai-codex", "github-copilot"])
const STALE_DEFAULT_MODELS = new Set(["google/gemini-1.5-flash"])
const PREFERRED_DEFAULT_MODELS = [
  "opencode-go/kimi-k2.6",
  "google/gemini-2.5-flash",
  "google/gemini-2.5-pro",
]
const DEBUG_PI_SMOKE = process.env.DILAG_DEBUG_PI === "1"

let eventSender: EventSender | undefined
let piModulePromise: Promise<typeof import("@earendil-works/pi-coding-agent")> | undefined
let modelRuntimePromise: Promise<ModelRuntime> | undefined

function loadPi() {
  piModulePromise ??= import("@earendil-works/pi-coding-agent")
  return piModulePromise
}

export function setAgentEventSender(sender: EventSender) {
  eventSender = sender
}

export async function getAgentRuntimeInfo(): Promise<AgentRuntimeInfo> {
  const agentDir = getPiAgentDir()
  await fsp.mkdir(agentDir, { recursive: true })
  return {
    running: sessions.size > 0,
    agentDir,
    sessionCount: sessions.size,
  }
}

export async function startAgentRuntime(): Promise<AgentRuntimeInfo> {
  await fsp.mkdir(getPiAgentDir(), { recursive: true })
  return getAgentRuntimeInfo()
}

export async function stopAgentRuntime(): Promise<void> {
  await Promise.all(
    Array.from(sessions.values()).map(async (runtime) => {
      runtime.unsubscribe()
      runtime.session.clearQueue()
      await runtime.session.abort().catch(() => undefined)
      runtime.session.dispose()
    }),
  )
  sessions.clear()
  rejectAllPendingQuestions()
}

export async function restartAgentRuntime(): Promise<AgentRuntimeInfo> {
  await stopAgentRuntime()
  return startAgentRuntime()
}

export function isAgentRuntimeRunning(): boolean {
  return sessions.size > 0
}

export async function getAgentProviderData(): Promise<AgentProviderData> {
  const registry = await createModelRegistry()
  const models = registry.getAvailable().map((model) => ({
    id: model.id,
    name: model.name.replace(/\s*\(latest\)\s*/i, "").trim(),
    providerID: model.provider,
    providerName: model.provider,
    cost: model.cost,
    contextWindow: model.contextWindow,
    maxTokens: model.maxTokens,
    variants: getThinkingLevelVariants(model),
  }))
  const connectedProviders = [...new Set(models.map((model) => model.providerID))]
  const defaultModel = chooseDefaultModel(models)
  return {
    models,
    connectedProviders,
    defaultModel: defaultModel
      ? { providerID: defaultModel.providerID, modelID: defaultModel.id }
      : null,
  }
}

function getThinkingLevelVariants(model: {
  reasoning?: boolean
  thinkingLevelMap?: Partial<Record<AgentThinkingLevel, string | null>>
}) {
  const available = getSupportedThinkingLevels(model)
  if (available.length === 0) return undefined
  return Object.fromEntries(available.map((level) => [level, {}])) as Record<
    AgentThinkingLevel,
    Record<string, unknown>
  >
}

function getSupportedThinkingLevels(model?: {
  reasoning?: boolean
  thinkingLevelMap?: Partial<Record<AgentThinkingLevel, string | null>>
}): AgentThinkingLevel[] {
  if (!model?.reasoning) return []
  const levels: AgentThinkingLevel[] = ["off", "minimal", "low", "medium", "high", "xhigh", "max"]
  if (!model.thinkingLevelMap) return ["off", "low", "medium", "high"]
  return levels.filter((level) => {
    const mapped = model.thinkingLevelMap?.[level]
    if (mapped === null) return false
    if (level === "xhigh" || level === "max") return mapped !== undefined
    return true
  })
}

function getSupportedThinkingLevel(
  model:
    | { reasoning?: boolean; thinkingLevelMap?: Partial<Record<AgentThinkingLevel, string | null>> }
    | undefined,
  thinkingLevel: AgentThinkingLevel | undefined,
): AgentThinkingLevel | undefined {
  const supportedLevels = getSupportedThinkingLevels(model)
  if (supportedLevels.length === 0) return undefined
  if (thinkingLevel && supportedLevels.includes(thinkingLevel)) return thinkingLevel
  return supportedLevels.includes("low")
    ? "low"
    : (supportedLevels.find((level) => level !== "off") ?? supportedLevels[0])
}

function modelKey(model: { providerID?: string; provider?: string; id: string }): string {
  return `${model.providerID ?? model.provider}/${model.id}`
}

function chooseDefaultModel<T extends { providerID?: string; provider?: string; id: string }>(
  models: T[],
): T | undefined {
  for (const preferred of PREFERRED_DEFAULT_MODELS) {
    const model = models.find((candidate) => modelKey(candidate) === preferred)
    if (model) return model
  }
  return models.find((model) => !STALE_DEFAULT_MODELS.has(modelKey(model))) ?? models[0]
}

export async function listAgentProviders(): Promise<AgentProvider[]> {
  const registry = await createModelRegistry()
  const availableProviders = new Set(registry.getAvailable().map((model) => model.provider))
  const providerCounts = new Map<string, number>()
  for (const model of registry.getAll()) {
    providerCounts.set(model.provider, (providerCounts.get(model.provider) ?? 0) + 1)
  }
  return Array.from(providerCounts.entries())
    .map(([id, modelCount]) => ({
      id,
      name: humanizeProviderName(id),
      connected: availableProviders.has(id),
      modelCount,
      authType: OAUTH_PROVIDER_IDS.has(id) ? ("oauth" as const) : ("api-key" as const),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function setAgentApiKey(args: { providerID: string; apiKey: string }): Promise<void> {
  const modelRuntime = await createModelRuntime()
  await modelRuntime.login(args.providerID, "api_key", {
    notify: () => undefined,
    prompt: async (prompt) =>
      prompt.type === "select" && prompt.options[0] ? prompt.options[0].id : args.apiKey,
  })
}

export async function loginAgentOAuthProvider(
  args: { providerID: string },
  openExternal: (url: string) => Promise<void>,
): Promise<void> {
  const modelRuntime = await createModelRuntime()
  await modelRuntime.login(args.providerID, "oauth", {
    notify: (event) => {
      if (event.type === "auth_url") {
        void openExternal(event.url)
      } else if (event.type === "device_code") {
        void openExternal(event.verificationUri)
      } else {
        console.log(`[pi oauth:${args.providerID}] ${event.message}`)
      }
    },
    prompt: async (prompt) => {
      if (prompt.type === "select" && prompt.options[0]) return prompt.options[0].id
      throw new Error("Browser OAuth callback did not complete. Please try again.")
    },
  })
}

export async function createAgentSessionForDirectory(args: {
  directory: string
}): Promise<AgentSessionInfo> {
  const runtime = await createRuntimeSession(args.directory)
  return toAgentSessionInfo(runtime)
}

export async function listAgentSessions(args: {
  directory: string
}): Promise<AgentSessionSummary[]> {
  const pi = await loadPi()
  const infos = await pi.SessionManager.list(args.directory, getPiSessionDir(args.directory))
  return infos.map((info) => ({
    id: info.id,
    cwd: info.cwd || args.directory,
    name: info.name,
    created_at: info.created.toISOString(),
    updated_at: info.modified.toISOString(),
    message_count: info.messageCount,
    first_message: info.firstMessage,
  }))
}

export async function getAgentSession(args: {
  sessionID: string
  directory: string
}): Promise<AgentSessionInfo> {
  const runtime = await ensureRuntimeSession(args.sessionID, args.directory)
  return toAgentSessionInfo(runtime)
}

export async function getAgentMessages(args: {
  sessionID: string
  directory: string
}): Promise<AgentMessage[]> {
  const runtime = await ensureRuntimeSession(args.sessionID, args.directory)
  const entries = runtime.session.sessionManager.getEntries() as PiSessionEntry[]
  const toolStates = toolStatesFromEntries(entries)
  return entries
    .filter((entry) => entry.type === "message")
    .flatMap((entry) => messageEntryToBridgeMessages(entry, runtime.id, toolStates))
}

export async function promptAgentSession(args: {
  sessionID: string
  directory: string
  text: string
  images?: Array<{ type: "image"; data: string; mimeType: string }>
  model?: RequestedAgentModel | null
  thinkingLevel?: AgentThinkingLevel
  streamingBehavior?: "steer" | "followUp"
}): Promise<void> {
  const runtime = await ensureRuntimeSession(
    args.sessionID,
    args.directory,
    args.model,
    args.thinkingLevel,
  )
  runtime.terminalError = undefined
  emitSessionStatus(runtime.id, "running")
  debugPiSmoke("prompt.start", {
    sessionID: runtime.id,
    cwd: runtime.cwd,
    model: runtime.session.model
      ? `${runtime.session.model.provider}/${runtime.session.model.id}`
      : null,
  })

  await new Promise<void>((resolve, reject) => {
    let accepted = false
    let settled = false

    const resolveOnce = () => {
      if (settled) return
      settled = true
      resolve()
    }

    const rejectOnce = (error: unknown) => {
      if (settled) return
      settled = true
      reject(error)
    }

    void runtime.session
      .prompt(args.text, {
        images: args.images,
        streamingBehavior: args.streamingBehavior,
        preflightResult: (success) => {
          debugPiSmoke("prompt.preflight", { sessionID: runtime.id, success })
          if (!success) return
          accepted = true
          resolveOnce()
        },
      })
      .then(() => {
        debugPiSmoke("prompt.resolved", { sessionID: runtime.id, accepted })
        if (!accepted) resolveOnce()
      })
      .catch((error: unknown) => {
        debugPiSmoke("prompt.rejected", {
          sessionID: runtime.id,
          error: error instanceof Error ? error.message : String(error),
        })
        emitSessionError(runtime.id, error)
        rejectOnce(error)
      })
  })
}

export async function abortAgentSession(args: { sessionID: string }): Promise<void> {
  const runtime = getRuntimeSession(args.sessionID)
  runtime.session.clearQueue()
  await runtime.session.abort()
  emitSessionIdle(runtime.id)
}

export async function clearAgentPromptQueue(args: {
  sessionID: string
}): Promise<{ sessionID: string; steering: string[]; followUp: string[] }> {
  const runtime = getRuntimeSession(args.sessionID)
  const queue = runtime.session.clearQueue()
  return {
    sessionID: runtime.id,
    steering: queue.steering,
    followUp: queue.followUp,
  }
}

export async function renameAgentSession(args: {
  sessionID: string
  name: string
  directory?: string
}): Promise<void> {
  const runtime = args.directory
    ? await ensureRuntimeSession(args.sessionID, args.directory)
    : getRuntimeSession(args.sessionID)
  runtime.session.setSessionName(args.name)
}

export async function deleteAgentSession(args: {
  sessionID: string
  directory?: string
}): Promise<void> {
  const runtime = sessions.get(args.sessionID)
  if (runtime) {
    runtime.unsubscribe()
    await runtime.session.abort().catch(() => undefined)
    const sessionFile = runtime.session.sessionFile
    if (sessionFile) {
      await fsp.rm(sessionFile, { force: true })
    }
    sessions.delete(args.sessionID)
    clearQuestionsForSession(args.sessionID)
    return
  }

  if (args.directory) {
    const sessionFile = await findSessionFile(args.directory, args.sessionID)
    if (sessionFile) await fsp.rm(sessionFile, { force: true })
  }
  clearQuestionsForSession(args.sessionID)
}

export function listAgentQuestions(): AgentQuestionRequest[] {
  return Array.from(pendingQuestions.values()).map((pending) => pending.request)
}

export function replyAgentQuestion(args: { requestID: string; answers: string[][] }): void {
  const pending = pendingQuestions.get(args.requestID)
  if (!pending) return
  pendingQuestions.delete(args.requestID)
  pending.resolve(args.answers)
  emitAgentEvent({
    type: "question.replied",
    properties: {
      sessionID: pending.request.sessionID,
      requestID: args.requestID,
      answers: args.answers,
    },
  })
}

export function rejectAgentQuestion(args: { requestID: string }): void {
  const pending = pendingQuestions.get(args.requestID)
  if (!pending) return
  pendingQuestions.delete(args.requestID)
  pending.reject()
  emitAgentEvent({
    type: "question.rejected",
    properties: {
      sessionID: pending.request.sessionID,
      requestID: args.requestID,
    },
  })
}

export function getAgentTree(args: { sessionID: string }): BridgeAgentTreeNode[] {
  const runtime = getRuntimeSession(args.sessionID)
  return runtime.session.sessionManager
    .getTree()
    .map((node) => mapTreeNode(node as PiSessionTreeNode))
}

export async function forkAgentSession(args: {
  sessionID: string
  targetId: string
}): Promise<AgentSessionInfo> {
  const sourceRuntime = getRuntimeSession(args.sessionID)
  const targetId = resolveTreeTargetId(sourceRuntime, args.targetId)
  const sessionFile = sourceRuntime.session.sessionManager.createBranchedSession(targetId)
  if (!sessionFile) throw new Error("Unable to fork unsaved session.")

  const pi = await loadPi()
  const sessionManager = pi.SessionManager.open(
    sessionFile,
    getPiSessionDir(sourceRuntime.cwd),
    sourceRuntime.cwd,
  )
  const { session } = await createPiSession(sourceRuntime.cwd, sessionManager)
  const runtime = bindRuntimeSession(session, sourceRuntime.cwd)
  sessions.set(runtime.id, runtime)
  return toAgentSessionInfo(runtime)
}

export async function navigateAgentTree(args: {
  sessionID: string
  targetId: string
  summarize?: boolean
  customInstructions?: string
  replaceInstructions?: boolean
  label?: string
}): Promise<{ editorText?: string; cancelled: boolean; aborted?: boolean }> {
  const runtime = getRuntimeSession(args.sessionID)
  const targetId = resolveTreeTargetId(runtime, args.targetId)
  const result = await runtime.session.navigateTree(targetId, {
    summarize: args.summarize,
    customInstructions: args.customInstructions,
    replaceInstructions: args.replaceInstructions,
    label: args.label,
  })
  emitAgentEvent({
    type: "session.updated",
    properties: { info: { id: runtime.id, title: runtime.session.sessionName } },
  })
  return {
    editorText: result.editorText,
    cancelled: result.cancelled,
    aborted: result.aborted,
  }
}

function resolveTreeTargetId(runtime: RuntimeSession, targetId: string): string {
  const tree = runtime.session.sessionManager.getTree() as PiSessionTreeNode[]
  const nodes = flattenTreeNodes(tree)
  if (nodes.some((node) => node.entry.id === targetId)) return targetId

  // Live Pi message events do not include the persisted session-entry id, so the
  // renderer temporarily receives ids like `${sessionID}:assistant:${timestamp}`.
  // Tree navigation requires the persisted entry id. Translate synthetic ids by
  // matching their role/timestamp against the current Pi session tree.
  const synthetic = parseSyntheticMessageId(runtime.id, targetId)
  if (!synthetic) return targetId

  const match = nodes.find((node) => {
    const entry = node.entry
    return (
      entry.message?.role === synthetic.role &&
      (Date.parse(entry.timestamp) === synthetic.timestamp ||
        entry.message?.timestamp === synthetic.timestamp)
    )
  })
  return match?.entry.id ?? targetId
}

function flattenTreeNodes(nodes: PiSessionTreeNode[]): PiSessionTreeNode[] {
  return nodes.flatMap((node) => [node, ...flattenTreeNodes(node.children)])
}

function parseSyntheticMessageId(
  sessionID: string,
  id: string,
): { role: "user" | "assistant"; timestamp: number } | null {
  const prefix = `${sessionID}:`
  if (!id.startsWith(prefix)) return null
  const [role, timestampText] = id.slice(prefix.length).split(":")
  if (role !== "user" && role !== "assistant") return null
  const timestamp = Number(timestampText)
  if (!Number.isFinite(timestamp)) return null
  return { role, timestamp }
}

async function createRuntimeSession(
  cwd: string,
  requestedModel?: RequestedAgentModel | null,
  thinkingLevel?: AgentThinkingLevel,
): Promise<RuntimeSession> {
  const { session } = await createPiSession(cwd, undefined, requestedModel, thinkingLevel)
  const runtime = bindRuntimeSession(session, cwd)
  sessions.set(runtime.id, runtime)
  return runtime
}

async function ensureRuntimeSession(
  sessionID: string,
  cwd: string,
  requestedModel?: RequestedAgentModel | null,
  thinkingLevel?: AgentThinkingLevel,
): Promise<RuntimeSession> {
  const existing = sessions.get(sessionID)
  if (existing) {
    existing.lastUsedAt = Date.now()
    await applyRuntimeModelOptions(existing, requestedModel, thinkingLevel)
    return existing
  }

  const sessionFile = await findSessionFile(cwd, sessionID)
  const pi = await loadPi()
  const sessionManager = sessionFile
    ? pi.SessionManager.open(sessionFile, getPiSessionDir(cwd), cwd)
    : pi.SessionManager.create(cwd, getPiSessionDir(cwd))
  const { session } = await createPiSession(cwd, sessionManager, requestedModel, thinkingLevel)
  const runtime = bindRuntimeSession(session, cwd)
  sessions.set(runtime.id, runtime)
  maybeEvictIdleSessions()
  return runtime
}

async function applyRuntimeModelOptions(
  runtime: RuntimeSession,
  requestedModel?: RequestedAgentModel | null,
  thinkingLevel?: AgentThinkingLevel,
): Promise<void> {
  let activeModel = runtime.session.model

  if (requestedModel) {
    const current = runtime.session.model
    if (current?.provider !== requestedModel.providerID || current?.id !== requestedModel.modelID) {
      const registry = await createModelRegistry()
      const model = registry.find(requestedModel.providerID, requestedModel.modelID)
      if (model) {
        await runtime.session.setModel(model)
        activeModel = model
      }
    }
  }

  const supportedThinkingLevel = getSupportedThinkingLevel(activeModel, thinkingLevel)
  if (supportedThinkingLevel) {
    runtime.session.setThinkingLevel(supportedThinkingLevel)
  }
}

async function createPiSession(
  cwd: string,
  sessionManager?: SessionManager,
  requestedModel?: RequestedAgentModel | null,
  thinkingLevel?: AgentThinkingLevel,
) {
  await syncDilagDesignSkills()
  const pi = await loadPi()
  const modelRuntime = await createModelRuntime()
  const registry = new pi.ModelRegistry(modelRuntime)
  const model = requestedModel
    ? registry.find(requestedModel.providerID, requestedModel.modelID)
    : chooseDefaultModel(registry.getAvailable())
  const questionTool = await createQuestionTool()
  const settingsManager = pi.SettingsManager.create(cwd, getPiAgentDir())
  const resourceLoader = new pi.DefaultResourceLoader({
    cwd,
    agentDir: getPiAgentDir(),
    settingsManager,
    additionalSkillPaths: [getDilagSkillsDir()],
    appendSystemPrompt: [renderDilagSystemPrompt(cwd)],
  })
  await resourceLoader.reload()
  const result = await pi.createAgentSession({
    cwd,
    agentDir: getPiAgentDir(),
    model,
    thinkingLevel: getSupportedThinkingLevel(model, thinkingLevel),
    modelRuntime,
    sessionManager,
    settingsManager,
    resourceLoader,
    customTools: [questionTool],
    noTools: "builtin",
    tools: ["read", "bash", "edit", "write", "glob", "question"],
  })
  await result.session.bindExtensions({
    uiContext: createBridgeUiContext(),
  })
  return result
}

function bindRuntimeSession(session: AgentSession, cwd: string): RuntimeSession {
  const runtime: RuntimeSession = {
    id: session.sessionId,
    cwd,
    session,
    unsubscribe: () => undefined,
    lastUsedAt: Date.now(),
    toolInputs: new Map(),
    toolMessageIds: new Map(),
    toolStates: new Map(),
    changedFiles: new Map(),
  }
  runtime.unsubscribe = session.subscribe((event) => handlePiSessionEvent(runtime, event))
  emitAgentEvent({
    type: "session.updated",
    properties: { info: { id: runtime.id, title: session.sessionName } },
  })
  return runtime
}

function getRuntimeSession(sessionID: string): RuntimeSession {
  const runtime = sessions.get(sessionID)
  if (!runtime) {
    throw new Error(`Agent session is not loaded: ${sessionID}`)
  }
  return runtime
}

export function releaseAgentSessionsForDirectory(cwd: string): void {
  const normalizedCwd = path.resolve(cwd)
  for (const [sessionID, runtime] of sessions) {
    if (path.resolve(runtime.cwd) !== normalizedCwd) continue
    disposeRuntimeSession(runtime)
    sessions.delete(sessionID)
  }
}

function disposeRuntimeSession(runtime: RuntimeSession): void {
  runtime.unsubscribe()
  // `dispose()` removes all listeners and disconnects from the agent; it is the
  // SDK's "completely done with this session" cleanup (see AgentSession d.ts).
  runtime.session.dispose()
}

type EvictionCandidate = {
  id: string
  isStreaming: boolean
  hasPendingQuestion: boolean
  lastUsedAt: number
}

/**
 * Pure eviction policy: given a snapshot of resident sessions, return the ids
 * safe to evict. A session is evictable only when it is idle (not streaming),
 * has no pending question blocked on it, and is not among the `keepN` most
 * recently used sessions. Exported for unit testing.
 */
export function selectSessionsToEvict(candidates: EvictionCandidate[], keepN: number): string[] {
  const byRecency = [...candidates].sort((a, b) => b.lastUsedAt - a.lastUsedAt)
  const protectedIds = new Set(byRecency.slice(0, keepN).map((candidate) => candidate.id))
  return byRecency
    .filter(
      (candidate) =>
        !candidate.isStreaming && !candidate.hasPendingQuestion && !protectedIds.has(candidate.id),
    )
    .map((candidate) => candidate.id)
}

function maybeEvictIdleSessions(): void {
  const pendingSessionIds = new Set<string>()
  for (const pending of pendingQuestions.values()) {
    pendingSessionIds.add(pending.request.sessionID)
  }

  const candidates: EvictionCandidate[] = Array.from(sessions.values()).map((runtime) => ({
    id: runtime.id,
    isStreaming: runtime.session.isStreaming,
    hasPendingQuestion: pendingSessionIds.has(runtime.id),
    lastUsedAt: runtime.lastUsedAt,
  }))

  for (const sessionID of selectSessionsToEvict(candidates, MAX_IDLE_RUNTIME_SESSIONS)) {
    const runtime = sessions.get(sessionID)
    if (!runtime) continue
    // Guard again right before disposing: never kill an in-flight stream or a
    // session parked on a pending question, even if state changed since the
    // snapshot was taken above.
    if (runtime.session.isStreaming || pendingSessionIds.has(sessionID)) continue
    disposeRuntimeSession(runtime)
    sessions.delete(sessionID)
  }
}

async function createModelRuntime(): Promise<ModelRuntime> {
  if (!modelRuntimePromise) {
    modelRuntimePromise = loadPi().then((pi) => {
      const agentDir = getPiAgentDir()
      return pi.ModelRuntime.create({
        authPath: path.join(agentDir, "auth.json"),
        modelsPath: path.join(agentDir, "models.json"),
      })
    })
  }
  return modelRuntimePromise
}

async function createModelRegistry(): Promise<ModelRegistry> {
  const pi = await loadPi()
  return new pi.ModelRegistry(await createModelRuntime())
}

async function findSessionFile(cwd: string, sessionID: string): Promise<string | undefined> {
  const sessionDir = getPiSessionDir(cwd)
  const pi = await loadPi()
  const infos = await pi.SessionManager.list(cwd, sessionDir)
  return infos.find((info) => info.id === sessionID)?.path
}

async function createQuestionTool(): Promise<ToolDefinition> {
  const pi = await loadPi()
  const QuestionOptionSchema = Type.Object({
    label: Type.String(),
    description: Type.Optional(Type.String()),
    value: Type.Optional(Type.String()),
  })
  const QuestionSchema = Type.Object({
    id: Type.Optional(Type.String()),
    header: Type.Optional(Type.String()),
    label: Type.Optional(Type.String()),
    question: Type.Optional(Type.String()),
    prompt: Type.Optional(Type.String()),
    options: Type.Array(QuestionOptionSchema),
    multiple: Type.Optional(Type.Boolean()),
    allowOther: Type.Optional(Type.Boolean()),
  })

  return pi.defineTool({
    name: "question",
    label: "Question",
    description:
      "Ask the user one or more clarification questions through Dilag's question UI. Use this when a user decision is needed before continuing.",
    promptSnippet: "question: ask the user for clarification through the Dilag UI.",
    parameters: Type.Object({
      questions: Type.Array(QuestionSchema),
    }),
    async execute(toolCallId, params, signal, _onUpdate, ctx) {
      const sessionId = ctx.sessionManager.getSessionId()
      if (!sessionId) {
        return {
          content: [{ type: "text", text: "Question UI unavailable: session not found." }],
          details: undefined,
        }
      }

      const request: AgentQuestionRequest = {
        id: randomUUID(),
        sessionID: sessionId,
        questions: params.questions.map((question, index) => normalizeQuestion(question, index)),
        tool: {
          messageID: `${sessionId}:question:${toolCallId}`,
          callID: toolCallId,
        },
      }

      const answers = await waitForQuestionAnswer(request, signal)
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                answers,
              },
              null,
              2,
            ),
          },
        ],
        details: { request, answers },
      }
    },
  })
}

function createBridgeUiContext() {
  return {
    select: async () => undefined,
    confirm: async () => false,
    input: async () => undefined,
    notify: (message: string, type?: "info" | "warning" | "error") => {
      emitAgentEvent({
        type: "agent.notification",
        properties: { message, notificationType: type ?? "info" },
      })
    },
    onTerminalInput: () => () => undefined,
    setStatus: () => undefined,
    setWorkingMessage: () => undefined,
    setWorkingVisible: () => undefined,
    setWorkingIndicator: () => undefined,
    setHiddenThinkingLabel: () => undefined,
    setWidget: () => undefined,
    setFooter: () => undefined,
    setHeader: () => undefined,
    setTitle: () => undefined,
    custom: async () => undefined as never,
    pasteToEditor: () => undefined,
    setEditorText: () => undefined,
    getEditorText: () => "",
    editor: async () => undefined,
    addAutocompleteProvider: () => undefined,
    setEditorComponent: () => undefined,
    getEditorComponent: () => undefined,
    get theme() {
      return undefined
    },
    getAllThemes: () => [],
    getTheme: () => undefined,
    setTheme: () => ({ success: false, error: "Dilag renderer owns Pi UI." }),
    getToolsExpanded: () => false,
    setToolsExpanded: () => undefined,
  } as unknown as ExtensionUIContext
}

function normalizeQuestion(
  question: {
    id?: string
    header?: string
    label?: string
    question?: string
    prompt?: string
    options: Array<{ label: string; description?: string; value?: string }>
    multiple?: boolean
    allowOther?: boolean
  },
  index: number,
): AgentQuestionInfo {
  return {
    header: question.header ?? question.label ?? `Question ${index + 1}`,
    question: question.question ?? question.prompt ?? "Choose an option.",
    multiple: question.multiple,
    options: [
      ...question.options.map((option) => ({
        label: option.value ?? option.label,
        description: option.description ?? "",
      })),
      ...(question.allowOther === false
        ? []
        : [{ label: "Other", description: "Type another answer." }]),
    ],
  }
}

function waitForQuestionAnswer(
  request: AgentQuestionRequest,
  signal: AbortSignal | undefined,
): Promise<string[][]> {
  emitAgentEvent({ type: "question.asked", properties: request })
  return new Promise((resolve, reject) => {
    const cleanup = () => pendingQuestions.delete(request.id)
    const onAbort = () => {
      cleanup()
      emitAgentEvent({
        type: "question.rejected",
        properties: { sessionID: request.sessionID, requestID: request.id },
      })
      reject(new Error("Question was aborted."))
    }
    signal?.addEventListener("abort", onAbort, { once: true })
    pendingQuestions.set(request.id, {
      request,
      resolve: (answers) => {
        signal?.removeEventListener("abort", onAbort)
        cleanup()
        resolve(answers)
      },
      reject: () => {
        signal?.removeEventListener("abort", onAbort)
        cleanup()
        reject(new Error("Question was rejected."))
      },
    })
  })
}

function handlePiSessionEvent(runtime: RuntimeSession, event: AgentSessionEvent) {
  runtime.lastUsedAt = Date.now()
  debugPiSessionEvent(runtime, event)

  if (
    event.type === "message_start" ||
    event.type === "message_update" ||
    event.type === "message_end"
  ) {
    const phase =
      event.type === "message_start" ? "start" : event.type === "message_end" ? "end" : "update"
    const message = event.message as PiMessage
    emitMessage(runtime, message, phase)
    if (phase === "end") {
      const error = assistantErrorMessage(message)
      if (error) runtime.terminalError = error
    }
    return
  }

  if (event.type === "queue_update") {
    emitPromptQueueUpdate(runtime.id, event.steering, event.followUp)
    return
  }

  if (event.type === "tool_execution_start") {
    runtime.toolInputs.set(event.toolCallId, event.args)
    emitToolPart(runtime, event.toolCallId, event.toolName, "running", event.args)
    return
  }

  if (event.type === "tool_execution_update") {
    if (event.args !== undefined) runtime.toolInputs.set(event.toolCallId, event.args)
    emitToolPart(
      runtime,
      event.toolCallId,
      event.toolName,
      "running",
      event.args,
      event.partialResult,
    )
    return
  }

  if (event.type === "tool_execution_end") {
    const input = runtime.toolInputs.get(event.toolCallId)
    emitToolPart(
      runtime,
      event.toolCallId,
      event.toolName,
      event.isError ? "error" : "completed",
      input,
      event.result,
    )
    if (!event.isError) {
      recordToolFileMutation(runtime, event.toolName, input, event.result)
    }
    runtime.toolInputs.delete(event.toolCallId)
    return
  }

  if (event.type === "agent_end") {
    runtime.activeMessageId = undefined
    if (runtime.terminalError) {
      emitSessionError(runtime.id, new Error(runtime.terminalError))
      runtime.terminalError = undefined
    } else {
      emitSessionIdle(runtime.id)
    }
    return
  }

  if (event.type === "session_info_changed") {
    emitAgentEvent({
      type: "session.updated",
      properties: { info: { id: runtime.id, title: event.name } },
    })
  }
}

function emitMessage(runtime: RuntimeSession, message: PiMessage, phase: PiMessagePhase) {
  if (message.role !== "user" && message.role !== "assistant") return

  const sessionID = runtime.id
  const messageID =
    message.role === "assistant"
      ? phase === "start" || !runtime.activeMessageId
        ? messageId(sessionID, message)
        : runtime.activeMessageId
      : messageId(sessionID, message)
  if (message.role === "assistant") {
    runtime.activeMessageId = messageID
    trackToolMessageIds(runtime, messageID, message)
  }
  const created = message.timestamp ?? Date.now()
  const completed = phase === "end"
  emitAgentEvent({
    type: "message.updated",
    properties: {
      info: {
        id: messageID,
        sessionID,
        role: message.role,
        time: completed ? { created, completed: Date.now() } : { created },
      },
    },
  })

  messageParts(sessionID, messageID, message, runtime.toolStates).forEach((part) => {
    emitAgentEvent({
      type: "message.part.updated",
      properties: { part },
    })
  })

  if (message.role === "assistant" && completed) {
    runtime.activeMessageId = undefined
  }
}

function emitToolPart(
  runtime: RuntimeSession,
  toolCallId: string,
  toolName: string,
  status: "running" | "completed" | "error",
  input?: unknown,
  output?: unknown,
) {
  const sessionID = runtime.id
  const messageID =
    runtime.toolMessageIds.get(toolCallId) ??
    runtime.activeMessageId ??
    `${sessionID}:assistant:active`
  runtime.toolMessageIds.set(toolCallId, messageID)
  const state = toolState(toolName, status, input, output, runtime.toolStates.get(toolCallId))
  runtime.toolStates.set(toolCallId, state)
  emitAgentEvent({
    type: "message.updated",
    properties: {
      info: {
        id: messageID,
        sessionID,
        role: "assistant",
        time: { created: Date.now() },
      },
    },
  })
  emitAgentEvent({
    type: "message.part.updated",
    properties: {
      part: {
        id: toolCallId,
        messageID,
        sessionID,
        type: "tool",
        tool: toolName,
        state,
      },
    },
  })
}

function messageEntryToBridgeMessages(
  entry: { id: string; timestamp: string; message?: unknown },
  sessionID: string,
  toolStates?: Map<string, AgentToolState>,
): AgentMessage[] {
  const message = entry.message as PiMessage | undefined
  if (!message || (message.role !== "user" && message.role !== "assistant")) return []
  const messageID = entry.id
  const created = Date.parse(entry.timestamp) || message.timestamp || Date.now()
  return [
    {
      info: {
        id: messageID,
        sessionID,
        role: message.role,
        time: { created, completed: created },
      },
      parts: messageParts(sessionID, messageID, message, toolStates, true),
    },
  ]
}

function messageParts(
  sessionID: string,
  messageID: string,
  message: PiMessage,
  toolStates?: Map<string, AgentToolState>,
  includeErrorFallback = false,
): AgentMessagePart[] {
  const content = normalizeContent(message.content)
  const error = includeErrorFallback ? assistantErrorMessage(message) : undefined
  if (content.length === 0 && error) {
    return [
      { id: `${messageID}:error`, messageID, sessionID, type: "text", text: `Error: ${error}` },
    ]
  }
  return content.flatMap((part, index): AgentMessagePart[] => {
    const id = `${messageID}:part:${index}`
    const partStart = message.timestamp ?? Date.now()
    if (part.type === "text") {
      return [{ id, messageID, sessionID, type: "text", text: part.text }]
    }
    if (part.type === "thinking") {
      return [{ id, messageID, sessionID, type: "reasoning", text: part.text ?? part.thinking }]
    }
    if (part.type === "image") {
      return [
        {
          id,
          messageID,
          sessionID,
          type: "file",
          mime: part.mimeType,
          url: `data:${part.mimeType};base64,${part.data}`,
          filename: "image",
        },
      ]
    }
    return [
      {
        id: part.id,
        messageID,
        sessionID,
        type: "tool",
        tool: part.name,
        state: toolStates?.get(part.id) ?? {
          status: includeErrorFallback ? "error" : "pending",
          input: part.arguments,
          error: includeErrorFallback ? "Interrupted" : undefined,
          time: {
            start: partStart,
            end: includeErrorFallback ? partStart : undefined,
          },
        },
      },
    ]
  })
}

export function assistantErrorMessage(message: {
  role: string
  stopReason?: string
  errorMessage?: string
}): string | undefined {
  if (message.role !== "assistant" || message.stopReason !== "error") return undefined
  return message.errorMessage?.trim() || "The model request failed."
}

function trackToolMessageIds(runtime: RuntimeSession, messageID: string, message: PiMessage) {
  for (const part of normalizeContent(message.content)) {
    if (part.type === "toolCall") {
      runtime.toolMessageIds.set(part.id, messageID)
    }
  }
}

function toolState(
  toolName: string,
  status: "running" | "completed" | "error",
  input?: unknown,
  output?: unknown,
  previous?: AgentToolState,
): AgentToolState {
  const start = previous?.time?.start ?? Date.now()
  return {
    status,
    input: input ?? previous?.input,
    output: output === undefined ? undefined : toolResultText(output),
    error: status === "error" ? toolResultText(output) : undefined,
    metadata: toolResultMetadata(toolName, output),
    time: { start, end: status === "running" ? undefined : Date.now() },
  }
}

type PiSessionEntry = {
  id: string
  type: string
  timestamp: string
  message?: PiMessage
}

function toolStatesFromEntries(entries: PiSessionEntry[]): Map<string, AgentToolState> {
  const toolInputs = new Map<string, unknown>()
  const toolNames = new Map<string, string>()
  const toolStates = new Map<string, AgentToolState>()

  for (const entry of entries) {
    const message = entry.message
    if (!message || message.role !== "assistant") continue
    for (const part of normalizeContent(message.content)) {
      if (part.type !== "toolCall") continue
      toolInputs.set(part.id, part.arguments)
      toolNames.set(part.id, part.name)
    }
  }

  for (const entry of entries) {
    const message = entry.message
    if (!message || message.role !== "toolResult" || !message.toolCallId) continue
    const toolName = message.toolName ?? toolNames.get(message.toolCallId) ?? "tool"
    toolStates.set(
      message.toolCallId,
      toolState(
        toolName,
        message.isError ? "error" : "completed",
        toolInputs.get(message.toolCallId),
        message,
      ),
    )
  }

  return toolStates
}

function normalizeContent(
  content: PiContent | undefined,
): Array<PiTextContent | PiThinkingContent | PiImageContent | PiToolCall> {
  if (!content) return []
  if (typeof content === "string") {
    return [{ type: "text", text: content }]
  }
  return content
}

function messageId(sessionID: string, message: PiMessage): string {
  return `${sessionID}:${message.role}:${message.timestamp ?? Date.now()}`
}

function toAgentSessionInfo(runtime: RuntimeSession): AgentSessionInfo {
  return {
    id: runtime.id,
    cwd: runtime.cwd,
    title: runtime.session.sessionName,
  }
}

function mapTreeNode(node: PiSessionTreeNode): BridgeAgentTreeNode {
  const entry = node.entry
  return {
    id: entry.id,
    parentId: entry.parentId,
    type: entry.type,
    role: mapTreeRole(entry.message?.role),
    label: node.label,
    text: entry.summary ?? messageText(entry.message),
    timestamp: entry.timestamp,
    children: node.children.map((child) => mapTreeNode(child)),
  }
}

function mapTreeRole(
  role: PiMessage["role"] | undefined,
): "user" | "assistant" | "toolResult" | undefined {
  if (role === "user" || role === "assistant" || role === "toolResult") return role
  return undefined
}

function messageText(message: PiMessage | undefined): string | undefined {
  if (!message) return undefined
  return normalizeContent(message.content)
    .filter((part): part is PiTextContent => part.type === "text")
    .map((part) => part.text)
    .join("\n")
}

function toolResultText(value: unknown): string {
  if (typeof value === "string") return value
  if (isToolResultWithContent(value)) {
    return value.content
      .map((part) => {
        if (part.type === "text") return part.text
        if (part.type === "image") return `[Image: ${part.mimeType}]`
        return ""
      })
      .filter(Boolean)
      .join("\n")
  }
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function toolResultMetadata(toolName: string, value: unknown): Record<string, unknown> | undefined {
  if (!isToolResultWithContent(value)) return undefined
  const text = toolResultText(value)
  return {
    ...(typeof value.details === "object" && value.details ? value.details : {}),
    preview: toolName === "read" ? text.split("\n").slice(0, 40).join("\n") : undefined,
  }
}

function isToolResultWithContent(value: unknown): value is {
  content: Array<PiTextContent | PiImageContent>
  details?: unknown
} {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as { content?: unknown }).content)
  )
}

function humanizeProviderName(id: string): string {
  return id
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function emitPromptQueueUpdate(
  sessionID: string,
  steering: readonly string[],
  followUp: readonly string[],
) {
  emitAgentEvent({
    type: "prompt.queue.updated",
    properties: {
      sessionID,
      steering: [...steering],
      followUp: [...followUp],
    },
  })
}

function emitSessionStatus(sessionID: string, status: "running" | "idle" | "error") {
  emitAgentEvent({
    type: "session.status",
    properties: {
      sessionID,
      status: { type: status },
    },
  })
}

function emitSessionIdle(sessionID: string) {
  emitAgentEvent({ type: "session.idle", properties: { sessionID } })
}

function emitSessionError(sessionID: string, error: unknown) {
  emitSessionStatus(sessionID, "error")
  emitAgentEvent({
    type: "session.error",
    properties: {
      sessionID,
      error: {
        name: error instanceof Error ? error.name : "Error",
        data: { message: error instanceof Error ? error.message : String(error) },
      },
    },
  })
}

function recordToolFileMutation(
  runtime: RuntimeSession,
  toolName: string,
  input: unknown,
  output: unknown,
) {
  if (toolName !== "write" && toolName !== "edit") return

  const file = extractToolPath(input)
  if (!file) return

  const counts =
    toolName === "edit"
      ? countUnifiedDiffLines(extractDiff(output))
      : { additions: countContentLines(input), deletions: 0 }

  runtime.changedFiles.set(file, { file, ...counts })

  emitAgentEvent({
    type: "file.watcher.updated",
    properties: { file, event: "change" },
  })
  emitAgentEvent({
    type: "project.updated",
    properties: { sessionID: runtime.id },
  })
  emitAgentEvent({
    type: "session.diff",
    properties: {
      sessionID: runtime.id,
      diff: Array.from(runtime.changedFiles.values()),
    },
  })
}

function extractToolPath(input: unknown): string | undefined {
  if (!input || typeof input !== "object") return undefined
  const record = input as Record<string, unknown>
  const candidate = record.path ?? record.file_path ?? record.filePath
  return typeof candidate === "string" && candidate.trim() ? candidate : undefined
}

function countContentLines(input: unknown): number {
  if (!input || typeof input !== "object") return 0
  const content = (input as Record<string, unknown>).content
  if (typeof content !== "string") return 0
  if (content.length === 0) return 0
  return content.split(/\r\n|\r|\n/).length
}

function extractDiff(output: unknown): string | undefined {
  if (!output || typeof output !== "object") return undefined
  const details = (output as Record<string, unknown>).details
  if (!details || typeof details !== "object") return undefined
  const diff = (details as Record<string, unknown>).diff
  return typeof diff === "string" ? diff : undefined
}

function countUnifiedDiffLines(diff: string | undefined): { additions: number; deletions: number } {
  if (!diff) return { additions: 0, deletions: 0 }

  let additions = 0
  let deletions = 0
  for (const line of diff.split(/\r\n|\r|\n/)) {
    if (line.startsWith("+++") || line.startsWith("---")) continue
    if (line.startsWith("+")) additions++
    if (line.startsWith("-")) deletions++
  }
  return { additions, deletions }
}

function debugPiSessionEvent(runtime: RuntimeSession, event: AgentSessionEvent) {
  if (!DEBUG_PI_SMOKE) return
  const message = "message" in event ? (event.message as PiMessage | undefined) : undefined
  debugPiSmoke("event", {
    sessionID: runtime.id,
    cwd: runtime.cwd,
    type: event.type,
    role: message?.role,
    toolName: "toolName" in event ? event.toolName : message?.toolName,
    stopReason: message?.stopReason,
    errorMessage: message?.errorMessage,
  })
}

function debugPiSmoke(label: string, data: Record<string, unknown>) {
  if (DEBUG_PI_SMOKE) console.log(`[DEBUG-pi-smoke] ${label}`, data)
}

function emitAgentEvent(event: unknown) {
  eventSender?.(CHANNELS.agent.event, event)
}

function rejectAllPendingQuestions() {
  for (const requestID of pendingQuestions.keys()) {
    rejectAgentQuestion({ requestID })
  }
}

function clearQuestionsForSession(sessionID: string) {
  for (const pending of pendingQuestions.values()) {
    if (pending.request.sessionID === sessionID) {
      rejectAgentQuestion({ requestID: pending.request.id })
    }
  }
}
