import fsp from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { loadDesignsForSession } from "../../electron/ipc/designs"

let tempDir: string

async function writeScreen(relativePath: string, title: string, type: "web" | "mobile" = "web") {
  const filePath = path.join(tempDir, relativePath)
  await fsp.mkdir(path.dirname(filePath), { recursive: true })
  await fsp.writeFile(
    filePath,
    `<!doctype html><html data-title="${title}" data-screen-type="${type}"><body>${title}</body></html>`,
  )
  return filePath
}

describe("generated screen loader", () => {
  beforeEach(async () => {
    tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), "dilag-designs-"))
  })

  afterEach(async () => {
    await fsp.rm(tempDir, { recursive: true, force: true })
  })

  it("loads canonical .designs screens and legacy screens fallback files", async () => {
    const canonical = await writeScreen(".designs/home.html", "Home")
    const legacy = await writeScreen("screens/legacy.html", "Legacy")
    await writeScreen("home.html", "Root")
    await writeScreen("src/ignored.html", "Ignored")

    const designs = await loadDesignsForSession(tempDir)

    expect(designs.map((design) => design.file_path).sort()).toEqual([canonical, legacy].sort())
    expect(designs.map((design) => design.title).sort()).toEqual(["Home", "Legacy"])
  })

  it("uses screens as fallback only when canonical and legacy files have the same screen path", async () => {
    const canonical = await writeScreen(".designs/home.html", "Canonical Home")
    const duplicateLegacy = await writeScreen("screens/home.html", "Legacy Home")
    const uniqueLegacy = await writeScreen("screens/settings.html", "Legacy Settings")

    const designs = await loadDesignsForSession(tempDir)
    const loadedPaths = designs.map((design) => design.file_path)

    expect(loadedPaths).toContain(canonical)
    expect(loadedPaths).toContain(uniqueLegacy)
    expect(loadedPaths).not.toContain(duplicateLegacy)
    expect(designs.map((design) => design.title).sort()).toEqual([
      "Canonical Home",
      "Legacy Settings",
    ])
  })
})
