// The DesktopBridge contract shared by:
//   - the Electron preload (implements it, exposed via contextBridge)
//   - the renderer (consumes it via window.desktopBridge)
//
// Keep method names matched to the product domain rather than to IPC channel
// strings, so the transport can change without touching renderer call sites.

import type {
  AppInfo,
  AgentImageContent,
  AgentMessage,
  AgentPromptQueueState,
  AgentProvider,
  AgentProviderData,
  AgentQuestionRequest,
  AgentRuntimeInfo,
  AgentSessionInfo,
  AgentSessionSummary,
  AgentThinkingLevel,
  AgentTreeNode,
  DesignFile,
  FileNode,
  MenuEventId,
  NativeMenuState,
  Platform,
  ProjectMeta,
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

  agent: {
    getInfo(): Promise<AgentRuntimeInfo>
    start(): Promise<AgentRuntimeInfo>
    stop(): Promise<void>
    restart(): Promise<AgentRuntimeInfo>
    isRunning(): Promise<boolean>
    getProviderData(): Promise<AgentProviderData>
    listProviders(): Promise<AgentProvider[]>
    setApiKey(args: { providerID: string; apiKey: string }): Promise<void>
    loginOAuthProvider(args: { providerID: string }): Promise<void>
    createSession(args: { directory: string }): Promise<AgentSessionInfo>
    listSessions(args: { directory: string }): Promise<AgentSessionSummary[]>
    getSession(args: { sessionID: string; directory: string }): Promise<AgentSessionInfo>
    getMessages(args: { sessionID: string; directory: string }): Promise<AgentMessage[]>
    prompt(args: {
      sessionID: string
      directory: string
      text: string
      images?: AgentImageContent[]
      model?: { providerID: string; modelID: string } | null
      thinkingLevel?: AgentThinkingLevel
      streamingBehavior?: "steer" | "followUp"
    }): Promise<void>
    abort(args: { sessionID: string }): Promise<void>
    clearQueue(args: { sessionID: string }): Promise<AgentPromptQueueState>
    renameSession(args: { sessionID: string; name: string; directory?: string }): Promise<void>
    deleteSession(args: { sessionID: string; directory?: string }): Promise<void>
    listQuestions(): Promise<AgentQuestionRequest[]>
    replyQuestion(args: { requestID: string; answers: string[][] }): Promise<void>
    rejectQuestion(args: { requestID: string }): Promise<void>
    getTree(args: { sessionID: string }): Promise<AgentTreeNode[]>
    forkSession(args: { sessionID: string; targetId: string }): Promise<AgentSessionInfo>
    navigateTree(args: {
      sessionID: string
      targetId: string
      summarize?: boolean
      customInstructions?: string
      replaceInstructions?: boolean
      label?: string
    }): Promise<{ editorText?: string; cancelled: boolean; aborted?: boolean }>
    onEvent(listener: (event: unknown) => void): Unsubscribe
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

  projects: {
    list(): Promise<ProjectMeta[]>
    create(args: { name: string; platform?: Platform }): Promise<ProjectMeta>
    addExisting(args: { path: string; platform?: Platform }): Promise<ProjectMeta>
    update(args: {
      id: string
      updates: Partial<Pick<ProjectMeta, "name" | "platform" | "pinned" | "expanded">>
    }): Promise<ProjectMeta>
    remove(args: { id: string }): Promise<void>
    touch(args: { id: string }): Promise<ProjectMeta>
    getLegacyNotice(): Promise<{ hasLegacySessions: boolean; dismissed: boolean }>
    dismissLegacyNotice(): Promise<void>
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
    setState(state: NativeMenuState): Promise<void>
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
    openDirectory(): Promise<string | null>
  }

  shell: {
    openExternal(url: string): Promise<void>
    openPath(path: string): Promise<void>
    showItemInFolder(path: string): Promise<void>
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
  AgentImageContent,
  AgentMessage,
  AgentMessagePart,
  AgentModel,
  AgentProvider,
  AgentProviderData,
  AgentPromptQueueState,
  AgentQuestionInfo,
  AgentQuestionOption,
  AgentQuestionRequest,
  AgentRuntimeInfo,
  AgentSessionInfo,
  AgentSessionSummary,
  AgentThinkingLevel,
  AgentTreeNode,
  DesignFile,
  FileNode,
  MenuEventId,
  NativeMenuContext,
  NativeMenuState,
  ProjectMeta,
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

export {
  GENERATED_SCREEN_CANONICAL_DIR,
  GENERATED_SCREEN_EXTENSION,
  GENERATED_SCREEN_LEGACY_FALLBACK_DIRS,
  classifyGeneratedScreenFile,
  getCanonicalGeneratedScreenDirectory,
  getCanonicalGeneratedScreenPath,
  getGeneratedScreenDirectories,
  getGeneratedScreenFallbackKey,
  getGeneratedScreenSearchDirectories,
  isGeneratedScreenFile,
  renderGeneratedScreenOutputRules,
  renderGeneratedScreenSystemPromptRules,
  renderHtmlScreenContract,
} from "./generated-screen-policy.ts"

export type {
  GeneratedScreenDirectory,
  GeneratedScreenDirectoryKind,
  GeneratedScreenFileMatch,
} from "./generated-screen-policy.ts"

declare global {
  interface Window {
    desktopBridge?: DesktopBridge
    __DILAG__?: { port: number }
  }
}
