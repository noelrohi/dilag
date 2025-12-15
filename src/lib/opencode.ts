// Import only the client to avoid server.js which uses Node.js APIs
import { createOpencodeClient } from "@opencode-ai/sdk/client";
import { invoke } from "@tauri-apps/api/core";

export type OpencodeClient = ReturnType<typeof createOpencodeClient>;

let clientInstance: OpencodeClient | null = null;

export async function getClient(): Promise<OpencodeClient> {
  if (clientInstance) {
    return clientInstance;
  }

  const port = await invoke<number>("get_opencode_port");
  clientInstance = createOpencodeClient({
    baseUrl: `http://127.0.0.1:${port}`,
  });

  return clientInstance;
}

export async function startServer(): Promise<number> {
  return invoke<number>("start_opencode_server");
}

export async function stopServer(): Promise<void> {
  return invoke<void>("stop_opencode_server");
}

export async function isServerRunning(): Promise<boolean> {
  return invoke<boolean>("is_opencode_running");
}

export interface SessionMeta {
  id: string;
  name: string;
  created_at: string;
  cwd: string;
}

export async function createSessionDir(sessionId: string): Promise<string> {
  return invoke<string>("create_session_dir", { sessionId });
}

export async function getSessionCwd(sessionId: string): Promise<string> {
  return invoke<string>("get_session_cwd", { sessionId });
}

export async function saveSessionMetadata(session: SessionMeta): Promise<void> {
  return invoke<void>("save_session_metadata", { session });
}

export async function loadSessionsMetadata(): Promise<SessionMeta[]> {
  return invoke<SessionMeta[]>("load_sessions_metadata");
}

export async function deleteSessionMetadata(sessionId: string): Promise<void> {
  return invoke<void>("delete_session_metadata", { sessionId });
}
