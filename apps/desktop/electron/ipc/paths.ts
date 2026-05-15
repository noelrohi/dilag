import { app } from "electron"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

export function resolveDesignAssetDir(): string {
  const packagedAssets = path.join(process.resourcesPath, "design-assets")
  if (fs.existsSync(packagedAssets)) return packagedAssets
  const cwdAssets = path.resolve(process.cwd(), "resources", "design-assets")
  if (fs.existsSync(cwdAssets)) return cwdAssets
  const electronAssets = path.resolve(app.getAppPath(), "resources", "design-assets")
  return electronAssets
}

export function getDilagDir(): string {
  return path.join(os.homedir(), ".dilag")
}

export function getSessionsDir(): string {
  return path.join(getDilagDir(), "sessions")
}

export function getSessionsFile(): string {
  return path.join(getDilagDir(), "sessions.json")
}

export function getStateDbPath(): string {
  return path.join(getDilagDir(), "state.sqlite")
}

export function getDilagSkillsDir(): string {
  return path.join(getDilagDir(), "skills")
}

export function getDefaultProjectsDir(): string {
  return path.join(os.homedir(), "dilag")
}

export function getPiAgentDir(): string {
  return path.join(getDilagDir(), "pi")
}

export function buildAugmentedPath(): string {
  const existing = process.env.PATH ?? ""
  const extra = [
    "/opt/homebrew/bin",
    "/usr/local/bin",
    path.join(os.homedir(), ".bun/bin"),
    path.join(os.homedir(), ".npm-global/bin"),
    path.join(os.homedir(), ".cargo/bin"),
    path.join(os.homedir(), ".local/bin"),
    path.join(os.homedir(), "Library/pnpm"),
  ]
  return [...extra.filter((candidate) => fs.existsSync(candidate)), existing].join(path.delimiter)
}
