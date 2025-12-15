import { invoke } from "@tauri-apps/api/core";

const DEFAULT_MODEL = {
  providerID: "anthropic",
  modelID: "claude-opus-4-5",
};

let baseUrl = "http://127.0.0.1:4096";

export async function getBaseUrl(): Promise<string> {
  const port = await invoke<number>("get_opencode_port");
  baseUrl = `http://127.0.0.1:${port}`;
  return baseUrl;
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

// OpenCode API types
export interface OpenCodeSession {
  id: string;
  version: string;
  projectID: string;
  directory: string;
  title: string;
  time: { created: number; updated: number };
}

export interface MessagePart {
  id: string;
  type: string;
  text?: string;
  [key: string]: unknown;
}

export interface MessageInfo {
  id: string;
  sessionID: string;
  role: "user" | "assistant";
  time: { created: number; completed?: number };
  [key: string]: unknown;
}

export interface OpenCodeMessage {
  info: MessageInfo;
  parts: MessagePart[];
}

// OpenCode API functions
export async function createSession(): Promise<OpenCodeSession> {
  const response = await fetch(`${baseUrl}/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!response.ok) {
    throw new Error(`Failed to create session: ${response.statusText}`);
  }
  return response.json();
}

export async function deleteSession(sessionId: string): Promise<void> {
  const response = await fetch(`${baseUrl}/session/${sessionId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(`Failed to delete session: ${response.statusText}`);
  }
}

export async function getSessionMessages(
  sessionId: string
): Promise<OpenCodeMessage[]> {
  const response = await fetch(`${baseUrl}/session/${sessionId}/message`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Failed to get messages: ${response.statusText}`);
  }
  return response.json();
}

export interface SendMessageResponse {
  info: MessageInfo;
  parts: MessagePart[];
}

export async function sendMessage(
  sessionId: string,
  text: string,
  model = DEFAULT_MODEL
): Promise<SendMessageResponse> {
  const response = await fetch(`${baseUrl}/session/${sessionId}/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      parts: [{ type: "text", text }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to send message: ${errorText}`);
  }

  return response.json();
}

// Helper to extract text content from message parts
export function extractTextFromParts(parts: MessagePart[]): string {
  return parts
    .filter((p) => p.type === "text" && p.text)
    .map((p) => p.text!)
    .join("");
}

// Auth types and functions
export interface ProviderInfo {
  id: string;
  name: string;
  key?: string | null;
  options?: { apiKey?: string };
  models: Record<string, unknown>;
}

export interface AuthMethod {
  type: "oauth" | "api";
  label: string;
}

export interface OAuthAuthorizeResponse {
  url: string;
  method: string;
  instructions: string;
}

export async function getProviders(): Promise<{
  all: ProviderInfo[];
  connected: string[];
}> {
  const response = await fetch(`${baseUrl}/provider`);
  if (!response.ok) {
    throw new Error(`Failed to get providers: ${response.statusText}`);
  }
  return response.json();
}

export async function getProviderAuthMethods(): Promise<
  Record<string, AuthMethod[]>
> {
  const response = await fetch(`${baseUrl}/provider/auth`);
  if (!response.ok) {
    throw new Error(`Failed to get auth methods: ${response.statusText}`);
  }
  return response.json();
}

export async function startOAuthFlow(
  providerId: string,
  methodIndex: number
): Promise<OAuthAuthorizeResponse> {
  const response = await fetch(
    `${baseUrl}/provider/${providerId}/oauth/authorize`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: methodIndex }),
    }
  );
  if (!response.ok) {
    throw new Error(`Failed to start OAuth: ${response.statusText}`);
  }
  return response.json();
}

export async function completeOAuthFlow(
  providerId: string,
  code: string
): Promise<boolean> {
  const response = await fetch(
    `${baseUrl}/provider/${providerId}/oauth/callback?code=${encodeURIComponent(code)}`,
    { method: "GET" }
  );
  if (!response.ok) {
    throw new Error(`Failed to complete OAuth: ${response.statusText}`);
  }
  return true;
}

export async function setApiKey(
  providerId: string,
  apiKey: string
): Promise<boolean> {
  const response = await fetch(`${baseUrl}/auth/${providerId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "api", key: apiKey }),
  });
  if (!response.ok) {
    throw new Error(`Failed to set API key: ${response.statusText}`);
  }
  return response.json();
}

export async function disconnectProvider(providerId: string): Promise<boolean> {
  const response = await fetch(`${baseUrl}/auth/${providerId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "api", key: "" }),
  });
  if (!response.ok) {
    throw new Error(`Failed to disconnect: ${response.statusText}`);
  }
  return true;
}
