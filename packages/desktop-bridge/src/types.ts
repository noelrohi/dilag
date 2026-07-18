// Shared data types exchanged across the desktop bridge.
// Shared data types exchanged across the desktop bridge.
// The Electron main process is the source of truth and the renderer imports
// these from `@dilag/desktop-bridge/types`.

export type Platform = "web" | "mobile"

export interface AppInfo {
  version: string
  data_dir: string
  data_size_bytes: number
}

export interface SessionMeta {
  id: string
  name: string
  created_at: string
  updated_at?: string
  cwd: string
  parentID?: string
  platform?: Platform
  favorite?: boolean
  projectId?: string
}

export interface ProjectMeta {
  id: string
  name: string
  path: string
  platform: Platform
  pinned: boolean
  expanded: boolean
  created_at: string
  last_opened_at: string
}

export interface AgentSessionSummary {
  id: string
  cwd: string
  name?: string
  created_at: string
  updated_at: string
  message_count: number
  first_message: string
}

export type ViolationRule =
  | "keyframes"
  | "initial_opacity_zero"
  | "real_url"
  | "emoji_as_icon"
  | "animation_css"
  | "decorative_animation"

export interface Violation {
  rule: ViolationRule
  snippet: string
}

export interface DesignFile {
  filename: string
  file_path: string
  title: string
  screen_type: string
  html: string
  modified_at: number
  violations: Violation[]
}

export interface ImportDesignsResult {
  imported: number
  rejected: Array<{ path: string; reason: string }>
}

export type DesignMutationResult =
  | { ok: true; filename: string }
  | { ok: false; reason: string; violations?: Violation[] }

export interface FileNode {
  id: string
  name: string
  isDir: boolean
  children?: FileNode[]
}

export interface SkillInfo {
  name: string
  path: string
  is_symlink: boolean
}

export interface SkillPreview {
  name: string
  description: string
}

export interface SkillPreviewResult {
  success: boolean
  skills: SkillPreview[]
  error: string | null
}

export interface SkillInstallResult {
  success: boolean
  installed: string[]
  error: string | null
}

export interface AgentRuntimeInfo {
  running: boolean
  agentDir: string
  sessionCount: number
}

export type AgentThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max"

export interface AgentModel {
  id: string
  name: string
  providerID: string
  providerName: string
  releaseDate?: string
  family?: string
  cost?: { input?: number; output?: number }
  contextWindow?: number
  maxTokens?: number
  variants?: Record<AgentThinkingLevel, Record<string, unknown>>
}

export interface AgentProviderData {
  models: AgentModel[]
  connectedProviders: string[]
  defaultModel: { providerID: string; modelID: string } | null
}

export type AgentProviderAuthType = "api-key" | "oauth"

export interface AgentProvider {
  id: string
  name: string
  connected: boolean
  modelCount: number
  authType: AgentProviderAuthType
}

export interface AgentImageContent {
  type: "image"
  data: string
  mimeType: string
}

export interface AgentPromptQueueState {
  sessionID: string
  steering: string[]
  followUp: string[]
}

export interface AgentMessagePart {
  id: string
  messageID: string
  sessionID: string
  type: "text" | "tool" | "reasoning" | "file" | "step-start" | "step-finish"
  text?: string
  tool?: string
  state?: unknown
  mime?: string
  url?: string
  filename?: string
  provider?: string
  model?: string
}

export interface AgentMessage {
  info: {
    id: string
    sessionID: string
    role: "user" | "assistant"
    time: { created: number; completed?: number }
  }
  parts: AgentMessagePart[]
}

export interface AgentSessionInfo {
  id: string
  cwd: string
  title?: string
}

export interface AgentQuestionOption {
  label: string
  description: string
}

export interface AgentQuestionInfo {
  question: string
  header: string
  options: AgentQuestionOption[]
  multiple?: boolean
}

export interface AgentQuestionRequest {
  id: string
  sessionID: string
  questions: AgentQuestionInfo[]
  tool?: {
    messageID: string
    callID: string
  }
}

export interface AgentTreeNode {
  id: string
  parentId: string | null
  type: string
  role?: "user" | "assistant" | "toolResult"
  label?: string
  text?: string
  timestamp: string
  children: AgentTreeNode[]
}

// Save-dialog options — subset of Electron's SaveDialogOptions that the renderer uses.
export interface SaveDialogOptions {
  defaultPath?: string
  filters?: Array<{ name: string; extensions: string[] }>
}

export interface OpenFilesOptions {
  title?: string
  defaultPath?: string
  filters?: Array<{ name: string; extensions: string[] }>
}

// Menu channel payload.
export type MenuEventId =
  | "settings"
  | "new-design"
  | "new-session"
  | "toggle-sidebar"
  | "toggle-chat"
  | "check-updates"

export type NativeMenuContext = "default" | "session" | "setup"

export interface NativeMenuState {
  context: NativeMenuContext
  rendererReady: boolean
}

// Download progress events consumed by the renderer updater context.
export type UpdateDownloadEvent =
  | { event: "Started"; data: { contentLength?: number } }
  | { event: "Progress"; data: { chunkLength: number; percent?: number } }
  | { event: "Finished" }

export interface UpdateInfo {
  version: string
  currentVersion: string
  body?: string
  date?: string
}
