import { mkdir, mkdtemp, rm, writeFile, readFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { describe, expect, it, afterEach } from "vitest"
import { getCanonicalGeneratedScreenPath } from "@dilag/desktop-bridge"
import { importDesigns, loadDesignsForSession } from "../../electron/ipc/designs"

const tempRoots: string[] = []

async function makeTempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), prefix))
  tempRoots.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe("importDesigns", () => {
  it("imports a valid HTML file into the canonical designs directory", async () => {
    const sessionCwd = await makeTempDir("dilag-import-session-")
    const sourceDir = await makeTempDir("dilag-import-source-")
    const sourcePath = path.join(sourceDir, "home.html")
    await writeFile(sourcePath, "<!doctype html><title>Home</title>", "utf8")

    const result = await importDesigns({ sessionCwd, filePaths: [sourcePath] })

    expect(result).toEqual({ imported: 1, rejected: [] })
    await expect(
      readFile(getCanonicalGeneratedScreenPath(sessionCwd, "home.html"), "utf8"),
    ).resolves.toContain("<title>Home</title>")
  })

  it("de-collides imported file names with a numeric suffix", async () => {
    const sessionCwd = await makeTempDir("dilag-import-session-")
    const sourceA = await makeTempDir("dilag-import-source-a-")
    const sourceB = await makeTempDir("dilag-import-source-b-")
    const firstPath = path.join(sourceA, "card.html")
    const secondPath = path.join(sourceB, "card.html")
    await writeFile(firstPath, "<p>First</p>", "utf8")
    await writeFile(secondPath, "<p>Second</p>", "utf8")

    const result = await importDesigns({ sessionCwd, filePaths: [firstPath, secondPath] })

    expect(result).toEqual({ imported: 2, rejected: [] })
    await expect(
      readFile(getCanonicalGeneratedScreenPath(sessionCwd, "card.html"), "utf8"),
    ).resolves.toContain("First")
    await expect(
      readFile(getCanonicalGeneratedScreenPath(sessionCwd, "card-2.html"), "utf8"),
    ).resolves.toContain("Second")
  })

  it("rejects non-HTML and oversized files with reasons", async () => {
    const sessionCwd = await makeTempDir("dilag-import-session-")
    const sourceDir = await makeTempDir("dilag-import-source-")
    const textPath = path.join(sourceDir, "notes.txt")
    const largePath = path.join(sourceDir, "large.html")
    await writeFile(textPath, "not html", "utf8")
    await writeFile(largePath, `${"x".repeat(1024 * 1024 + 1)}`, "utf8")

    const result = await importDesigns({ sessionCwd, filePaths: [textPath, largePath] })

    expect(result.imported).toBe(0)
    expect(result.rejected).toEqual([
      { path: textPath, reason: "Only .html and .htm files can be imported" },
      { path: largePath, reason: "File exceeds the 1 MB import limit" },
    ])
  })

  it("uses the source basename so traversal-shaped source paths land inside designs", async () => {
    const sessionCwd = await makeTempDir("dilag-import-session-")
    const sourceDir = await makeTempDir("dilag-import-source-")
    const nestedDir = path.join(sourceDir, "nested")
    const sourcePath = path.join(sourceDir, "evil.html")
    await mkdir(nestedDir)
    await writeFile(sourcePath, "<p>Contained</p>", "utf8")

    const result = await importDesigns({
      sessionCwd,
      filePaths: [path.join(nestedDir, "..", "evil.html")],
    })

    expect(result).toEqual({ imported: 1, rejected: [] })
    const importedPath = getCanonicalGeneratedScreenPath(sessionCwd, "evil.html")
    expect(path.relative(path.join(sessionCwd, ".designs"), importedPath).startsWith("..")).toBe(
      false,
    )
    await expect(readFile(importedPath, "utf8")).resolves.toContain("Contained")
  })

  it("imports parseable HTML with validation violations surfaced by the loader", async () => {
    const sessionCwd = await makeTempDir("dilag-import-session-")
    const sourceDir = await makeTempDir("dilag-import-source-")
    const sourcePath = path.join(sourceDir, "animated.html")
    await writeFile(sourcePath, '<div style="opacity: 0">Hidden</div>', "utf8")

    const result = await importDesigns({ sessionCwd, filePaths: [sourcePath] })
    const designs = await loadDesignsForSession(sessionCwd)

    expect(result).toEqual({ imported: 1, rejected: [] })
    expect(designs).toHaveLength(1)
    expect(designs[0].violations).toContainEqual({
      rule: "initial_opacity_zero",
      snippet: 'opacity: 0"',
    })
  })
})
