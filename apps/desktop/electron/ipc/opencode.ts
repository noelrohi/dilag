import { spawn, type ChildProcess } from "node:child_process"
import fs from "node:fs"
import fsp from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import {
  buildAugmentedPath,
  getDilagDir,
  getBundledBinaryDir,
  getOpencodeConfigDir,
  getSessionsDir,
  platformBinaryName,
  resolveDesignAssetDir,
} from "./paths.js"
import { findExecutable, getFreePort, runCommand } from "./processes.js"

const DESIGN_ASSET_DIR = resolveDesignAssetDir()
const DESIGNER_COMMON = readAsset("designer-common.md")
const MOBILE_DESIGN_SKILL = readAsset("mobile-designer-prompt.md")
const WEB_DESIGN_SKILL = readAsset("web-designer-prompt.md")
const WEB_EXAMPLE_EDITORIAL = readAsset("examples/web/editorial.html")
const WEB_EXAMPLE_SAAS = readAsset("examples/web/saas-dashboard.html")
const MOBILE_EXAMPLE_WELLNESS = readAsset("examples/mobile/wellness.html")
const MOBILE_EXAMPLE_FINANCE = readAsset("examples/mobile/finance.html")

const BUILD_AGENT_PROMPT =
  "You are Dilag, a UI design agent that produces production-grade HTML screen prototypes.\n\n" +
  "## How to start\n" +
  "- Inspect the user's message to decide between the `mobile-design` and `web-design` skills. " +
  "If the user mentions phone, iOS, Android, or specific mobile concepts, use `mobile-design`; otherwise use `web-design`.\n" +
  "- Invoke the chosen skill with the `skill` tool BEFORE any `write` call. Load the skill exactly once per session.\n" +
  "- Follow the skill's instructions strictly - they are the source of truth for screens, template, theme tokens, and forbidden patterns.\n\n" +
  "## Output policy\n" +
  "- Write each screen as a separate HTML file under `screens/` using the `write` tool. Never inline HTML in your reply.\n" +
  "- The `write` tool creates parent directories automatically. Do NOT call `bash mkdir` or any other shell command to prepare the `screens/` folder - just write the files.\n" +
  "- Every screen must share the same fonts, theme tokens, and palette chosen for the session.\n" +
  "- Do not edit files outside `screens/`. Do not run shell commands unless the user explicitly asks.\n\n" +
  "## Tone\n" +
  "- Short, concrete replies. No preamble, no status commentary, no emoji unless the user asks.\n" +
  "- State the aesthetic direction in one sentence before writing, then write the files.\n" +
  "- After writing, summarize in one or two lines: the palette, the type stack, and what each screen shows.\n"

let opencodeProcess: ChildProcess | null = null
let opencodePort = 4096

function readAsset(relativePath: string): string {
  return fs.readFileSync(path.join(DESIGN_ASSET_DIR, relativePath), "utf8")
}

function renderSkill(template: string): string {
  const fallback = "(none specified - use your judgment based on the user's request)"
  const brand = process.env.DILAG_BRAND_TOKENS?.trim() || fallback
  const domain = process.env.DILAG_DOMAIN_HINT?.trim() || fallback
  const refs = process.env.DILAG_REFERENCE_URLS?.trim() || fallback
  return template
    .replace("{{COMMON}}", DESIGNER_COMMON)
    .replace("{{BRAND_TOKENS}}", brand)
    .replace("{{DOMAIN_HINT}}", domain)
    .replace("{{REFERENCE_URLS}}", refs)
}

async function ensureConfigExists(): Promise<void> {
  const configDir = getOpencodeConfigDir()
  const mobileSkillDir = path.join(configDir, "skill", "mobile-design")
  const mobileExamplesDir = path.join(mobileSkillDir, "examples")
  const webSkillDir = path.join(configDir, "skill", "web-design")
  const webExamplesDir = path.join(webSkillDir, "examples")

  await fsp.mkdir(mobileExamplesDir, { recursive: true })
  await fsp.mkdir(webExamplesDir, { recursive: true })
  await fsp.writeFile(path.join(mobileSkillDir, "SKILL.md"), renderSkill(MOBILE_DESIGN_SKILL))
  await fsp.writeFile(path.join(mobileExamplesDir, "wellness.html"), MOBILE_EXAMPLE_WELLNESS)
  await fsp.writeFile(path.join(mobileExamplesDir, "finance.html"), MOBILE_EXAMPLE_FINANCE)
  await fsp.writeFile(path.join(webSkillDir, "SKILL.md"), renderSkill(WEB_DESIGN_SKILL))
  await fsp.writeFile(path.join(webExamplesDir, "editorial.html"), WEB_EXAMPLE_EDITORIAL)
  await fsp.writeFile(path.join(webExamplesDir, "saas-dashboard.html"), WEB_EXAMPLE_SAAS)

  const config = {
    $schema: "https://opencode.ai/config.json",
    autoupdate: false,
    share: "disabled",
    default_agent: "build",
    plugin: ["opencode-antigravity-auth@1.2.8"],
    agent: { build: { prompt: BUILD_AGENT_PROMPT } },
    permission: {
      bash: {
        "*": "ask",
        ls: "allow",
        "ls *": "allow",
        "mkdir *": "allow",
        pwd: "allow",
        "which *": "allow",
        "echo *": "allow",
        "cat *": "allow",
        "head *": "allow",
        "tail *": "allow",
        "wc *": "allow",
        "find *": "allow",
        "grep *": "allow",
        "file *": "allow",
        "stat *": "allow",
        "git *": "allow",
        "bun *": "allow",
        "bunx *": "allow",
        "npm *": "allow",
        "npx *": "allow",
        "tsc *": "allow",
        "vitest *": "allow",
        "jest *": "allow",
        "eslint *": "allow",
        "prettier *": "allow",
      },
      task: "deny",
      skill: {
        "mobile-design": "allow",
        "web-design": "allow",
      },
    },
  }
  await fsp.writeFile(path.join(configDir, "opencode.json"), JSON.stringify(config, null, 2))
}

function getOpencodeBinaryPath(): string | null {
  const packagedCandidate = path.join(process.resourcesPath, "opencode", platformBinaryName())
  return findExecutable("opencode", [
    packagedCandidate,
    path.join(getBundledBinaryDir(), platformBinaryName()),
    path.join(os.homedir(), ".opencode/bin/opencode"),
    path.join(os.homedir(), ".npm-global/bin/opencode"),
    path.join(os.homedir(), ".bun/bin/opencode"),
    "/opt/homebrew/bin/opencode",
    "/usr/local/bin/opencode",
    "/usr/bin/opencode",
  ])
}

function getBunBinaryPath(): string | null {
  return findExecutable("bun", [
    "/opt/homebrew/bin/bun",
    "/usr/local/bin/bun",
    "/usr/bin/bun",
    path.join(os.homedir(), ".bun/bin/bun"),
  ])
}

export function getBootstrapPort() {
  return opencodePort
}

export async function initializeOpencodeHost() {
  opencodePort = await getFreePort()
}

export function isOpencodeRunning(): boolean {
  return opencodeProcess !== null
}

export async function checkOpencodeInstallation() {
  const binary = getOpencodeBinaryPath()
  if (!binary) return { installed: false, version: null, error: "OpenCode CLI not found" }
  const output = await runCommand(binary, ["--version"])
  return output.code === 0
    ? { installed: true, version: output.stdout.trim() || null, error: null }
    : { installed: false, version: null, error: output.stderr.trim() || null }
}

export async function checkBunInstallation() {
  const binary = getBunBinaryPath() ?? "bun"
  try {
    const output = await runCommand(binary, ["--version"])
    return output.code === 0
      ? { installed: true, version: output.stdout.trim() || null, error: null }
      : { installed: false, version: null, error: output.stderr.trim() || null }
  } catch (error) {
    return { installed: false, version: null, error: `Bun not found: ${String(error)}` }
  }
}

export async function installDependencies() {
  const bunInstall = await runCommand("bash", ["-c", "curl -fsSL https://bun.sh/install | bash"])
  if (bunInstall.code !== 0)
    return {
      stage: "bun",
      message: "Failed to install Bun",
      completed: false,
      error: bunInstall.stderr,
    }
  const opencodeInstall = await runCommand("bash", [
    "-c",
    "curl -fsSL https://opencode.ai/install | bash",
  ])
  if (opencodeInstall.code !== 0)
    return {
      stage: "opencode",
      message: "Failed to install OpenCode",
      completed: false,
      error: opencodeInstall.stderr,
    }
  return {
    stage: "complete",
    message: "All dependencies installed successfully",
    completed: true,
    error: null,
  }
}

export async function restartOpencode(): Promise<number> {
  await stopOpencode()
  opencodePort = await getFreePort()
  const cache = path.join(os.homedir(), "Library", "Caches", "opencode", "models.json")
  await fsp.rm(cache, { force: true }).catch(() => {})
  return startOpencode()
}

export async function startOpencode(): Promise<number> {
  if (opencodeProcess) return opencodePort
  const binary = getOpencodeBinaryPath()
  if (!binary) throw new Error("OpenCode CLI not found")
  await fsp.mkdir(getSessionsDir(), { recursive: true })
  await ensureConfigExists()
  opencodeProcess = spawn(
    binary,
    ["serve", "--port", String(opencodePort), "--hostname", "127.0.0.1"],
    {
      env: {
        ...process.env,
        PATH: buildAugmentedPath(),
        XDG_CONFIG_HOME: getDilagDir(),
        OPENCODE_DISABLE_CLAUDE_CODE_PROMPT: "1",
      },
      stdio: "ignore",
    },
  )
  opencodeProcess.once("exit", () => {
    opencodeProcess = null
  })
  await new Promise((resolve) => setTimeout(resolve, 500))
  return opencodePort
}

export async function stopOpencode(): Promise<void> {
  if (!opencodeProcess) return
  const child = opencodeProcess
  opencodeProcess = null
  child.kill()
}
