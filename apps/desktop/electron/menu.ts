import { Menu, nativeImage, shell, type BrowserWindow } from "electron"
import { CHANNELS } from "./shared/channels.js"
import type { MenuEventId, NativeMenuState } from "@dilag/desktop-bridge"

export interface ZoomMenuControls {
  zoomIn: () => number
  zoomOut: () => number
  reset: () => number
}

const DEFAULT_MENU_STATE: NativeMenuState = {
  context: "default",
  rendererReady: false,
}
const MAC_MENU_ICON_SIZE = 14
const macMenuIconCache = new Map<string, Electron.NativeImage | null>()

function isUsableWindow(window: BrowserWindow | null): window is BrowserWindow {
  return Boolean(window && !window.isDestroyed() && !window.webContents.isDestroyed())
}

function send(window: BrowserWindow | null, id: MenuEventId) {
  if (!isUsableWindow(window)) return
  window.webContents.send(CHANNELS.menu.event, id)
}

function getMacMenuIcon(name: string) {
  if (process.platform !== "darwin") return null
  if (macMenuIconCache.has(name)) return macMenuIconCache.get(name) ?? null

  const source = nativeImage.createFromNamedImage(name)
  if (source.isEmpty()) {
    macMenuIconCache.set(name, null)
    return null
  }

  const icon = source.resize({ width: MAC_MENU_ICON_SIZE, height: MAC_MENU_ICON_SIZE })
  icon.setTemplateImage(true)
  macMenuIconCache.set(name, icon)
  return icon
}

function macSymbol(name: string): Pick<Electron.MenuItemConstructorOptions, "icon"> {
  const icon = getMacMenuIcon(name)
  return icon ? { icon } : {}
}

export function setupApplicationMenu(
  getWindow: () => BrowserWindow | null,
  zoom: ZoomMenuControls,
) {
  let state = DEFAULT_MENU_STATE

  const buildTemplate = (): Electron.MenuItemConstructorOptions[] => {
    const isMac = process.platform === "darwin"
    const hasWindow = isUsableWindow(getWindow())
    const canUseRenderer = state.rendererReady
    const canUseWorkspace = canUseRenderer && state.context !== "setup"
    const isSession = canUseWorkspace && state.context === "session"

    const viewSubmenu: Electron.MenuItemConstructorOptions[] = [
      {
        label: "Toggle Sidebar",
        accelerator: "CmdOrCtrl+B",
        enabled: canUseWorkspace,
        click: () => send(getWindow(), "toggle-sidebar"),
      },
      ...(isSession
        ? [
            {
              label: "Toggle Chat",
              accelerator: "CmdOrCtrl+J",
              click: () => send(getWindow(), "toggle-chat"),
            } satisfies Electron.MenuItemConstructorOptions,
          ]
        : []),
      { type: "separator" },
      { label: "Zoom In", accelerator: "CmdOrCtrl+Plus", enabled: hasWindow, click: zoom.zoomIn },
      // macOS commonly displays Cmd+= for zoom in. Keep Cmd+Plus visible above and
      // register this hidden alias so both physical shortcuts work.
      {
        label: "Zoom In",
        accelerator: "CmdOrCtrl+=",
        visible: false,
        enabled: hasWindow,
        click: zoom.zoomIn,
      },
      { label: "Zoom Out", accelerator: "CmdOrCtrl+-", enabled: hasWindow, click: zoom.zoomOut },
      { label: "Reset Zoom", accelerator: "CmdOrCtrl+0", enabled: hasWindow, click: zoom.reset },
      { type: "separator" },
      { role: "reload" },
      { role: "forceReload" },
      { role: "toggleDevTools" },
      { type: "separator" },
      { role: "togglefullscreen" },
    ]

    return [
      {
        label: "Dilag",
        submenu: [
          { role: "about", ...macSymbol("info.circle") },
          {
            label: "Check for Updates",
            enabled: canUseRenderer,
            click: () => send(getWindow(), "check-updates"),
            ...macSymbol("square.and.arrow.down"),
          },
          { type: "separator" },
          {
            label: "Settings",
            accelerator: "CmdOrCtrl+,",
            enabled: canUseWorkspace,
            click: () => send(getWindow(), "settings"),
            ...macSymbol("gearshape"),
          },
          ...(isMac
            ? ([
                { type: "separator" },
                { role: "services", ...macSymbol("gearshape.2") },
                { type: "separator" },
                { role: "hide", ...macSymbol("rectangle.dashed") },
                { role: "hideOthers", ...macSymbol("rectangle.stack") },
                { role: "unhide", ...macSymbol("rectangle.stack.fill") },
              ] satisfies Electron.MenuItemConstructorOptions[])
            : []),
          { type: "separator" },
          { role: "quit", ...macSymbol("xmark.square") },
        ],
      },
      {
        label: "File",
        submenu: [
          {
            label: "New Design…",
            accelerator: "CmdOrCtrl+N",
            enabled: canUseWorkspace,
            click: () => send(getWindow(), "new-design"),
          },
          { type: "separator" },
          { label: "Close Window", role: "close" },
        ],
      },
      {
        label: "Edit",
        submenu: [
          { role: "undo" },
          { role: "redo" },
          { type: "separator" },
          { role: "cut" },
          { role: "copy" },
          { role: "paste" },
          { role: "pasteAndMatchStyle" },
          { role: "delete" },
          { type: "separator" },
          { role: "selectAll" },
        ],
      },
      {
        label: "View",
        submenu: viewSubmenu,
      },
      {
        label: "Window",
        submenu: [
          { role: "minimize" },
          { role: "zoom" },
          ...(isMac
            ? ([
                { type: "separator" },
                { role: "front" },
              ] satisfies Electron.MenuItemConstructorOptions[])
            : ([
                { type: "separator" },
                { role: "close" },
              ] satisfies Electron.MenuItemConstructorOptions[])),
        ],
      },
      {
        label: "Help",
        submenu: [
          {
            label: "Report Issue",
            click: () => void shell.openExternal("https://github.com/noelrohi/dilag/issues"),
          },
        ],
      },
    ]
  }

  const rebuild = () => {
    Menu.setApplicationMenu(Menu.buildFromTemplate(buildTemplate()))
  }

  rebuild()

  return {
    refresh: rebuild,
    setState(nextState: NativeMenuState) {
      if (state.context === nextState.context && state.rendererReady === nextState.rendererReady) {
        return
      }

      state = nextState
      rebuild()
    },
  }
}
