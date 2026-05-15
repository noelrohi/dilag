import type { DesktopBridge } from "@dilag/desktop-bridge"

function missingBridge(): never {
  throw new Error("window.desktopBridge is unavailable. Run the desktop app through Electron.")
}

export function getBridge(): DesktopBridge {
  return window.desktopBridge ?? missingBridge()
}

// Convenience: a proxy so bridge calls always target the live preload bridge
// installed before React mounts.
export const bridge: DesktopBridge = new Proxy({} as DesktopBridge, {
  get(_target, prop: keyof DesktopBridge) {
    return getBridge()[prop]
  },
})
