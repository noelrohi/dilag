import { Menu, type BrowserWindow } from "electron"
import { CHANNELS } from "./shared/channels.js"
import type { MenuEventId } from "@dilag/desktop-bridge"

function send(window: BrowserWindow | null, id: MenuEventId) {
  window?.webContents.send(CHANNELS.menu.event, id)
}

export function setupApplicationMenu(
  getWindow: () => BrowserWindow | null,
  applyZoom: (level: number) => number,
) {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: "Dilag",
      submenu: [
        { role: "about" },
        { type: "separator" },
        {
          label: "Settings",
          accelerator: "CmdOrCtrl+,",
          click: () => send(getWindow(), "settings"),
        },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "File",
      submenu: [
        {
          label: "New Session",
          accelerator: "CmdOrCtrl+N",
          click: () => send(getWindow(), "new-session"),
        },
      ],
    },
    {
      label: "View",
      submenu: [
        {
          label: "Toggle Sidebar",
          accelerator: "CmdOrCtrl+B",
          click: () => send(getWindow(), "toggle-sidebar"),
        },
        {
          label: "Toggle Chat",
          accelerator: "CmdOrCtrl+J",
          click: () => send(getWindow(), "toggle-chat"),
        },
        { type: "separator" },
        { label: "Zoom In", accelerator: "CmdOrCtrl+Plus", click: () => applyZoom(1.1) },
        { label: "Zoom Out", accelerator: "CmdOrCtrl+-", click: () => applyZoom(0.9) },
        { label: "Reset Zoom", accelerator: "CmdOrCtrl+0", click: () => applyZoom(1) },
        { type: "separator" },
        { role: "toggleDevTools" },
      ],
    },
    {
      label: "Help",
      submenu: [{ label: "Check for Updates", click: () => send(getWindow(), "check-updates") }],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
