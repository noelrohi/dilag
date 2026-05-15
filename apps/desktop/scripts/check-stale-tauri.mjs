import { existsSync } from "node:fs"
import { join } from "node:path"

const root = new URL("..", import.meta.url).pathname
const stalePaths = [
  "src-tauri",
  "public/tauri.svg",
  "dist/tauri.svg",
  "scripts/sync-version.ts",
  "scripts/sync-version-from-pkg.ts",
]

const found = stalePaths.filter((relative) => existsSync(join(root, relative)))
if (found.length > 0) {
  console.error(`Stale Tauri/Rust artifacts found:\n${found.map((p) => `- ${p}`).join("\n")}`)
  process.exit(1)
}
