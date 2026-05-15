import { app, BrowserWindow, ipcMain } from "electron"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { registerThemeHandlers } from "./ipc/theme.js"
import { registerZoomHandlers } from "./ipc/zoom.js"
import { getBootstrapPort, initializeHost, registerHostHandlers } from "./ipc/host.js"
import { setupApplicationMenu } from "./menu.js"
import { CHANNELS } from "./shared/channels.js"

// Resolve paths relative to the bundled main.cjs (dist-electron/).
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// VITE_DEV_SERVER_URL is injected by the dev launcher when Vite is up.
// Presence signals dev mode; absence signals packaged.
const DEV_URL = process.env.VITE_DEV_SERVER_URL
const SMOKE_TEST = process.env.DILAG_ELECTRON_SMOKE === "1"
const APP_NAME = "Dilag"
const APP_ID = "com.rohi.dilag"

let mainWindow: BrowserWindow | null = null

type SmokeReport = {
  hasBridge: boolean
  bootstrapPort: number
  ipcPort: number
  error?: string
}

// IPC handlers registered once at startup. They read the current window via
// this getter so they always target whatever BrowserWindow is live (supports
// window recreation on activate).
registerThemeHandlers(() => mainWindow)
const zoomHandlers = registerZoomHandlers(() => mainWindow)
registerHostHandlers(() => mainWindow)

app.setName(APP_NAME)
app.setAppUserModelId(APP_ID)

function getWindowIconPath() {
  const resourcesRoot = app.isPackaged
    ? process.resourcesPath
    : path.join(__dirname, "..", "resources")

  if (process.platform === "win32") return path.join(resourcesRoot, "icons", "icon.ico")
  if (process.platform === "linux") return path.join(resourcesRoot, "icons", "icon.png")
  return path.join(resourcesRoot, "icons", "icon.icns")
}

function getDockIconPath() {
  const resourcesRoot = app.isPackaged
    ? process.resourcesPath
    : path.join(__dirname, "..", "resources")

  return path.join(resourcesRoot, "icons", "icon.png")
}

function waitForSmokeReport(timeoutMs = 10_000): Promise<SmokeReport> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      ipcMain.removeAllListeners(CHANNELS.smoke.report)
      resolve({
        hasBridge: false,
        bootstrapPort: 0,
        ipcPort: 0,
        error: "Timed out waiting for preload smoke report.",
      })
    }, timeoutMs)

    ipcMain.once(CHANNELS.smoke.report, (_event, report: SmokeReport) => {
      clearTimeout(timer)
      resolve(report)
    })
  })
}

async function createWindow() {
  const additionalArguments = [`--dilag-bootstrap-port=${getBootstrapPort()}`]
  if (SMOKE_TEST) additionalArguments.push("--dilag-smoke-test")

  const smokeReport = SMOKE_TEST ? waitForSmokeReport() : null

  mainWindow = new BrowserWindow({
    title: APP_NAME,
    icon: getWindowIconPath(),
    width: 1000,
    height: 700,
    minWidth: 768,
    minHeight: 600,
    show: false,
    // macOS: hide title bar and keep traffic lights inset to match the renderer chrome.
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 18 },
    // Hex approximation of oklch(0.14 0.01 250) used by the renderer's CSS.
    backgroundColor: "#070A0D",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      // Inject bootstrap values before any renderer script runs so
      // window.__DILAG__ is set synchronously for legacy consumers.
      additionalArguments,
    },
  })

  mainWindow.once("ready-to-show", () => {
    mainWindow?.maximize()
    mainWindow?.show()
  })

  if (DEV_URL) {
    await mainWindow.loadURL(DEV_URL)
    mainWindow.webContents.openDevTools({ mode: "detach" })
  } else {
    // Packaged app: renderer built to ../dist/ relative to the app root.
    const indexHtml = path.join(__dirname, "..", "dist", "index.html")
    await mainWindow.loadFile(indexHtml)
  }

  if (SMOKE_TEST) {
    const result = await (smokeReport ?? waitForSmokeReport())
    console.log(`[electron-smoke] ${JSON.stringify(result)}`)
    app.exit(
      result.hasBridge && result.bootstrapPort > 0 && result.bootstrapPort === result.ipcPort
        ? 0
        : 1,
    )
  }
}

app.whenReady().then(async () => {
  if (process.platform === "darwin") app.dock?.setIcon(getDockIconPath())

  await initializeHost()
  setupApplicationMenu(() => mainWindow, zoomHandlers.apply)
  return createWindow()
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
