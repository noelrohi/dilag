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
  title: string
  screen_type: string
  html: string
  modified_at: number
  violations: Violation[]
}

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

// Save-dialog options — subset of Electron's SaveDialogOptions that the renderer uses.
export interface SaveDialogOptions {
  defaultPath?: string
  filters?: Array<{ name: string; extensions: string[] }>
}

// Menu channel payload.
export type MenuEventId =
  | "settings"
  | "new-session"
  | "toggle-sidebar"
  | "toggle-chat"
  | "check-updates"

// Download progress events consumed by the renderer updater context.
export type UpdateDownloadEvent =
  | { event: "Started"; data: { contentLength?: number } }
  | { event: "Progress"; data: { chunkLength: number } }
  | { event: "Finished" }

export interface UpdateInfo {
  version: string
  currentVersion: string
  body?: string
  date?: string
}
