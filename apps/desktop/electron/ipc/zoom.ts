import { ipcMain, type BrowserWindow } from "electron"
import { CHANNELS } from "../shared/channels.js"

// Zoom bounds are part of the user-visible desktop contract.
const ZOOM_STEP = 0.1
const MIN_ZOOM = 0.5
const MAX_ZOOM = 2.0
const DEFAULT_ZOOM = 1.0

// Cache the last value so CHANNELS.zoom.get can respond before the window is ready.
let lastKnownZoom = DEFAULT_ZOOM

function normalize(level: number) {
  return Math.round(level * 100) / 100
}

function clamp(level: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, normalize(level)))
}

function isUsableWindow(window: BrowserWindow | null): window is BrowserWindow {
  return Boolean(window && !window.isDestroyed() && !window.webContents.isDestroyed())
}

export function registerZoomHandlers(getWindow: () => BrowserWindow | null) {
  function readCurrentZoom() {
    const window = getWindow()
    if (isUsableWindow(window)) {
      lastKnownZoom = window.webContents.getZoomFactor()
    }
    return lastKnownZoom
  }

  function apply(level: number): number {
    const clamped = clamp(level)
    const window = getWindow()
    if (isUsableWindow(window)) {
      window.webContents.setZoomFactor(clamped)
      // Broadcast so menu-driven zoom changes reach useZoom() in the renderer.
      window.webContents.send(CHANNELS.zoom.changed, clamped)
    }
    lastKnownZoom = clamped
    return clamped
  }

  const zoomIn = () => apply(readCurrentZoom() + ZOOM_STEP)
  const zoomOut = () => apply(readCurrentZoom() - ZOOM_STEP)
  const reset = () => apply(DEFAULT_ZOOM)

  ipcMain.handle(CHANNELS.zoom.get, () => readCurrentZoom())
  ipcMain.handle(CHANNELS.zoom.set, (_event, args: { level: number }) => apply(args.level))
  ipcMain.handle(CHANNELS.zoom.in, zoomIn)
  ipcMain.handle(CHANNELS.zoom.out, zoomOut)
  ipcMain.handle(CHANNELS.zoom.reset, reset)

  // Expose controls so menu accelerators can drive zoom changes without IPC.
  return { apply, zoomIn, zoomOut, reset }
}
