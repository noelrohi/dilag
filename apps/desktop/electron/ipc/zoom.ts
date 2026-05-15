import { ipcMain, type BrowserWindow } from "electron"
import { CHANNELS } from "../shared/channels.js"

// Zoom bounds are part of the user-visible desktop contract.
const ZOOM_STEP = 0.1
const MIN_ZOOM = 0.5
const MAX_ZOOM = 2.0
const DEFAULT_ZOOM = 1.0

// Cache the last value so CHANNELS.zoom.get can respond before the window is ready.
let lastKnownZoom = DEFAULT_ZOOM

function clamp(level: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, level))
}

export function registerZoomHandlers(getWindow: () => BrowserWindow | null) {
  function apply(level: number): number {
    const clamped = clamp(level)
    const window = getWindow()
    if (window) {
      window.webContents.setZoomFactor(clamped)
      // Broadcast so menu-driven zoom changes reach useZoom() in the renderer.
      window.webContents.send(CHANNELS.zoom.changed, clamped)
    }
    lastKnownZoom = clamped
    return clamped
  }

  ipcMain.handle(CHANNELS.zoom.get, () => {
    const window = getWindow()
    if (window) {
      lastKnownZoom = window.webContents.getZoomFactor()
    }
    return lastKnownZoom
  })

  ipcMain.handle(CHANNELS.zoom.set, (_event, args: { level: number }) => apply(args.level))
  ipcMain.handle(CHANNELS.zoom.in, () => apply(lastKnownZoom + ZOOM_STEP))
  ipcMain.handle(CHANNELS.zoom.out, () => apply(lastKnownZoom - ZOOM_STEP))
  ipcMain.handle(CHANNELS.zoom.reset, () => apply(DEFAULT_ZOOM))

  // Expose apply so menu accelerators can drive zoom changes without IPC.
  return { apply }
}
