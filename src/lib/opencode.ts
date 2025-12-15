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
  sessionID?: string;
  messageID?: string;
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
export async function createSession(directory?: string): Promise<OpenCodeSession> {
  // Pass directory param to set session's working directory for isolation
  const url = directory
    ? `${baseUrl}/session?directory=${encodeURIComponent(directory)}`
    : `${baseUrl}/session`;

  const response = await fetch(url, {
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
  sessionId: string,
  directory?: string
): Promise<OpenCodeMessage[]> {
  const url = directory
    ? `${baseUrl}/session/${sessionId}/message?directory=${encodeURIComponent(directory)}`
    : `${baseUrl}/session/${sessionId}/message`;
  const response = await fetch(url, {
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

// Fetch a single session by ID (includes title)
export async function getSession(sessionId: string, directory?: string): Promise<OpenCodeSession> {
  const url = directory
    ? `${baseUrl}/session/${sessionId}?directory=${encodeURIComponent(directory)}`
    : `${baseUrl}/session/${sessionId}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to get session: ${response.statusText}`);
  }
  return response.json();
}

// Event stream types
export interface EventMessagePartUpdated {
  type: "message.part.updated";
  properties: {
    part: MessagePart;
    delta?: string;
  };
}

export interface EventMessageUpdated {
  type: "message.updated";
  properties: {
    info: MessageInfo;
  };
}

export type OpenCodeEvent =
  | EventMessagePartUpdated
  | EventMessageUpdated
  | { type: string; properties: unknown };

// Create an EventSource connection to the event stream
export function createEventSource(
  onEvent: (event: OpenCodeEvent) => void,
  onError?: (error: Event) => void,
  directory?: string
): EventSource {
  // Pass directory to scope events to the correct project context
  const url = directory
    ? `${baseUrl}/event?directory=${encodeURIComponent(directory)}`
    : `${baseUrl}/event`;
  const eventSource = new EventSource(url);

  eventSource.onmessage = (e) => {
    try {
      const event = JSON.parse(e.data) as OpenCodeEvent;
      onEvent(event);
    } catch {
      // Ignore parse errors
    }
  };

  if (onError) {
    eventSource.onerror = onError;
  }

  return eventSource;
}

// Send message and stream response via events
export async function sendMessageStreaming(
  sessionId: string,
  text: string,
  callbacks: {
    onText: (delta: string, partId: string) => void;
    onComplete: (messageInfo: MessageInfo) => void;
    onError?: (error: Error) => void;
  },
  model = DEFAULT_MODEL,
  directory?: string
): Promise<() => void> {
  let messageId: string | null = null;
  let eventSource: EventSource | null = null;

  // Set up event listener before sending (pass directory for correct event scoping)
  eventSource = createEventSource(
    (event) => {
      if (event.type === "message.part.updated") {
        const partEvent = event as EventMessagePartUpdated;
        const { part, delta } = partEvent.properties;
        // Only handle parts for our session
        if (part.sessionID === sessionId && part.type === "text" && delta) {
          messageId = part.messageID ?? null;
          callbacks.onText(delta, part.id);
        }
      } else if (event.type === "message.updated") {
        const msgEvent = event as EventMessageUpdated;
        const { info } = msgEvent.properties;
        // Check if this is our message completing
        if (
          info.sessionID === sessionId &&
          info.role === "assistant" &&
          info.time.completed &&
          (messageId === null || info.id === messageId)
        ) {
          callbacks.onComplete(info);
        }
      }
    },
    undefined,
    directory
  );

  // Build URL with optional directory parameter
  const messageUrl = directory
    ? `${baseUrl}/session/${sessionId}/message?directory=${encodeURIComponent(directory)}`
    : `${baseUrl}/session/${sessionId}/message`;

  // Send the message
  try {
    const response = await fetch(messageUrl, {
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
  } catch (error) {
    eventSource?.close();
    callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
    throw error;
  }

  // Return cleanup function
  return () => {
    eventSource?.close();
  };
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
