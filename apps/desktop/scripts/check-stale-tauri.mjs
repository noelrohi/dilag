import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

const desktopRoot = new URL("..", import.meta.url).pathname
const repoRoot = join(desktopRoot, "..", "..")

const stalePaths = [
  "apps/desktop/src-tauri",
  "apps/desktop/public/tauri.svg",
  "apps/desktop/dist/tauri.svg",
  "apps/desktop/scripts/sync-version.ts",
  "apps/desktop/scripts/sync-version-from-pkg.ts",
]

const staleTextPatterns = [
  {
    label: ["OPENCODE", "TARGET"].join("_"),
    pattern: new RegExp(["OPENCODE", "TARGET"].join("_")),
  },
  { label: ["fetch", "opencode"].join("-"), pattern: new RegExp(["fetch", "opencode"].join("-")) },
]

const ignoredDirs = new Set([".git", ".turbo", "dist", "dist-electron", "node_modules", "release"])
const ignoredFiles = new Set(["bun.lock", "CHANGELOG.md"])
const textExtensions = new Set([
  ".cjs",
  ".css",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".ts",
  ".tsx",
  ".yml",
  ".yaml",
])

function extension(path) {
  const index = path.lastIndexOf(".")
  return index === -1 ? "" : path.slice(index)
}

function scanDirectory(directory, findings) {
  for (const entry of readdirSync(directory)) {
    const fullPath = join(directory, entry)
    const relativePath = relative(repoRoot, fullPath)
    const stat = statSync(fullPath)

    if (stat.isDirectory()) {
      if (ignoredDirs.has(entry)) continue
      scanDirectory(fullPath, findings)
      continue
    }

    if (!stat.isFile() || ignoredFiles.has(entry) || !textExtensions.has(extension(entry))) continue

    const contents = readFileSync(fullPath, "utf8")
    for (const { label, pattern } of staleTextPatterns) {
      if (pattern.test(contents)) findings.push(`${relativePath} contains ${label}`)
    }
  }
}

const found = stalePaths.filter((relativePath) => existsSync(join(repoRoot, relativePath)))
scanDirectory(repoRoot, found)

if (found.length > 0) {
  console.error(
    `Stale Tauri/opencode sidecar artifacts found:\n${found.map((p) => `- ${p}`).join("\n")}`,
  )
  process.exit(1)
}
