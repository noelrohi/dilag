import { defineConfig } from "tsdown"

const base = {
  outDir: "dist-electron",
  format: "cjs" as const,
  platform: "node" as const,
  // Electron ships Node 20+; target conservatively.
  target: "node20",
  deps: {
    neverBundle: ["electron", "electron-updater"],
  },
  sourcemap: true,
  dts: false,
}

// Build main and preload as separate bundles. A multi-entry CJS build can add
// entry-to-entry requires, which is fatal for preload because it must never
// execute main-process startup code in the renderer.
export default defineConfig([
  {
    ...base,
    name: "electron-main",
    entry: {
      main: "electron/main.ts",
    },
    clean: true,
  },
  {
    ...base,
    name: "electron-preload",
    entry: {
      preload: "electron/preload.ts",
    },
    clean: false,
  },
])
