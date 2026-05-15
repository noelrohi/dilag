import { ipcMain, type BrowserWindow } from "electron"
import { CHANNELS } from "../shared/channels.js"

// Dark ≈ oklch(0.14 0.01 250), light ≈ oklch(0.975 0.008 75).
// BrowserWindow.setBackgroundColor applies NSWindow.backgroundColor on macOS.
const DARK_BG = "#1F2028"
const LIGHT_BG = "#F7F5F2"

export function registerThemeHandlers(getWindow: () => BrowserWindow | null) {
  ipcMain.handle(CHANNELS.theme.setTitlebarTheme, (_event, args: { isDark: boolean }) => {
    if (process.platform !== "darwin") return
    const window = getWindow()
    if (!window) return
    window.setBackgroundColor(args.isDark ? DARK_BG : LIGHT_BG)
  })
}
