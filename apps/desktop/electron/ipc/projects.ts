import fs from "node:fs"
import fsp from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { DatabaseSync } from "node:sqlite"
import type { Platform, ProjectMeta, SessionMeta } from "@dilag/desktop-bridge"
import { getDefaultProjectsDir, getSessionsFile, getStateDbPath } from "./paths.js"

const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    path TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    platform TEXT NOT NULL DEFAULT 'web',
    pinned INTEGER NOT NULL DEFAULT 0,
    expanded INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    last_opened_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS app_state (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL
  )`,
]

type ProjectRow = {
  id: string
  path: string
  name: string
  platform: Platform
  pinned: number
  expanded: number
  created_at: string
  last_opened_at: string
}

let db: DatabaseSync | undefined
let dbPath: string | undefined

function getDb(): DatabaseSync {
  const nextDbPath = getStateDbPath()
  if (db && dbPath !== nextDbPath) {
    db.close()
    db = undefined
  }
  if (!db) {
    fs.mkdirSync(path.dirname(nextDbPath), { recursive: true })
    db = new DatabaseSync(nextDbPath)
    dbPath = nextDbPath
    db.exec("PRAGMA journal_mode = WAL")
    db.exec("PRAGMA foreign_keys = ON")
    for (const migration of MIGRATIONS) db.exec(migration)
  }
  return db
}

function toProject(row: ProjectRow): ProjectMeta {
  return {
    id: row.id,
    path: row.path,
    name: row.name,
    platform: row.platform === "mobile" ? "mobile" : "web",
    pinned: row.pinned === 1,
    expanded: row.expanded === 1,
    created_at: row.created_at,
    last_opened_at: row.last_opened_at,
  }
}

function normalizeProjectPath(projectPath: string): string {
  const expanded = projectPath.startsWith("~")
    ? path.join(os.homedir(), projectPath.slice(1))
    : projectPath
  return path.resolve(expanded)
}

function normalizeProjectFolderName(name: string): string {
  const nextName = name.trim()
  if (!nextName) throw new Error("Project folder name cannot be empty")
  if (nextName === "." || nextName === "..") throw new Error("Project folder name is invalid")
  if (nextName.includes("/") || nextName.includes("\\")) {
    throw new Error("Project folder name cannot contain path separators")
  }
  return nextName
}

function normalizeProjectName(name: string): string {
  const nextName = name.trim()
  if (!nextName) throw new Error("Project name cannot be empty")
  return nextName
}

async function uniqueProjectPath(name: string): Promise<string> {
  const root = getDefaultProjectsDir()
  const base = normalizeProjectFolderName(name)
  let candidate = path.join(root, base)
  let suffix = 2
  while (fs.existsSync(candidate)) {
    candidate = path.join(root, `${base} ${suffix}`)
    suffix += 1
  }
  return candidate
}

export function listProjects(): ProjectMeta[] {
  const rows = getDb()
    .prepare(
      `SELECT id, path, name, platform, pinned, expanded, created_at, last_opened_at
       FROM projects
       ORDER BY pinned DESC, last_opened_at DESC, created_at DESC`,
    )
    .all() as ProjectRow[]
  return rows.map(toProject)
}

export async function createProject(args: {
  name: string
  platform?: Platform
}): Promise<ProjectMeta> {
  const projectPath = await uniqueProjectPath(args.name)
  await fsp.mkdir(projectPath, { recursive: true })
  return addProjectAtPath({ path: projectPath, name: args.name, platform: args.platform })
}

export async function addExistingProject(args: {
  path: string
  platform?: Platform
}): Promise<ProjectMeta> {
  const projectPath = normalizeProjectPath(args.path)
  const stat = await fsp.stat(projectPath)
  if (!stat.isDirectory()) throw new Error("Project path must be a folder")
  return addProjectAtPath({
    path: projectPath,
    name: path.basename(projectPath),
    platform: args.platform,
  })
}

async function addProjectAtPath(args: {
  path: string
  name: string
  platform?: Platform
}): Promise<ProjectMeta> {
  const normalizedPath = normalizeProjectPath(args.path)
  const existing = getProjectByPath(normalizedPath)
  if (existing) return touchProject({ id: existing.id })

  const now = new Date().toISOString()
  const project: ProjectMeta = {
    id: `proj_${randomUUID()}`,
    path: normalizedPath,
    name: normalizeProjectName(args.name),
    platform: args.platform ?? "web",
    pinned: false,
    expanded: true,
    created_at: now,
    last_opened_at: now,
  }
  getDb()
    .prepare(
      `INSERT INTO projects (id, path, name, platform, pinned, expanded, created_at, last_opened_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      project.id,
      project.path,
      project.name,
      project.platform,
      project.pinned ? 1 : 0,
      project.expanded ? 1 : 0,
      project.created_at,
      project.last_opened_at,
    )
  return project
}

function getProjectByPath(projectPath: string): ProjectMeta | null {
  const row = getDb()
    .prepare(
      `SELECT id, path, name, platform, pinned, expanded, created_at, last_opened_at
       FROM projects
       WHERE path = ?`,
    )
    .get(normalizeProjectPath(projectPath)) as ProjectRow | undefined
  return row ? toProject(row) : null
}

export function getProjectById(id: string): ProjectMeta | null {
  const row = getDb()
    .prepare(
      `SELECT id, path, name, platform, pinned, expanded, created_at, last_opened_at
       FROM projects
       WHERE id = ?`,
    )
    .get(id) as ProjectRow | undefined
  return row ? toProject(row) : null
}

export function updateProject(args: {
  id: string
  updates: Partial<Pick<ProjectMeta, "name" | "platform" | "pinned" | "expanded">>
}): ProjectMeta {
  const current = getProjectById(args.id)
  if (!current) throw new Error(`Project ${args.id} not found`)

  const next: ProjectMeta = {
    ...current,
    ...(args.updates.name !== undefined ? { name: normalizeProjectName(args.updates.name) } : {}),
    ...(args.updates.platform !== undefined ? { platform: args.updates.platform } : {}),
    ...(args.updates.pinned !== undefined ? { pinned: args.updates.pinned } : {}),
    ...(args.updates.expanded !== undefined ? { expanded: args.updates.expanded } : {}),
  }
  getDb()
    .prepare(
      `UPDATE projects
       SET name = ?, platform = ?, pinned = ?, expanded = ?
       WHERE id = ?`,
    )
    .run(next.name, next.platform, next.pinned ? 1 : 0, next.expanded ? 1 : 0, next.id)
  return next
}

export function touchProject(args: { id: string }): ProjectMeta {
  const current = getProjectById(args.id)
  if (!current) throw new Error(`Project ${args.id} not found`)
  const lastOpenedAt = new Date().toISOString()
  getDb().prepare(`UPDATE projects SET last_opened_at = ? WHERE id = ?`).run(lastOpenedAt, args.id)
  return { ...current, last_opened_at: lastOpenedAt }
}

export function removeProject(args: { id: string }): void {
  getDb().prepare(`DELETE FROM projects WHERE id = ?`).run(args.id)
}

function getAppState<T>(key: string, fallback: T): T {
  const row = getDb().prepare(`SELECT value_json FROM app_state WHERE key = ?`).get(key) as
    | { value_json: string }
    | undefined
  if (!row) return fallback
  try {
    return JSON.parse(row.value_json) as T
  } catch {
    return fallback
  }
}

function setAppState(key: string, value: unknown): void {
  getDb()
    .prepare(
      `INSERT INTO app_state (key, value_json)
       VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json`,
    )
    .run(key, JSON.stringify(value))
}

export function getLegacySessionsNotice(): { hasLegacySessions: boolean; dismissed: boolean } {
  return {
    hasLegacySessions: fs.existsSync(getSessionsFile()),
    dismissed: getAppState("legacySessionsNoticeDismissed", false),
  }
}

export function dismissLegacySessionsNotice(): void {
  setAppState("legacySessionsNoticeDismissed", true)
}

type LegacySessionsImportResult = {
  imported: number
  skipped: Array<{ name: string; reason: string }>
}

type LegacySessionsStore = {
  sessions: SessionMeta[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function loadLegacySessionsForImport(): LegacySessionsStore {
  const parsed: unknown = JSON.parse(fs.readFileSync(getSessionsFile(), "utf8"))
  if (!isRecord(parsed) || !Array.isArray(parsed.sessions)) return { sessions: [] }
  return {
    sessions: parsed.sessions.filter((session): session is SessionMeta => {
      return (
        isRecord(session) &&
        typeof session.id === "string" &&
        typeof session.name === "string" &&
        typeof session.created_at === "string" &&
        typeof session.cwd === "string"
      )
    }),
  }
}

function getLegacySessionName(session: Pick<SessionMeta, "cwd" | "name">): string {
  return session.name.trim() || path.basename(session.cwd) || session.cwd
}

function getLegacySessionPlatform(session: SessionMeta): Platform | undefined {
  return session.platform === "web" || session.platform === "mobile" ? session.platform : undefined
}

export async function importLegacySessions(): Promise<LegacySessionsImportResult> {
  let store: LegacySessionsStore
  try {
    store = loadLegacySessionsForImport()
  } catch {
    return {
      imported: 0,
      skipped: [{ name: path.basename(getSessionsFile()), reason: "malformed sessions.json" }],
    }
  }

  let imported = 0
  const skipped: LegacySessionsImportResult["skipped"] = []

  // Legacy sessions are stored in ~/.dilag/sessions.json as SessionMeta records:
  // id, name, created_at, optional updated_at/parentID/platform/favorite/projectId, and cwd.
  // The importable project folder is cwd; ~/.dilag/sessions/{id} is the old
  // runtime/design folder and remains read-only during this migration.
  for (const session of store.sessions) {
    const name = getLegacySessionName(session)
    const projectPath = normalizeProjectPath(session.cwd)
    const stat = await fsp.stat(projectPath).catch(() => null)
    if (!stat?.isDirectory()) {
      skipped.push({ name, reason: "folder missing" })
      continue
    }

    if (getProjectByPath(projectPath)) {
      skipped.push({ name, reason: "already registered" })
      continue
    }

    await addExistingProject({ path: projectPath, platform: getLegacySessionPlatform(session) })
    imported += 1
  }

  if (store.sessions.length > 0 && skipped.every((item) => item.reason === "already registered")) {
    setAppState("legacySessionsNoticeDismissed", true)
  }

  return { imported, skipped }
}
