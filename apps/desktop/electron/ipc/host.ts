import { app, dialog, ipcMain, shell, type BrowserWindow } from "electron"
import { autoUpdater, type ProgressInfo } from "electron-updater"
import fsp from "node:fs/promises"
import { CHANNELS } from "../shared/channels.js"
import {
  getCanonicalGeneratedScreenDirectory,
  type UpdateDownloadEvent,
} from "@dilag/desktop-bridge"
import { isNewerAppVersion } from "../../src/lib/version.js"
import {
  copyHtmlFiles,
  duplicateDesign,
  importDesigns,
  loadDesignsForSession,
  renameDesign,
  validateHtml,
  writeDesign,
} from "./designs.js"
import {
  abortAgentSession,
  clearAgentPromptQueue,
  createAgentSessionForDirectory,
  deleteAgentSession,
  forkAgentSession,
  getAgentMessages,
  getAgentProviderData,
  getAgentRuntimeInfo,
  getAgentSession,
  getAgentTree,
  isAgentRuntimeRunning,
  listAgentProviders,
  listAgentQuestions,
  listAgentSessions,
  loginAgentOAuthProvider,
  navigateAgentTree,
  promptAgentSession,
  rejectAgentQuestion,
  releaseAgentSessionsForDirectory,
  renameAgentSession,
  replyAgentQuestion,
  restartAgentRuntime,
  setAgentApiKey,
  setAgentEventSender,
  startAgentRuntime,
  stopAgentRuntime,
} from "./pi.js"
import { getDilagDir } from "./paths.js"
import { listProjectFiles, readProjectFile } from "./project.js"
import { calculateDirSize } from "./storage.js"
import {
  createSessionDir,
  deleteSessionMeta,
  getSessionCwd,
  loadSessionsMeta,
  saveSessionMeta,
  toggleSessionFavorite,
} from "./sessions.js"
import { installSkills, listInstalledSkills, previewSkills, removeSkill } from "./skills.js"
import {
  addExistingProject,
  createProject,
  dismissLegacySessionsNotice,
  getLegacySessionsNotice,
  getProjectById,
  importLegacySessions,
  listProjects,
  removeProject,
  touchProject,
  updateProject,
} from "./projects.js"

export function initializeHost() {
  return startAgentRuntime()
}

// Called from the main process `before-quit` hook. Fire-and-forget: it aborts
// and disposes every live agent session so in-flight work stops on quit.
export function shutdownHost(): Promise<void> {
  return stopAgentRuntime()
}

export function registerHostHandlers(getWindow: () => BrowserWindow | null) {
  autoUpdater.autoDownload = false
  setAgentEventSender((channel, event) => getWindow()?.webContents.send(channel, event))

  ipcMain.handle(CHANNELS.app.getInfo, async () => ({
    version: app.getVersion(),
    data_dir: getDilagDir(),
    data_size_bytes: await calculateDirSize(getDilagDir()),
  }))
  ipcMain.handle(CHANNELS.app.resetAllData, async () => {
    await stopAgentRuntime()
    await fsp.rm(getDilagDir(), { recursive: true, force: true })
    app.relaunch()
    app.exit(0)
  })

  ipcMain.handle(CHANNELS.agent.getInfo, getAgentRuntimeInfo)
  ipcMain.handle(CHANNELS.agent.start, startAgentRuntime)
  ipcMain.handle(CHANNELS.agent.stop, stopAgentRuntime)
  ipcMain.handle(CHANNELS.agent.restart, restartAgentRuntime)
  ipcMain.handle(CHANNELS.agent.isRunning, isAgentRuntimeRunning)
  ipcMain.handle(CHANNELS.agent.getProviderData, getAgentProviderData)
  ipcMain.handle(CHANNELS.agent.listProviders, listAgentProviders)
  ipcMain.handle(CHANNELS.agent.setApiKey, (_event, args: { providerID: string; apiKey: string }) =>
    setAgentApiKey(args),
  )
  ipcMain.handle(CHANNELS.agent.loginOAuthProvider, (_event, args: { providerID: string }) =>
    loginAgentOAuthProvider(args, (url) => shell.openExternal(url)),
  )
  ipcMain.handle(CHANNELS.agent.createSession, (_event, args: { directory: string }) =>
    createAgentSessionForDirectory(args),
  )
  ipcMain.handle(CHANNELS.agent.listSessions, (_event, args: { directory: string }) =>
    listAgentSessions(args),
  )
  ipcMain.handle(
    CHANNELS.agent.getSession,
    (_event, args: { sessionID: string; directory: string }) => getAgentSession(args),
  )
  ipcMain.handle(
    CHANNELS.agent.getMessages,
    (_event, args: { sessionID: string; directory: string }) => getAgentMessages(args),
  )
  ipcMain.handle(
    CHANNELS.agent.prompt,
    (
      _event,
      args: {
        sessionID: string
        directory: string
        text: string
        images?: Array<{ type: "image"; data: string; mimeType: string }>
        model?: { providerID: string; modelID: string } | null
        thinkingLevel?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max"
        streamingBehavior?: "steer" | "followUp"
      },
    ) => promptAgentSession(args),
  )
  ipcMain.handle(CHANNELS.agent.abort, (_event, args: { sessionID: string }) =>
    abortAgentSession(args),
  )
  ipcMain.handle(CHANNELS.agent.clearQueue, (_event, args: { sessionID: string }) =>
    clearAgentPromptQueue(args),
  )
  ipcMain.handle(
    CHANNELS.agent.renameSession,
    (_event, args: { sessionID: string; name: string; directory?: string }) =>
      renameAgentSession(args),
  )
  ipcMain.handle(
    CHANNELS.agent.deleteSession,
    (_event, args: { sessionID: string; directory?: string }) => deleteAgentSession(args),
  )
  ipcMain.handle(CHANNELS.agent.listQuestions, listAgentQuestions)
  ipcMain.handle(
    CHANNELS.agent.replyQuestion,
    (_event, args: { requestID: string; answers: string[][] }) => replyAgentQuestion(args),
  )
  ipcMain.handle(CHANNELS.agent.rejectQuestion, (_event, args: { requestID: string }) =>
    rejectAgentQuestion(args),
  )
  ipcMain.handle(CHANNELS.agent.getTree, (_event, args: { sessionID: string }) =>
    getAgentTree(args),
  )
  ipcMain.handle(
    CHANNELS.agent.forkSession,
    (_event, args: { sessionID: string; targetId: string }) => forkAgentSession(args),
  )
  ipcMain.handle(
    CHANNELS.agent.navigateTree,
    (
      _event,
      args: {
        sessionID: string
        targetId: string
        summarize?: boolean
        customInstructions?: string
        replaceInstructions?: boolean
        label?: string
      },
    ) => navigateAgentTree(args),
  )

  ipcMain.handle(CHANNELS.sessions.createDir, (_event, args: { sessionId: string }) =>
    createSessionDir(args.sessionId),
  )
  ipcMain.handle(CHANNELS.sessions.getCwd, (_event, args?: { sessionId?: string }) =>
    getSessionCwd(args?.sessionId),
  )
  ipcMain.handle(CHANNELS.sessions.loadMeta, loadSessionsMeta)
  ipcMain.handle(
    CHANNELS.sessions.saveMeta,
    (_event, args: { session: Parameters<typeof saveSessionMeta>[0] }) =>
      saveSessionMeta(args.session),
  )
  ipcMain.handle(CHANNELS.sessions.deleteMeta, (_event, args: { sessionId: string }) =>
    deleteSessionMeta(args.sessionId),
  )
  ipcMain.handle(CHANNELS.sessions.toggleFavorite, (_event, args: { sessionId: string }) =>
    toggleSessionFavorite(args.sessionId),
  )

  ipcMain.handle(CHANNELS.projects.list, listProjects)
  ipcMain.handle(CHANNELS.projects.create, (_event, args: Parameters<typeof createProject>[0]) =>
    createProject(args),
  )
  ipcMain.handle(
    CHANNELS.projects.addExisting,
    (_event, args: Parameters<typeof addExistingProject>[0]) => addExistingProject(args),
  )
  ipcMain.handle(CHANNELS.projects.update, (_event, args: Parameters<typeof updateProject>[0]) =>
    updateProject(args),
  )
  ipcMain.handle(CHANNELS.projects.remove, (_event, args: Parameters<typeof removeProject>[0]) => {
    // Release any live runtime sessions rooted at the project before its row is
    // deleted, so eviction does not depend on the project still existing.
    const project = getProjectById(args.id)
    if (project) releaseAgentSessionsForDirectory(project.path)
    removeProject(args)
  })
  ipcMain.handle(CHANNELS.projects.touch, (_event, args: Parameters<typeof touchProject>[0]) =>
    touchProject(args),
  )
  ipcMain.handle(CHANNELS.projects.getLegacyNotice, getLegacySessionsNotice)
  ipcMain.handle(CHANNELS.projects.importLegacy, importLegacySessions)
  ipcMain.handle(CHANNELS.projects.dismissLegacyNotice, dismissLegacySessionsNotice)

  ipcMain.handle(CHANNELS.designs.loadForSession, (_event, args: { sessionCwd: string }) =>
    loadDesignsForSession(args.sessionCwd),
  )
  ipcMain.handle(
    CHANNELS.designs.copyBetweenSessions,
    async (_event, args: { sourceCwd: string; destCwd: string }) => {
      await copyHtmlFiles(
        getCanonicalGeneratedScreenDirectory(args.sourceCwd),
        getCanonicalGeneratedScreenDirectory(args.destCwd),
      )
    },
  )
  ipcMain.handle(CHANNELS.designs.delete, (_event, args: { filePath: string }) =>
    fsp.rm(args.filePath, { force: true }),
  )
  ipcMain.handle(CHANNELS.designs.validateHtml, (_event, args: { html: string }) =>
    validateHtml(args.html),
  )
  ipcMain.handle(
    CHANNELS.designs.import,
    (_event, args: { sessionCwd: string; filePaths: string[] }) => importDesigns(args),
  )
  ipcMain.handle(
    CHANNELS.designs.write,
    (_event, args: { sessionCwd: string; filename: string; html: string }) => writeDesign(args),
  )
  ipcMain.handle(
    CHANNELS.designs.rename,
    (_event, args: { sessionCwd: string; from: string; to: string }) => renameDesign(args),
  )
  ipcMain.handle(
    CHANNELS.designs.duplicate,
    (_event, args: { sessionCwd: string; filename: string }) => duplicateDesign(args),
  )

  ipcMain.handle(CHANNELS.project.listFiles, (_event, args: { sessionCwd: string }) =>
    listProjectFiles(args.sessionCwd),
  )
  ipcMain.handle(
    CHANNELS.project.readFile,
    (_event, args: { sessionCwd: string; filePath: string }) =>
      readProjectFile(args.sessionCwd, args.filePath),
  )

  ipcMain.handle(CHANNELS.skills.list, listInstalledSkills)
  ipcMain.handle(CHANNELS.skills.preview, (_event, args: { source: string }) =>
    previewSkills(args.source),
  )
  ipcMain.handle(
    CHANNELS.skills.install,
    (_event, args: { source: string; skillNames: string[] }) =>
      installSkills(args.source, args.skillNames),
  )
  ipcMain.handle(CHANNELS.skills.remove, (_event, args: { skillName: string }) =>
    removeSkill(args.skillName),
  )

  ipcMain.handle(CHANNELS.fs.stat, async (_event, filePath: string) => {
    const stat = await fsp.stat(filePath)
    return {
      size: stat.size,
      mtimeMs: stat.mtimeMs,
      isFile: stat.isFile(),
      isDir: stat.isDirectory(),
    }
  })
  ipcMain.handle(CHANNELS.fs.writeFile, (_event, filePath: string, data: Uint8Array) =>
    fsp.writeFile(filePath, data),
  )
  ipcMain.handle(CHANNELS.dialog.save, async (_event, options: Electron.SaveDialogOptions) => {
    const window = getWindow()
    const result = window
      ? await dialog.showSaveDialog(window, options)
      : await dialog.showSaveDialog(options)
    return result.canceled ? null : (result.filePath ?? null)
  })
  ipcMain.handle(CHANNELS.dialog.openDirectory, async () => {
    const window = getWindow()
    const result = window
      ? await dialog.showOpenDialog(window, { properties: ["openDirectory", "createDirectory"] })
      : await dialog.showOpenDialog({ properties: ["openDirectory", "createDirectory"] })
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })
  ipcMain.handle(
    CHANNELS.dialog.openFiles,
    async (_event, options?: Electron.OpenDialogOptions) => {
      const dialogOptions: Electron.OpenDialogOptions = {
        title: "Import HTML files",
        filters: [{ name: "HTML files", extensions: ["html", "htm"] }],
        ...options,
        properties: ["openFile", "multiSelections"],
      }
      const window = getWindow()
      const result = window
        ? await dialog.showOpenDialog(window, dialogOptions)
        : await dialog.showOpenDialog(dialogOptions)
      return result.canceled ? null : result.filePaths
    },
  )
  ipcMain.handle(CHANNELS.shell.openExternal, (_event, url: string) => shell.openExternal(url))
  ipcMain.handle(CHANNELS.shell.openPath, async (_event, filePath: string) => {
    const error = await shell.openPath(filePath)
    if (error) throw new Error(error)
  })
  ipcMain.handle(CHANNELS.shell.showItemInFolder, (_event, filePath: string) => {
    shell.showItemInFolder(filePath)
  })

  ipcMain.handle(CHANNELS.updater.check, async () => {
    const result = await autoUpdater.checkForUpdates()
    const info = result?.updateInfo
    const currentVersion = app.getVersion()
    if (!info || !isNewerAppVersion(info.version, currentVersion)) {
      return null
    }

    return {
      version: info.version,
      currentVersion,
      body: info.releaseNotes?.toString(),
      date: info.releaseDate,
    }
  })
  ipcMain.handle(CHANNELS.updater.download, async () => {
    const window = getWindow()
    let transferred = 0
    const handleProgress = (progress: ProgressInfo) => {
      const chunkLength = Math.max(0, progress.transferred - transferred)
      transferred = progress.transferred
      window?.webContents.send(CHANNELS.updater.progress, {
        event: "Progress",
        data: { chunkLength, percent: progress.percent },
      } satisfies UpdateDownloadEvent)
    }

    autoUpdater.on("download-progress", handleProgress)
    window?.webContents.send(CHANNELS.updater.progress, {
      event: "Started",
      data: {},
    } satisfies UpdateDownloadEvent)

    try {
      await autoUpdater.downloadUpdate()
      window?.webContents.send(CHANNELS.updater.progress, {
        event: "Finished",
      } satisfies UpdateDownloadEvent)
    } finally {
      autoUpdater.off("download-progress", handleProgress)
    }
  })
  ipcMain.handle(CHANNELS.updater.install, () => autoUpdater.quitAndInstall())
  ipcMain.handle(CHANNELS.updater.relaunch, () => {
    app.relaunch()
    app.exit(0)
  })
}
