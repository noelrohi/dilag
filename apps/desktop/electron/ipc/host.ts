import { app, dialog, ipcMain, shell, type BrowserWindow } from "electron"
import { autoUpdater } from "electron-updater"
import fsp from "node:fs/promises"
import path from "node:path"
import { CHANNELS } from "../shared/channels.js"
import type { UpdateDownloadEvent } from "@dilag/desktop-bridge"
import { copyHtmlFiles, loadDesignsForSession, validateHtml } from "./designs.js"
import {
  checkBunInstallation,
  checkOpencodeInstallation,
  getBootstrapPort,
  initializeOpencodeHost,
  installDependencies,
  isOpencodeRunning,
  restartOpencode,
  startOpencode,
  stopOpencode,
} from "./opencode.js"
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

export { getBootstrapPort }

export function initializeHost() {
  return initializeOpencodeHost()
}

export function registerHostHandlers(getWindow: () => BrowserWindow | null) {
  autoUpdater.autoDownload = false

  ipcMain.handle(CHANNELS.app.getInfo, async () => ({
    version: app.getVersion(),
    data_dir: getDilagDir(),
    data_size_bytes: await calculateDirSize(getDilagDir()),
  }))
  ipcMain.handle(CHANNELS.app.resetAllData, async () => {
    await stopOpencode()
    await fsp.rm(getDilagDir(), { recursive: true, force: true })
    app.relaunch()
    app.exit(0)
  })

  ipcMain.handle(CHANNELS.opencode.getPort, getBootstrapPort)
  ipcMain.handle(CHANNELS.opencode.start, startOpencode)
  ipcMain.handle(CHANNELS.opencode.stop, stopOpencode)
  ipcMain.handle(CHANNELS.opencode.restart, restartOpencode)
  ipcMain.handle(CHANNELS.opencode.isRunning, isOpencodeRunning)
  ipcMain.handle(CHANNELS.opencode.checkInstallation, checkOpencodeInstallation)
  ipcMain.handle(CHANNELS.opencode.checkBunInstallation, checkBunInstallation)
  ipcMain.handle(CHANNELS.opencode.installDependencies, installDependencies)

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

  ipcMain.handle(CHANNELS.designs.loadForSession, (_event, args: { sessionCwd: string }) =>
    loadDesignsForSession(args.sessionCwd),
  )
  ipcMain.handle(
    CHANNELS.designs.copyBetweenSessions,
    (_event, args: { sourceCwd: string; destCwd: string }) =>
      copyHtmlFiles(path.join(args.sourceCwd, "screens"), path.join(args.destCwd, "screens")),
  )
  ipcMain.handle(CHANNELS.designs.delete, (_event, args: { filePath: string }) =>
    fsp.rm(args.filePath),
  )
  ipcMain.handle(CHANNELS.designs.validateHtml, (_event, args: { html: string }) =>
    validateHtml(args.html),
  )
  ipcMain.handle(CHANNELS.designs.captureHtmlToImage, () => {
    throw new Error("Native capture not supported. Use html2canvas fallback.")
  })

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
  ipcMain.handle(CHANNELS.shell.openExternal, (_event, url: string) => shell.openExternal(url))

  ipcMain.handle(CHANNELS.updater.check, async () => {
    const result = await autoUpdater.checkForUpdates()
    const info = result?.updateInfo
    return info
      ? {
          version: info.version,
          currentVersion: app.getVersion(),
          body: info.releaseNotes?.toString(),
          date: info.releaseDate,
        }
      : null
  })
  ipcMain.handle(CHANNELS.updater.download, async () => {
    const window = getWindow()
    let transferred = 0
    autoUpdater.on("download-progress", (progress) => {
      const chunkLength = Math.max(0, progress.transferred - transferred)
      transferred = progress.transferred
      window?.webContents.send(CHANNELS.updater.progress, {
        event: "Progress",
        data: { chunkLength },
      } satisfies UpdateDownloadEvent)
    })
    window?.webContents.send(CHANNELS.updater.progress, {
      event: "Started",
      data: {},
    } satisfies UpdateDownloadEvent)
    await autoUpdater.downloadUpdate()
    window?.webContents.send(CHANNELS.updater.progress, {
      event: "Finished",
    } satisfies UpdateDownloadEvent)
  })
  ipcMain.handle(CHANNELS.updater.install, () => autoUpdater.quitAndInstall())
  ipcMain.handle(CHANNELS.updater.relaunch, () => {
    app.relaunch()
    app.exit(0)
  })
}
