import { mkdir, mkdtemp, readdir, rm, writeFile, readFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { describe, expect, it, afterEach } from "vitest"
import { getCanonicalGeneratedScreenPath } from "@dilag/desktop-bridge"
import { duplicateDesign, renameDesign, writeDesign } from "../../electron/ipc/designs"

const tempRoots: string[] = []

async function makeTempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), prefix))
  tempRoots.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe("writeDesign", () => {
  it("overwrites an existing canonical file in place", async () => {
    const sessionCwd = await makeTempDir("dilag-write-session-")

    const first = await writeDesign({
      sessionCwd,
      filename: "home.html",
      html: "<p>First</p>",
    })
    expect(first).toEqual({ ok: true, filename: "home.html" })

    const second = await writeDesign({
      sessionCwd,
      filename: "home.html",
      html: "<p>Second</p>",
    })
    expect(second).toEqual({ ok: true, filename: "home.html" })

    const targetPath = getCanonicalGeneratedScreenPath(sessionCwd, "home.html")
    await expect(readFile(targetPath, "utf8")).resolves.toBe("<p>Second</p>")

    const designDir = path.join(sessionCwd, ".designs")
    const entries = await readdir(designDir)
    expect(entries).toEqual(["home.html"])
  })

  it("blocks writes with validation violations and does not write the file", async () => {
    const sessionCwd = await makeTempDir("dilag-write-session-")

    const result = await writeDesign({
      sessionCwd,
      filename: "animated.html",
      html: "<style>@keyframes spin { from { transform: rotate(0deg); } }</style>",
    })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error("expected failure")
    expect(result.violations).toContainEqual({ rule: "keyframes", snippet: "@keyframes" })

    const targetPath = getCanonicalGeneratedScreenPath(sessionCwd, "animated.html")
    await expect(readFile(targetPath, "utf8")).rejects.toThrow()
  })

  it("rejects traversal-shaped filenames and writes nothing outside .designs", async () => {
    const sessionCwd = await makeTempDir("dilag-write-session-")

    const result = await writeDesign({
      sessionCwd,
      filename: "../evil.html",
      html: "<p>evil</p>",
    })

    expect(result.ok).toBe(false)
    await expect(readFile(path.join(sessionCwd, "evil.html"), "utf8")).rejects.toThrow()
    await expect(
      readFile(path.join(path.dirname(sessionCwd), "evil.html"), "utf8"),
    ).rejects.toThrow()
  })
})

describe("renameDesign", () => {
  it("renames a canonical screen and updates contents; renaming again fails not-found", async () => {
    const sessionCwd = await makeTempDir("dilag-rename-session-")
    await writeDesign({ sessionCwd, filename: "home.html", html: "<p>Home</p>" })

    const result = await renameDesign({ sessionCwd, from: "home.html", to: "landing.html" })
    expect(result).toEqual({ ok: true, filename: "landing.html" })

    await expect(
      readFile(getCanonicalGeneratedScreenPath(sessionCwd, "home.html"), "utf8"),
    ).rejects.toThrow()
    await expect(
      readFile(getCanonicalGeneratedScreenPath(sessionCwd, "landing.html"), "utf8"),
    ).resolves.toBe("<p>Home</p>")

    const second = await renameDesign({ sessionCwd, from: "home.html", to: "other.html" })
    expect(second).toEqual({ ok: false, reason: "Screen not found" })
  })

  it("fails when the target name already exists, leaving both files untouched", async () => {
    const sessionCwd = await makeTempDir("dilag-rename-session-")
    await writeDesign({ sessionCwd, filename: "home.html", html: "<p>Home</p>" })
    await writeDesign({ sessionCwd, filename: "settings.html", html: "<p>Settings</p>" })

    const result = await renameDesign({ sessionCwd, from: "home.html", to: "settings.html" })

    expect(result.ok).toBe(false)
    await expect(
      readFile(getCanonicalGeneratedScreenPath(sessionCwd, "home.html"), "utf8"),
    ).resolves.toBe("<p>Home</p>")
    await expect(
      readFile(getCanonicalGeneratedScreenPath(sessionCwd, "settings.html"), "utf8"),
    ).resolves.toBe("<p>Settings</p>")
  })

  it("migrates a legacy screens/ file into .designs and deletes the legacy source", async () => {
    const sessionCwd = await makeTempDir("dilag-rename-session-")
    const legacyDir = path.join(sessionCwd, "screens")
    await mkdir(legacyDir, { recursive: true })
    const legacyPath = path.join(legacyDir, "old.html")
    await writeFile(legacyPath, "<p>Old</p>", "utf8")

    const result = await renameDesign({ sessionCwd, from: "old.html", to: "new.html" })

    expect(result).toEqual({ ok: true, filename: "new.html" })
    await expect(readFile(legacyPath, "utf8")).rejects.toThrow()
    await expect(
      readFile(getCanonicalGeneratedScreenPath(sessionCwd, "new.html"), "utf8"),
    ).resolves.toBe("<p>Old</p>")
  })
})

describe("duplicateDesign", () => {
  it("generates numbered copy names and preserves the legacy source", async () => {
    const sessionCwd = await makeTempDir("dilag-duplicate-session-")
    const legacyDir = path.join(sessionCwd, "screens")
    await mkdir(legacyDir, { recursive: true })
    const legacyPath = path.join(legacyDir, "foo.html")
    await writeFile(legacyPath, "<p>Foo</p>", "utf8")

    const first = await duplicateDesign({ sessionCwd, filename: "foo.html" })
    expect(first).toEqual({ ok: true, filename: "foo copy.html" })
    await expect(
      readFile(getCanonicalGeneratedScreenPath(sessionCwd, "foo copy.html"), "utf8"),
    ).resolves.toBe("<p>Foo</p>")

    const second = await duplicateDesign({ sessionCwd, filename: "foo.html" })
    expect(second).toEqual({ ok: true, filename: "foo copy 2.html" })
    await expect(
      readFile(getCanonicalGeneratedScreenPath(sessionCwd, "foo copy 2.html"), "utf8"),
    ).resolves.toBe("<p>Foo</p>")

    // Legacy source stays in place — duplicate is not a migration.
    await expect(readFile(legacyPath, "utf8")).resolves.toBe("<p>Foo</p>")
  })
})
