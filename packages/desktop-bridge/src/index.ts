// The DesktopBridge contract shared by:
//   - the Electron preload (implements it, exposed via contextBridge)
//   - the renderer (consumes it via window.desktopBridge)
//
// Keep method names matched to the product domain rather than to IPC channel
// strings, so the transport can change without touching renderer call sites.

import type {
  AppInfo,
  DesignFile,
  FileNode,
  MenuEventId,
  SaveDialogOptions,
  SessionMeta,
  SkillInfo,
  SkillInstallResult,
  SkillPreviewResult,
  UpdateDownloadEvent,
  UpdateInfo,
} from "./types.js"

export type Unsubscribe = () => void

export interface DesktopBridge {
  app: {
    getInfo(): Promise<AppInfo>
    resetAllData(): Promise<void>
  }

  opencode: {
    getPort(): Promise<number>
    start(): Promise<number>
    stop(): Promise<void>
    restart(): Promise<number>
    isRunning(): Promise<boolean>
    checkInstallation(): Promise<unknown>
    checkBunInstallation(): Promise<unknown>
    installDependencies(): Promise<unknown>
  }

  skills: {
    list(): Promise<SkillInfo[]>
    preview(args: { source: string }): Promise<SkillPreviewResult>
    install(args: { source: string; skillNames: string[] }): Promise<SkillInstallResult>
    remove(args: { skillName: string }): Promise<void>
  }

  sessions: {
    createDir(args: { sessionId: string }): Promise<string>
    getCwd(): Promise<string>
    saveMeta(args: { session: SessionMeta }): Promise<void>
    loadMeta(): Promise<SessionMeta[]>
    deleteMeta(args: { sessionId: string }): Promise<void>
    toggleFavorite(args: { sessionId: string }): Promise<boolean>
  }

  designs: {
    loadForSession(args: { sessionCwd: string }): Promise<DesignFile[]>
    copyBetweenSessions(args: { sourceCwd: string; destCwd: string }): Promise<void>
    delete(args: { filePath: string }): Promise<void>
    validateHtml(args: { html: string }): Promise<unknown>
    captureHtmlToImage(args: { html: string }): Promise<unknown>
  }

  project: {
    listFiles(args: { sessionCwd: string }): Promise<FileNode[]>
    readFile(args: { sessionCwd: string; filePath: string }): Promise<string>
  }

  theme: {
    setTitlebarTheme(args: { isDark: boolean }): Promise<void>
  }

  zoom: {
    get(): Promise<number>
    set(args: { level: number }): Promise<number>
    in(): Promise<number>
    out(): Promise<number>
    reset(): Promise<number>
    onChange(listener: (level: number) => void): Unsubscribe
  }

  menu: {
    onEvent(listener: (id: MenuEventId) => void): Unsubscribe
  }

  // Dev-server log forwarding. Only wired in dev; in prod these subscribe and
  // never receive events (the overlay component accepts that).
  dev: {
    onViteStdout(listener: (line: string) => void): Unsubscribe
    onViteError(listener: (line: string) => void): Unsubscribe
  }

  fs: {
    stat(path: string): Promise<{ size: number; mtimeMs: number; isFile: boolean; isDir: boolean }>
    writeFile(path: string, data: Uint8Array): Promise<void>
  }

  dialog: {
    save(options: SaveDialogOptions): Promise<string | null>
  }

  shell: {
    openExternal(url: string): Promise<void>
  }

  updater: {
    check(): Promise<UpdateInfo | null>
    download(listener: (event: UpdateDownloadEvent) => void): Promise<void>
    install(): Promise<void>
    relaunch(): Promise<void>
  }

  // Synchronous bootstrap values exposed during preload, before React mounts.
  bootstrap: {
    port: number
  }
}

export type {
  AppInfo,
  DesignFile,
  FileNode,
  MenuEventId,
  SaveDialogOptions,
  SessionMeta,
  SkillInfo,
  SkillInstallResult,
  SkillPreviewResult,
  UpdateDownloadEvent,
  UpdateInfo,
  Violation,
  ViolationRule,
  Platform,
} from "./types.js"

export type { SkillPreview } from "./types.js"

declare global {
  interface Window {
    desktopBridge?: DesktopBridge
    __DILAG__?: { port: number }
  }
}
