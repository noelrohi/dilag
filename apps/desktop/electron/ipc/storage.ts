import fs from "node:fs"
import fsp from "node:fs/promises"
import path from "node:path"

export async function calculateDirSize(dir: string): Promise<number> {
  if (!fs.existsSync(dir)) return 0
  let size = 0
  for (const entry of await fsp.readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const entryPath = path.join(dir, entry.name)
    if (entry.isDirectory()) size += await calculateDirSize(entryPath)
    else if (entry.isFile()) size += (await fsp.stat(entryPath)).size
  }
  return size
}
