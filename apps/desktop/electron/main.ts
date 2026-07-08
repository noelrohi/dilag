import { app, BrowserWindow, ipcMain } from "electron"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { registerThemeHandlers } from "./ipc/theme.js"
import { registerZoomHandlers } from "./ipc/zoom.js"
import { initializeHost, registerHostHandlers, shutdownHost } from "./ipc/host.js"
import { setupApplicationMenu } from "./menu.js"
import { CHANNELS } from "./shared/channels.js"
import type { NativeMenuContext, NativeMenuState } from "@dilag/desktop-bridge"

// Resolve paths relative to the bundled main.cjs (dist-electron/).
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// VITE_DEV_SERVER_URL is injected by the dev launcher when Vite is up.
// Presence signals dev mode; absence signals packaged.
const DEV_URL = process.env.VITE_DEV_SERVER_URL
const SMOKE_TEST = process.env.DILAG_ELECTRON_SMOKE === "1"
const APP_NAME = "Dilag"
const APP_ID = "com.rohi.dilag"

let mainWindow: BrowserWindow | null = null
let applicationMenu: ReturnType<typeof setupApplicationMenu> | null = null

function getMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) {
    return null
  }
  return mainWindow
}

function isNativeMenuContext(value: unknown): value is NativeMenuContext {
  return value === "default" || value === "session" || value === "setup"
}

function normalizeMenuState(value: unknown): NativeMenuState | null {
  if (!value || typeof value !== "object") return null

  const maybeState = value as { context?: unknown; rendererReady?: unknown }
  if (!isNativeMenuContext(maybeState.context)) return null

  return {
    context: maybeState.context,
    rendererReady: maybeState.rendererReady === true,
  }
}

type SmokeReport = {
  hasBridge: boolean
  bootstrapPort: number
  ipcPort: number
  rendererReady?: boolean
  locationHref?: string
  bodyText?: string
  error?: string
}

type RendererSmokeState = Pick<SmokeReport, "bodyText" | "locationHref">

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// IPC handlers registered once at startup. They read the current window via
// this getter so they always target whatever BrowserWindow is live (supports
// window recreation on activate).
registerThemeHandlers(getMainWindow)
const zoomHandlers = registerZoomHandlers(getMainWindow)
registerHostHandlers(getMainWindow)

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

async function waitForRendererSmokeState(timeoutMs = 10_000): Promise<SmokeReport> {
  const deadline = Date.now() + timeoutMs
  let lastState: RendererSmokeState = {}

  while (Date.now() < deadline) {
    const state = (await mainWindow?.webContents.executeJavaScript(
      `({
        bodyText: document.body.innerText.slice(0, 1000),
        locationHref: window.location.href
      })`,
      true,
    )) as RendererSmokeState | undefined

    lastState = state ?? lastState
    const bodyText = state?.bodyText?.trim() ?? ""
    if (bodyText.includes("Not Found")) {
      return {
        hasBridge: false,
        bootstrapPort: 0,
        ipcPort: 0,
        rendererReady: false,
        ...state,
        error: "Renderer routed to Not Found.",
      }
    }
    if (bodyText.length > 0) {
      return {
        hasBridge: true,
        bootstrapPort: 0,
        ipcPort: 0,
        rendererReady: true,
        ...state,
      }
    }

    await delay(250)
  }

  return {
    hasBridge: false,
    bootstrapPort: 0,
    ipcPort: 0,
    rendererReady: false,
    ...lastState,
    error: "Timed out waiting for renderer content.",
  }
}

async function createWindow() {
  const additionalArguments = SMOKE_TEST ? ["--dilag-smoke-test"] : []

  const smokeReport = SMOKE_TEST ? waitForSmokeReport() : null

  const window = new BrowserWindow({
    title: APP_NAME,
    icon: getWindowIconPath(),
    width: 1000,
    height: 700,
    minWidth: 768,
    minHeight: 600,
    show: false,
    // macOS: hide title bar and keep traffic lights inset to match the renderer chrome.
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 15 },
    // Hex approximation of oklch(0.14 0.01 250) used by the renderer's CSS.
    backgroundColor: "#070A0D",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      // Inject runtime flags before any renderer script runs.
      additionalArguments,
    },
  })

  mainWindow = window
  applicationMenu?.refresh()

  window.on("closed", () => {
    if (mainWindow === window) {
      mainWindow = null
      applicationMenu?.setState({ context: "default", rendererReady: false })
      applicationMenu?.refresh()
    }
  })

  window.once("ready-to-show", () => {
    if (window.isDestroyed()) return
    window.maximize()
    window.show()
  })

  if (DEV_URL) {
    await window.loadURL(DEV_URL)
    window.webContents.openDevTools({ mode: "detach" })
  } else {
    // Packaged app: renderer built to ../dist/ relative to the app root.
    const indexHtml = path.join(__dirname, "..", "dist", "index.html")
    await window.loadFile(indexHtml)
  }

  if (SMOKE_TEST) {
    const bridgeResult = await (smokeReport ?? waitForSmokeReport())
    const rendererResult = await waitForRendererSmokeState()
    const result = {
      ...bridgeResult,
      rendererReady: rendererResult.rendererReady,
      locationHref: rendererResult.locationHref,
      bodyText: rendererResult.bodyText,
      error: bridgeResult.error ?? rendererResult.error,
    }
    console.log(`[electron-smoke] ${JSON.stringify(result)}`)
    app.exit(result.hasBridge && result.rendererReady ? 0 : 1)
  }
}

app.whenReady().then(async () => {
  if (process.platform === "darwin") app.dock?.setIcon(getDockIconPath())

  await initializeHost()
  applicationMenu = setupApplicationMenu(getMainWindow, zoomHandlers)
  ipcMain.handle(CHANNELS.menu.setState, (_event, state) => {
    const nextState = normalizeMenuState(state)
    if (!nextState) return
    applicationMenu?.setState(nextState)
  })
  return createWindow()
})

// Fire-and-forget so a hung stop cannot deadlock quit; stopAgentRuntime aborts
// each session's in-flight work and disposes it.
app.on("before-quit", () => {
  void shutdownHost()
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
