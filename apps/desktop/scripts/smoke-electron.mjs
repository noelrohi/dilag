import { spawn } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"
import electronPath from "electron"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP_ROOT = path.resolve(__dirname, "..")
const MAIN = path.join(APP_ROOT, "dist-electron", "main.cjs")

const child = spawn(electronPath, [MAIN], {
  cwd: APP_ROOT,
  env: { ...process.env, DILAG_ELECTRON_SMOKE: "1" },
  stdio: ["ignore", "pipe", "pipe"],
})

let output = ""

child.stdout.on("data", (chunk) => {
  const text = String(chunk)
  output += text
  process.stdout.write(text)
})

child.stderr.on("data", (chunk) => {
  const text = String(chunk)
  output += text
  process.stderr.write(text)
})

const timer = setTimeout(() => {
  child.kill()
  console.error("[electron-smoke] timed out waiting for Electron")
  process.exit(1)
}, 30_000)

child.on("exit", (code) => {
  clearTimeout(timer)
  if (code !== 0) process.exit(code ?? 1)
  if (!output.includes("[electron-smoke]")) {
    console.error("[electron-smoke] Electron exited without reporting smoke status")
    process.exit(1)
  }
})
