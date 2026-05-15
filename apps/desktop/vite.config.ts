import path from "path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { TanStackRouterVite } from "@tanstack/router-plugin/vite"
import { consoleForwardPlugin } from "vite-console-forward-plugin"

const host = process.env.TAURI_DEV_HOST
const configuredPort = Number(process.env.VITE_PORT || 1420)
const port = Number.isFinite(configuredPort) ? configuredPort : 1420

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [
    TanStackRouterVite({ autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    consoleForwardPlugin(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  // Keep terminal output visible for native-shell startup errors.
  clearScreen: false,
  server: {
    port,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: port + 1,
        }
      : undefined,
    watch: {
      // Native shell files are built separately; Vite should ignore them.
      ignored: ["**/src-tauri/**", "**/.beads/**"],
    },
  },
}))
