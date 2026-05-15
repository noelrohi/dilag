import type {
  AgentSession,
  AgentSessionEvent,
  ExtensionUIContext,
  ModelRegistry,
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
  AgentThinkingLevel,
  AgentTreeNode as BridgeAgentTreeNode,
} from "@dilag/desktop-bridge"
import fsp from "node:fs/promises"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { Type } from "typebox"
import { CHANNELS } from "../shared/channels.js"
import { getPiAgentDir, resolveDesignAssetDir } from "./paths.js"

type EventSender = (channel: string, event: unknown) => void

type PiTextContent = { type: "text"; text: string }
type PiThinkingContent = { type: "thinking"; text: string }
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
}

type RequestedAgentModel = { providerID: string; modelID: string }

type RuntimeSession = {
  id: string
  cwd: string
  session: AgentSession
  unsubscribe: () => void
  toolInputs: Map<string, unknown>
  changedFiles: Map<string, { file: string; additions: number; deletions: number }>
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
const OAUTH_PROVIDER_IDS = new Set(["openai-codex", "github-copilot"])

let eventSender: EventSender | undefined
let piModulePromise: Promise<typeof import("@earendil-works/pi-coding-agent")> | undefined

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
      await runtime.session.abort().catch(() => undefined)
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
  const first = models[0]
  return {
    models,
    connectedProviders,
    defaultModel: first ? { providerID: first.providerID, modelID: first.id } : null,
  }
}

function getThinkingLevelVariants(model: {
  reasoning?: boolean
  thinkingLevelMap?: Partial<Record<AgentThinkingLevel, string | null>>
}) {
  if (!model.reasoning) return undefined
  const levels: AgentThinkingLevel[] = ["off", "minimal", "low", "medium", "high", "xhigh"]
  const available = levels.filter((level) => {
    const mapped = model.thinkingLevelMap?.[level]
    if (mapped === null) return false
    if (level === "xhigh") return mapped !== undefined
    return true
  })
  return Object.fromEntries(available.map((level) => [level, {}])) as Record<
    AgentThinkingLevel,
    Record<string, unknown>
  >
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
  const pi = await loadPi()
  const authStorage = pi.AuthStorage.create(path.join(getPiAgentDir(), "auth.json"))
  authStorage.set(args.providerID, { type: "api_key", key: args.apiKey })
}

export async function loginAgentOAuthProvider(
  args: { providerID: string },
  openExternal: (url: string) => Promise<void>,
): Promise<void> {
  const pi = await loadPi()
  const authStorage = pi.AuthStorage.create(path.join(getPiAgentDir(), "auth.json"))
  await authStorage.login(args.providerID, {
    onAuth: async ({ url }) => {
      await openExternal(url)
    },
    onPrompt: async () => {
      throw new Error("Browser OAuth callback did not complete. Please try again.")
    },
    onProgress: (message) => {
      console.log(`[pi oauth:${args.providerID}] ${message}`)
    },
  })
}

export async function createAgentSessionForDirectory(args: {
  directory: string
}): Promise<AgentSessionInfo> {
  const runtime = await createRuntimeSession(args.directory)
  return toAgentSessionInfo(runtime)
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
  return runtime.session.sessionManager
    .getEntries()
    .filter((entry) => entry.type === "message")
    .flatMap((entry) => messageEntryToBridgeMessages(entry, runtime.id))
}

export async function promptAgentSession(args: {
  sessionID: string
  directory: string
  text: string
  images?: Array<{ type: "image"; data: string; mimeType: string }>
  model?: RequestedAgentModel | null
  thinkingLevel?: AgentThinkingLevel
}): Promise<void> {
  const runtime = await ensureRuntimeSession(
    args.sessionID,
    args.directory,
    args.model,
    args.thinkingLevel,
  )
  emitSessionStatus(runtime.id, "running")
  void runtime.session.prompt(args.text, { images: args.images }).catch((error: unknown) => {
    emitSessionError(runtime.id, error)
  })
}

export async function abortAgentSession(args: { sessionID: string }): Promise<void> {
  const runtime = getRuntimeSession(args.sessionID)
  await runtime.session.abort()
  emitSessionIdle(runtime.id)
}

export async function renameAgentSession(args: { sessionID: string; name: string }): Promise<void> {
  const runtime = getRuntimeSession(args.sessionID)
  runtime.session.setSessionName(args.name)
}

export async function deleteAgentSession(args: { sessionID: string }): Promise<void> {
  const runtime = sessions.get(args.sessionID)
  if (!runtime) return
  runtime.unsubscribe()
  await runtime.session.abort().catch(() => undefined)
  const sessionFile = runtime.session.sessionFile
  if (sessionFile) {
    await fsp.rm(sessionFile, { force: true })
  }
  sessions.delete(args.sessionID)
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

export async function navigateAgentTree(args: {
  sessionID: string
  targetId: string
  summarize?: boolean
  customInstructions?: string
  replaceInstructions?: boolean
  label?: string
}): Promise<{ editorText?: string; cancelled: boolean; aborted?: boolean }> {
  const runtime = getRuntimeSession(args.sessionID)
  const result = await runtime.session.navigateTree(args.targetId, {
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
  return runtime
}

async function applyRuntimeModelOptions(
  runtime: RuntimeSession,
  requestedModel?: RequestedAgentModel | null,
  thinkingLevel?: AgentThinkingLevel,
): Promise<void> {
  if (requestedModel) {
    const current = runtime.session.model
    if (current?.provider !== requestedModel.providerID || current?.id !== requestedModel.modelID) {
      const registry = await createModelRegistry()
      const model = registry.find(requestedModel.providerID, requestedModel.modelID)
      if (model) await runtime.session.setModel(model)
    }
  }

  if (thinkingLevel) {
    runtime.session.setThinkingLevel(thinkingLevel)
  }
}

async function createPiSession(
  cwd: string,
  sessionManager?: SessionManager,
  requestedModel?: RequestedAgentModel | null,
  thinkingLevel?: AgentThinkingLevel,
) {
  await ensureDilagPiResources(cwd)
  const pi = await loadPi()
  const registry = await createModelRegistry()
  const model = requestedModel
    ? registry.find(requestedModel.providerID, requestedModel.modelID)
    : registry.getAvailable()[0]
  const questionTool = await createQuestionTool()
  const result = await pi.createAgentSession({
    cwd,
    agentDir: getPiAgentDir(),
    model,
    thinkingLevel,
    modelRegistry: registry,
    sessionManager,
    customTools: [questionTool],
    noTools: "builtin",
    tools: ["read", "bash", "edit", "write", "question"],
  })
  await result.session.bindExtensions({
    uiContext: createBridgeUiContext(),
  })
  return result
}

async function ensureDilagPiResources(cwd: string): Promise<void> {
  const assetDir = resolveDesignAssetDir()
  const skillsDir = path.join(cwd, ".agents", "skills")
  const mobileSkillDir = path.join(skillsDir, "mobile-design")
  const webSkillDir = path.join(skillsDir, "web-design")

  const [common, mobile, web] = await Promise.all([
    fsp.readFile(path.join(assetDir, "designer-common.md"), "utf8"),
    fsp.readFile(path.join(assetDir, "mobile-designer-prompt.md"), "utf8"),
    fsp.readFile(path.join(assetDir, "web-designer-prompt.md"), "utf8"),
  ])

  await Promise.all([
    fsp.mkdir(path.join(mobileSkillDir, "examples"), { recursive: true }),
    fsp.mkdir(path.join(webSkillDir, "examples"), { recursive: true }),
  ])

  await Promise.all([
    fsp.writeFile(path.join(mobileSkillDir, "SKILL.md"), renderDesignSkill(mobile, common)),
    fsp.writeFile(path.join(webSkillDir, "SKILL.md"), renderDesignSkill(web, common)),
    copyAssetIfExists(
      path.join(assetDir, "examples", "mobile", "wellness.html"),
      path.join(mobileSkillDir, "examples", "wellness.html"),
    ),
    copyAssetIfExists(
      path.join(assetDir, "examples", "mobile", "finance.html"),
      path.join(mobileSkillDir, "examples", "finance.html"),
    ),
    copyAssetIfExists(
      path.join(assetDir, "examples", "web", "editorial.html"),
      path.join(webSkillDir, "examples", "editorial.html"),
    ),
    copyAssetIfExists(
      path.join(assetDir, "examples", "web", "saas-dashboard.html"),
      path.join(webSkillDir, "examples", "saas-dashboard.html"),
    ),
  ])
}

function renderDesignSkill(template: string, common: string): string {
  const fallback = "(none specified - use your judgment based on the user's request)"
  const brand = process.env.DILAG_BRAND_TOKENS?.trim() || fallback
  const domain = process.env.DILAG_DOMAIN_HINT?.trim() || fallback
  const refs = process.env.DILAG_REFERENCE_URLS?.trim() || fallback
  return template
    .replace("{{COMMON}}", common)
    .replace("{{BRAND_TOKENS}}", brand)
    .replace("{{DOMAIN_HINT}}", domain)
    .replace("{{REFERENCE_URLS}}", refs)
}

async function copyAssetIfExists(source: string, target: string): Promise<void> {
  try {
    await fsp.copyFile(source, target)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
  }
}

function bindRuntimeSession(session: AgentSession, cwd: string): RuntimeSession {
  const runtime: RuntimeSession = {
    id: session.sessionId,
    cwd,
    session,
    unsubscribe: () => undefined,
    toolInputs: new Map(),
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

async function createModelRegistry(): Promise<ModelRegistry> {
  const pi = await loadPi()
  const agentDir = getPiAgentDir()
  const authStorage = pi.AuthStorage.create(path.join(agentDir, "auth.json"))
  return pi.ModelRegistry.create(authStorage, path.join(agentDir, "models.json"))
}

function getPiSessionDir(cwd: string): string {
  const safePath = `--${cwd.replace(/^[/\\]/, "").replace(/[/\\:]/g, "-")}--`
  return path.join(getPiAgentDir(), "sessions", safePath)
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
    async execute(toolCallId, params, signal) {
      const sessionId = findSessionIdForToolCall(toolCallId)
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

function findSessionIdForToolCall(toolCallId: string): string | undefined {
  for (const runtime of sessions.values()) {
    if (
      runtime.session.messages.some((message) =>
        messageHasToolCall(message as PiMessage, toolCallId),
      )
    ) {
      return runtime.id
    }
    if (runtime.session.isStreaming) return runtime.id
  }
  return sessions.values().next().value?.id
}

function messageHasToolCall(message: PiMessage, toolCallId: string): boolean {
  if (!Array.isArray(message.content)) return false
  return message.content.some((part) => part.type === "toolCall" && part.id === toolCallId)
}

function handlePiSessionEvent(runtime: RuntimeSession, event: AgentSessionEvent) {
  if (
    event.type === "message_start" ||
    event.type === "message_update" ||
    event.type === "message_end"
  ) {
    emitMessage(runtime.id, event.message as PiMessage, event.type === "message_end")
    return
  }

  if (event.type === "tool_execution_start") {
    runtime.toolInputs.set(event.toolCallId, event.args)
    emitToolPart(runtime.id, event.toolCallId, event.toolName, "running", event.args)
    return
  }

  if (event.type === "tool_execution_update") {
    if (event.args !== undefined) runtime.toolInputs.set(event.toolCallId, event.args)
    emitToolPart(
      runtime.id,
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
      runtime.id,
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
    emitSessionIdle(runtime.id)
    return
  }

  if (event.type === "session_info_changed") {
    emitAgentEvent({
      type: "session.updated",
      properties: { info: { id: runtime.id, title: event.name } },
    })
  }
}

function emitMessage(sessionID: string, message: PiMessage, completed: boolean) {
  if (message.role !== "user" && message.role !== "assistant") return

  const messageID = messageId(sessionID, message)
  const created = message.timestamp ?? Date.now()
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

  messageParts(sessionID, messageID, message).forEach((part) => {
    emitAgentEvent({
      type: "message.part.updated",
      properties: { part },
    })
  })
}

function emitToolPart(
  sessionID: string,
  toolCallId: string,
  toolName: string,
  status: "running" | "completed" | "error",
  input?: unknown,
  output?: unknown,
) {
  const messageID = `${sessionID}:assistant:active`
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
        state: {
          status,
          input,
          output: output === undefined ? undefined : stringifyResult(output),
          error: status === "error" ? stringifyResult(output) : undefined,
          time: { start: Date.now(), end: status === "running" ? undefined : Date.now() },
        },
      },
    },
  })
}

function messageEntryToBridgeMessages(
  entry: { id: string; timestamp: string; message?: unknown },
  sessionID: string,
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
      parts: messageParts(sessionID, messageID, message),
    },
  ]
}

function messageParts(
  sessionID: string,
  messageID: string,
  message: PiMessage,
): AgentMessagePart[] {
  const content = normalizeContent(message.content)
  return content.flatMap((part, index): AgentMessagePart[] => {
    const id = `${messageID}:part:${index}`
    if (part.type === "text") {
      return [{ id, messageID, sessionID, type: "text", text: part.text }]
    }
    if (part.type === "thinking") {
      return [{ id, messageID, sessionID, type: "reasoning", text: part.text }]
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
        state: {
          status: "pending",
          input: part.arguments,
          time: { start: message.timestamp ?? Date.now() },
        },
      },
    ]
  })
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

function stringifyResult(value: unknown): string {
  if (typeof value === "string") return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function humanizeProviderName(id: string): string {
  return id
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
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
