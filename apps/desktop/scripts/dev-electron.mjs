// Dev launcher for the Electron shell. Responsibilities:
//   1. Start Vite (renderer) and wait until the port is ready.
//   2. Run tsdown --watch to bundle main/preload into dist-electron/.
//   3. Spawn electron and point it at VITE_DEV_SERVER_URL.
//   4. Restart electron whenever main.cjs or preload.cjs change (no HMR for
//      the main process — Electron has to be killed and re-spawned).
//
// Ctrl-C kills all three children.

import { spawn } from "node:child_process"
import { once } from "node:events"
import { watch } from "node:fs"
import { setTimeout as delay } from "node:timers/promises"
import net from "node:net"
import path from "node:path"
import { fileURLToPath } from "node:url"
import electronPath from "electron"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP_ROOT = path.resolve(__dirname, "..")
const DIST_ELECTRON = path.join(APP_ROOT, "dist-electron")
const DEFAULT_VITE_PORT = 1420

const children = new Set()
let electronProc = null
let restartTimer = null
let viteUrl = ""

function log(scope, line) {
  for (const chunk of String(line).split(/[\r\n]+/)) {
    const text = chunk.trimEnd()
    if (!text.trim()) continue
    const alreadyPrefixed = text.startsWith(`[${scope}]`)
    process.stdout.write(alreadyPrefixed ? `${text}\n` : `[${scope}] ${text}\n`)
  }
}

function track(child, scope) {
  children.add(child)
  child.stdout?.on("data", (buf) => log(scope, buf))
  child.stderr?.on("data", (buf) => log(scope, buf))
  child.on("error", (err) => log(scope, `failed to spawn: ${err.message}`))
  child.on("exit", () => children.delete(child))
  return child
}

async function isHostPortOpen(port, host) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host })
    socket.once("connect", () => {
      socket.end()
      resolve(true)
    })
    socket.once("error", () => resolve(false))
  })
}

async function isPortOpen(port) {
  for (const host of ["127.0.0.1", "::1", "localhost"]) {
    if (await isHostPortOpen(port, host)) return true
  }
  return false
}

async function findOpenPort(startPort) {
  for (let port = startPort; port < startPort + 100; port++) {
    if (!(await isPortOpen(port))) return port
  }
  throw new Error(`No open Vite port found in ${startPort}-${startPort + 99}`)
}

async function waitForPort(port, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const ok = await isPortOpen(port)
    if (ok) return
    await delay(200)
  }
  throw new Error(`Vite did not open port ${port} within ${timeoutMs}ms`)
}

function spawnElectron() {
  if (electronProc) {
    electronProc.removeAllListeners("exit")
    electronProc.kill()
  }
  const electronArgs = [path.join(DIST_ELECTRON, "main.cjs")]
  const remoteDebuggingPort = process.env.ELECTRON_REMOTE_DEBUGGING_PORT
  if (remoteDebuggingPort) {
    electronArgs.push(`--remote-debugging-port=${remoteDebuggingPort}`)
  }

  electronProc = track(
    spawn(electronPath, electronArgs, {
      cwd: APP_ROOT,
      env: { ...process.env, VITE_DEV_SERVER_URL: viteUrl },
      stdio: ["ignore", "pipe", "pipe"],
    }),
    "electron",
  )
  electronProc.on("exit", (code, signal) => {
    if (signal === "SIGTERM" || signal === "SIGKILL") return
    if (code && code !== 0) {
      log("electron", `exited with code ${code}`)
      shutdown(code)
      return
    }
    if (code === 0 || code == null) {
      shutdown(0)
    }
  })
}

function scheduleRestart() {
  if (restartTimer) clearTimeout(restartTimer)
  restartTimer = setTimeout(() => {
    log("watch", "dist-electron changed — restarting electron")
    spawnElectron()
  }, 150)
}

async function main() {
  const dryRun = process.argv.includes("--dry-run")
  const requestedPort = Number(process.env.VITE_PORT || DEFAULT_VITE_PORT)
  const preferredPort = Number.isFinite(requestedPort) ? requestedPort : DEFAULT_VITE_PORT
  const vitePort = await findOpenPort(preferredPort)
  viteUrl = `http://localhost:${vitePort}`

  const childEnv = { ...process.env, VITE_PORT: String(vitePort), VITE_DEV_SERVER_URL: viteUrl }

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          appRoot: APP_ROOT,
          distElectron: DIST_ELECTRON,
          viteUrl,
          commands: {
            vite: "bun run dev:renderer",
            electronBundle: "bunx tsdown --watch",
            electron: `${electronPath} ${path.join(DIST_ELECTRON, "main.cjs")}`,
          },
          env: {
            VITE_PORT: childEnv.VITE_PORT,
            VITE_DEV_SERVER_URL: childEnv.VITE_DEV_SERVER_URL,
          },
        },
        null,
        2,
      ),
    )
    return
  }

  if (vitePort !== preferredPort) {
    log("dev", `port ${preferredPort} is busy; using ${vitePort}`)
  }

  // 1. Vite dev server.
  const vite = track(
    spawn("bun", ["run", "dev:renderer"], {
      cwd: APP_ROOT,
      env: childEnv,
      stdio: ["ignore", "pipe", "pipe"],
    }),
    "vite",
  )

  // 2. tsdown --watch builds main/preload continuously.
  const bundler = track(
    spawn("bunx", ["tsdown", "--watch"], {
      cwd: APP_ROOT,
      env: childEnv,
      stdio: ["ignore", "pipe", "pipe"],
    }),
    "tsdown",
  )

  // Wait for Vite AND the first tsdown build before spawning electron.
  // tsdown prints "Build complete" on each pass; we just poll for main.cjs.
  await waitForPort(vitePort)
  await waitForFile(path.join(DIST_ELECTRON, "main.cjs"))
  await waitForFile(path.join(DIST_ELECTRON, "preload.cjs"))

  spawnElectron()

  // 3. Watch the bundler output for changes.
  watch(DIST_ELECTRON, { persistent: true }, (_event, filename) => {
    if (!filename) return
    if (filename === "main.cjs" || filename === "preload.cjs") scheduleRestart()
  })

  await Promise.race([once(vite, "exit"), once(bundler, "exit")])
  shutdown(1)
}

async function waitForFile(filePath, timeoutMs = 30_000) {
  const fs = await import("node:fs/promises")
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      await fs.access(filePath)
      return
    } catch {
      await delay(100)
    }
  }
  throw new Error(`tsdown did not produce ${filePath} within ${timeoutMs}ms`)
}

function shutdown(code) {
  for (const child of children) {
    try {
      child.kill()
    } catch {}
  }
  process.exit(code)
}

process.on("SIGINT", () => shutdown(0))
process.on("SIGTERM", () => shutdown(0))

main().catch((err) => {
  console.error(err)
  shutdown(1)
})
