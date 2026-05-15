import { contextBridge, ipcRenderer } from "electron"
import type { DesktopBridge } from "@dilag/desktop-bridge"
import { CHANNELS } from "./shared/channels.js"

// Helper for main→renderer event subscriptions. The renderer passes a listener
// and gets back an Unsubscribe; under the hood we attach to ipcRenderer and
// strip the IpcRendererEvent so callers don't see Electron-specific types.
function subscribe<T>(channel: string, listener: (value: T) => void): () => void {
  const handler = (_event: Electron.IpcRendererEvent, value: T) => listener(value)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.off(channel, handler)
}

// Read the bootstrap port out of the chrome-style switch passed from main.ts so
// startup code can read it synchronously before React mounts.
function readBootstrapPort(): number {
  const arg = process.argv.find((a) => a.startsWith("--dilag-bootstrap-port="))
  if (!arg) return 0
  const value = Number(arg.split("=")[1])
  return Number.isFinite(value) ? value : 0
}

const bootstrapPort = readBootstrapPort()
const smokeTest = process.argv.includes("--dilag-smoke-test")

const bridge: DesktopBridge = {
  app: {
    getInfo: () => ipcRenderer.invoke(CHANNELS.app.getInfo),
    resetAllData: () => ipcRenderer.invoke(CHANNELS.app.resetAllData),
  },
  opencode: {
    getPort: () => ipcRenderer.invoke(CHANNELS.opencode.getPort),
    start: () => ipcRenderer.invoke(CHANNELS.opencode.start),
    stop: () => ipcRenderer.invoke(CHANNELS.opencode.stop),
    restart: () => ipcRenderer.invoke(CHANNELS.opencode.restart),
    isRunning: () => ipcRenderer.invoke(CHANNELS.opencode.isRunning),
    checkInstallation: () => ipcRenderer.invoke(CHANNELS.opencode.checkInstallation),
    checkBunInstallation: () => ipcRenderer.invoke(CHANNELS.opencode.checkBunInstallation),
    installDependencies: () => ipcRenderer.invoke(CHANNELS.opencode.installDependencies),
  },
  skills: {
    list: () => ipcRenderer.invoke(CHANNELS.skills.list),
    preview: (args) => ipcRenderer.invoke(CHANNELS.skills.preview, args),
    install: (args) => ipcRenderer.invoke(CHANNELS.skills.install, args),
    remove: (args) => ipcRenderer.invoke(CHANNELS.skills.remove, args),
  },
  sessions: {
    createDir: (args) => ipcRenderer.invoke(CHANNELS.sessions.createDir, args),
    getCwd: () => ipcRenderer.invoke(CHANNELS.sessions.getCwd),
    saveMeta: (args) => ipcRenderer.invoke(CHANNELS.sessions.saveMeta, args),
    loadMeta: () => ipcRenderer.invoke(CHANNELS.sessions.loadMeta),
    deleteMeta: (args) => ipcRenderer.invoke(CHANNELS.sessions.deleteMeta, args),
    toggleFavorite: (args) => ipcRenderer.invoke(CHANNELS.sessions.toggleFavorite, args),
  },
  designs: {
    loadForSession: (args) => ipcRenderer.invoke(CHANNELS.designs.loadForSession, args),
    copyBetweenSessions: (args) => ipcRenderer.invoke(CHANNELS.designs.copyBetweenSessions, args),
    delete: (args) => ipcRenderer.invoke(CHANNELS.designs.delete, args),
    validateHtml: (args) => ipcRenderer.invoke(CHANNELS.designs.validateHtml, args),
    captureHtmlToImage: (args) => ipcRenderer.invoke(CHANNELS.designs.captureHtmlToImage, args),
  },
  project: {
    listFiles: (args) => ipcRenderer.invoke(CHANNELS.project.listFiles, args),
    readFile: (args) => ipcRenderer.invoke(CHANNELS.project.readFile, args),
  },
  theme: {
    setTitlebarTheme: (args) => ipcRenderer.invoke(CHANNELS.theme.setTitlebarTheme, args),
  },
  zoom: {
    get: () => ipcRenderer.invoke(CHANNELS.zoom.get),
    set: (args) => ipcRenderer.invoke(CHANNELS.zoom.set, args),
    in: () => ipcRenderer.invoke(CHANNELS.zoom.in),
    out: () => ipcRenderer.invoke(CHANNELS.zoom.out),
    reset: () => ipcRenderer.invoke(CHANNELS.zoom.reset),
    onChange: (listener) => subscribe<number>(CHANNELS.zoom.changed, listener),
  },
  menu: {
    onEvent: (listener) => subscribe(CHANNELS.menu.event, listener),
  },
  dev: {
    onViteStdout: (listener) => subscribe(CHANNELS.dev.viteStdout, listener),
    onViteError: (listener) => subscribe(CHANNELS.dev.viteError, listener),
  },
  fs: {
    stat: (path) => ipcRenderer.invoke(CHANNELS.fs.stat, path),
    writeFile: (path, data) => ipcRenderer.invoke(CHANNELS.fs.writeFile, path, data),
  },
  dialog: {
    save: (options) => ipcRenderer.invoke(CHANNELS.dialog.save, options),
  },
  shell: {
    openExternal: (url) => ipcRenderer.invoke(CHANNELS.shell.openExternal, url),
  },
  updater: {
    check: () => ipcRenderer.invoke(CHANNELS.updater.check),
    download: async (listener) => {
      const unsubscribe = subscribe(CHANNELS.updater.progress, listener)
      try {
        await ipcRenderer.invoke(CHANNELS.updater.download)
      } finally {
        unsubscribe()
      }
    },
    install: () => ipcRenderer.invoke(CHANNELS.updater.install),
    relaunch: () => ipcRenderer.invoke(CHANNELS.updater.relaunch),
  },
  bootstrap: {
    port: bootstrapPort,
  },
}

contextBridge.exposeInMainWorld("desktopBridge", bridge)

// Compatibility shape for existing `window.__DILAG__.port` reads.
contextBridge.exposeInMainWorld("__DILAG__", { port: bootstrapPort })

if (smokeTest) {
  void ipcRenderer
    .invoke(CHANNELS.opencode.getPort)
    .then((ipcPort) => {
      ipcRenderer.send(CHANNELS.smoke.report, {
        hasBridge: true,
        bootstrapPort,
        ipcPort,
      })
    })
    .catch((error: unknown) => {
      ipcRenderer.send(CHANNELS.smoke.report, {
        hasBridge: false,
        bootstrapPort,
        ipcPort: 0,
        error: error instanceof Error ? error.message : String(error),
      })
    })
}
