import fsp from "node:fs/promises"
import path from "node:path"
import type { FileNode } from "@dilag/desktop-bridge"

export async function listProjectFiles(root: string, relative = ""): Promise<FileNode[]> {
  const absolute = path.join(root, relative)
  const ignored = new Set([".git", "node_modules", "dist", "dist-electron", "release"])
  const entries = await fsp.readdir(absolute, { withFileTypes: true }).catch(() => [])
  const nodes: FileNode[] = []
  for (const entry of entries) {
    if (ignored.has(entry.name)) continue
    const id = relative ? path.join(relative, entry.name) : entry.name
    if (entry.isDirectory()) {
      nodes.push({ id, name: entry.name, isDir: true, children: await listProjectFiles(root, id) })
    } else if (entry.isFile()) {
      nodes.push({ id, name: entry.name, isDir: false })
    }
  }
  return nodes.sort((a, b) => Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name))
}

export function readProjectFile(sessionCwd: string, filePath: string): Promise<string> {
  return fsp.readFile(path.join(sessionCwd, filePath), "utf8")
}
