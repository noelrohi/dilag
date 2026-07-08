import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("electron", () => ({
  app: {
    getAppPath: () => "/tmp/dilag-test",
    getPath: () => "/tmp/dilag-test",
  },
}))

import {
  getLegacySessionsNotice,
  importLegacySessions,
  listProjects,
} from "../../electron/ipc/projects.js"
import { getSessionsFile } from "../../electron/ipc/paths.js"

let homeDir: string

function writeLegacyStore(sessions: unknown[]): Buffer {
  fs.mkdirSync(path.dirname(getSessionsFile()), { recursive: true })
  const contents = Buffer.from(JSON.stringify({ sessions }, null, 2))
  fs.writeFileSync(getSessionsFile(), contents)
  return contents
}

function readLegacyStore(): Buffer {
  return fs.readFileSync(getSessionsFile())
}

function makeProjectFolder(name: string): string {
  const projectPath = path.join(homeDir, "projects", name)
  fs.mkdirSync(projectPath, { recursive: true })
  return projectPath
}

function legacySession(overrides: { id: string; name: string; cwd: string }) {
  return {
    id: overrides.id,
    name: overrides.name,
    created_at: "2026-07-07T00:00:00.000Z",
    updated_at: "2026-07-07T00:00:00.000Z",
    cwd: overrides.cwd,
  }
}

beforeEach(() => {
  homeDir = fs.mkdtempSync(path.join(os.tmpdir(), "dilag-import-legacy-"))
  vi.stubEnv("DILAG_HOME", homeDir)
})

afterEach(() => {
  vi.unstubAllEnvs()
  fs.rmSync(homeDir, { recursive: true, force: true })
})

describe("importLegacySessions", () => {
  it("imports two legacy sessions with existing folders and dismisses the notice", async () => {
    const first = makeProjectFolder("first-app")
    const second = makeProjectFolder("second-app")
    const before = writeLegacyStore([
      legacySession({ id: "session-1", name: "First App", cwd: first }),
      legacySession({ id: "session-2", name: "Second App", cwd: second }),
    ])

    const result = await importLegacySessions()

    expect(result).toEqual({ imported: 2, skipped: [] })
    expect(listProjects().map((project) => project.path)).toEqual([second, first])
    expect(getLegacySessionsNotice()).toEqual({ hasLegacySessions: true, dismissed: true })
    expect(readLegacyStore()).toEqual(before)
  })

  it("is idempotent after importing legacy sessions", async () => {
    const first = makeProjectFolder("first-app")
    const second = makeProjectFolder("second-app")
    const before = writeLegacyStore([
      legacySession({ id: "session-1", name: "First App", cwd: first }),
      legacySession({ id: "session-2", name: "Second App", cwd: second }),
    ])

    await importLegacySessions()
    const result = await importLegacySessions()

    expect(result).toEqual({
      imported: 0,
      skipped: [
        { name: "First App", reason: "already registered" },
        { name: "Second App", reason: "already registered" },
      ],
    })
    expect(listProjects()).toHaveLength(2)
    expect(readLegacyStore()).toEqual(before)
  })

  it("skips a legacy session whose folder is missing", async () => {
    const missing = path.join(homeDir, "projects", "missing-app")
    const before = writeLegacyStore([
      legacySession({ id: "session-1", name: "Missing App", cwd: missing }),
    ])

    const result = await importLegacySessions()

    expect(result).toEqual({
      imported: 0,
      skipped: [{ name: "Missing App", reason: "folder missing" }],
    })
    expect(listProjects()).toEqual([])
    expect(getLegacySessionsNotice()).toEqual({ hasLegacySessions: true, dismissed: false })
    expect(readLegacyStore()).toEqual(before)
  })

  it("returns gracefully when sessions.json is malformed", async () => {
    fs.mkdirSync(path.dirname(getSessionsFile()), { recursive: true })
    const before = Buffer.from("{ not valid json")
    fs.writeFileSync(getSessionsFile(), before)

    const result = await importLegacySessions()

    expect(result).toEqual({
      imported: 0,
      skipped: [{ name: "sessions.json", reason: "malformed sessions.json" }],
    })
    expect(listProjects()).toEqual([])
    expect(getLegacySessionsNotice()).toEqual({ hasLegacySessions: true, dismissed: false })
    expect(readLegacyStore()).toEqual(before)
  })

  it("leaves legacy files byte-identical when importing mixed sessions", async () => {
    const existing = makeProjectFolder("existing-app")
    const missing = path.join(homeDir, "projects", "missing-app")
    const before = writeLegacyStore([
      legacySession({ id: "session-1", name: "Existing App", cwd: existing }),
      legacySession({ id: "session-2", name: "Missing App", cwd: missing }),
    ])

    const result = await importLegacySessions()

    expect(result).toEqual({
      imported: 1,
      skipped: [{ name: "Missing App", reason: "folder missing" }],
    })
    expect(listProjects().map((project) => project.path)).toEqual([existing])
    expect(getLegacySessionsNotice()).toEqual({ hasLegacySessions: true, dismissed: false })
    expect(readLegacyStore()).toEqual(before)
  })
})
