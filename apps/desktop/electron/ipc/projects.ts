import fs from "node:fs"
import fsp from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { DatabaseSync } from "node:sqlite"
import type { Platform, ProjectMeta } from "@dilag/desktop-bridge"
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

function getDb(): DatabaseSync {
  if (!db) {
    fs.mkdirSync(path.dirname(getStateDbPath()), { recursive: true })
    db = new DatabaseSync(getStateDbPath())
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

function slugify(input: string): string {
  const slug = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return slug || "untitled-project"
}

async function uniqueProjectPath(name: string): Promise<string> {
  const root = getDefaultProjectsDir()
  const base = slugify(name)
  let candidate = path.join(root, base)
  let suffix = 2
  while (fs.existsSync(candidate)) {
    candidate = path.join(root, `${base}-${suffix}`)
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
    name: args.name.trim() || path.basename(normalizedPath),
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
  const next: ProjectMeta = { ...current, ...args.updates }
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
