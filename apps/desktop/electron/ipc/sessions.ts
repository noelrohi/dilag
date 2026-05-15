import fs from "node:fs"
import fsp from "node:fs/promises"
import path from "node:path"
import type { SessionMeta } from "@dilag/desktop-bridge"
import { getSessionsDir, getSessionsFile } from "./paths.js"

type SessionsStore = { sessions: SessionMeta[] }

function loadSessionsStore(): SessionsStore {
  try {
    return JSON.parse(fs.readFileSync(getSessionsFile(), "utf8"))
  } catch {
    return { sessions: [] }
  }
}

async function saveSessionsStore(store: SessionsStore) {
  await fsp.mkdir(path.dirname(getSessionsFile()), { recursive: true })
  await fsp.writeFile(getSessionsFile(), JSON.stringify(store, null, 2))
}

export async function createSessionDir(sessionId: string): Promise<string> {
  const sessionDir = path.join(getSessionsDir(), sessionId)
  await fsp.mkdir(path.join(sessionDir, "screens"), { recursive: true })
  return sessionDir
}

export function getSessionCwd(sessionId?: string): string {
  return path.join(getSessionsDir(), sessionId ?? "")
}

export function loadSessionsMeta(): SessionMeta[] {
  return loadSessionsStore().sessions
}

export async function saveSessionMeta(session: SessionMeta): Promise<void> {
  const store = loadSessionsStore()
  const index = store.sessions.findIndex((item) => item.id === session.id)
  if (index >= 0) store.sessions[index] = session
  else store.sessions.push(session)
  await saveSessionsStore(store)
}

export async function deleteSessionMeta(sessionId: string): Promise<void> {
  const store = loadSessionsStore()
  store.sessions = store.sessions.filter((session) => session.id !== sessionId)
  await saveSessionsStore(store)
  await fsp.rm(path.join(getSessionsDir(), sessionId), { recursive: true, force: true })
}

export async function toggleSessionFavorite(sessionId: string): Promise<boolean> {
  const store = loadSessionsStore()
  const session = store.sessions.find((item) => item.id === sessionId)
  if (!session) throw new Error(`Session ${sessionId} not found`)
  session.favorite = !session.favorite
  await saveSessionsStore(store)
  return session.favorite
}
