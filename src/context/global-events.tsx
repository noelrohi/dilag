import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";

// Get base URL directly to avoid circular dependency with opencode.ts
async function getEventStreamUrl(): Promise<string> {
  const port = await invoke<number>("get_opencode_port");
  return `http://127.0.0.1:${port}/event`;
}

// Event types matching OpenCode's event system
export type SessionStatus = "idle" | "running" | "error" | "unknown";

export interface EventMessagePartUpdated {
  type: "message.part.updated";
  properties: {
    part: {
      id: string;
      sessionID?: string;
      messageID?: string;
      type: "text" | "tool" | "reasoning" | "file" | "step-start" | "step-finish";
      text?: string;
      tool?: string;
      state?: ToolState;
      mime?: string;
      url?: string;
      filename?: string;
      provider?: string;
      model?: string;
    };
    delta?: string;
  };
}

export interface EventMessageUpdated {
  type: "message.updated";
  properties: {
    info: {
      id: string;
      sessionID: string;
      role: "user" | "assistant";
      time: { created: number; completed?: number };
    };
  };
}

export interface EventSessionStatus {
  type: "session.status";
  properties: {
    sessionID: string;
    status: SessionStatus;
  };
}

export interface EventSessionUpdated {
  type: "session.updated";
  properties: {
    info: {
      id: string;
      title: string;
      directory: string;
      time: { created: number; updated: number };
    };
  };
}

export interface EventSessionDiff {
  type: "session.diff";
  properties: {
    sessionID: string;
    diffs: FileDiff[];
  };
}

export interface FileDiff {
  path: string;
  hunks: DiffHunk[];
  additions: number;
  deletions: number;
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
}

export interface EventSessionIdle {
  type: "session.idle";
  properties: {
    sessionID: string;
  };
}

export interface EventSessionError {
  type: "session.error";
  properties: {
    sessionID: string;
    error: string;
  };
}

export type ToolState =
  | { status: "pending" }
  | { status: "running"; metadata?: Record<string, unknown> }
  | { status: "completed"; input: Record<string, unknown>; output?: string; metadata?: Record<string, unknown> }
  | { status: "error"; error: string };

export type OpenCodeEvent =
  | EventMessagePartUpdated
  | EventMessageUpdated
  | EventSessionStatus
  | EventSessionUpdated
  | EventSessionDiff
  | EventSessionIdle
  | EventSessionError
  | { type: string; properties: unknown };

// Event emitter type
type EventHandler<T = OpenCodeEvent> = (event: T) => void;

interface GlobalEventsContextValue {
  subscribe: (handler: EventHandler) => () => void;
  subscribeToSession: (sessionId: string, handler: EventHandler) => () => void;
  isConnected: boolean;
}

const GlobalEventsContext = createContext<GlobalEventsContextValue | null>(null);

export function GlobalEventsProvider({ children }: { children: ReactNode }) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const handlersRef = useRef<Set<EventHandler>>(new Set());
  const sessionHandlersRef = useRef<Map<string, Set<EventHandler>>>(new Map());
  const isConnectedRef = useRef(false);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Connect to event stream
  const connect = async () => {
    if (eventSourceRef.current?.readyState === EventSource.OPEN) return;

    try {
      const url = await getEventStreamUrl();
      const eventSource = new EventSource(url);

      eventSource.onopen = () => {
        isConnectedRef.current = true;
        console.log("[GlobalEvents] Connected to event stream");
      };

      eventSource.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data) as OpenCodeEvent;

          // Notify all global handlers
          handlersRef.current.forEach((handler) => handler(event));

          // Notify session-specific handlers
          const sessionId = getSessionIdFromEvent(event);
          if (sessionId) {
            const sessionHandlers = sessionHandlersRef.current.get(sessionId);
            sessionHandlers?.forEach((handler) => handler(event));
          }
        } catch {
          // Ignore parse errors
        }
      };

      eventSource.onerror = () => {
        isConnectedRef.current = false;
        eventSource.close();
        eventSourceRef.current = null;

        // Reconnect after delay
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log("[GlobalEvents] Reconnecting...");
          connect();
        }, 2000);
      };

      eventSourceRef.current = eventSource;
    } catch (error) {
      console.error("[GlobalEvents] Failed to connect:", error);
      reconnectTimeoutRef.current = setTimeout(connect, 2000);
    }
  };

  // Disconnect from event stream
  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    isConnectedRef.current = false;
  };

  // Subscribe to all events
  const subscribe = (handler: EventHandler): (() => void) => {
    handlersRef.current.add(handler);
    return () => handlersRef.current.delete(handler);
  };

  // Subscribe to events for a specific session
  const subscribeToSession = (sessionId: string, handler: EventHandler): (() => void) => {
    if (!sessionHandlersRef.current.has(sessionId)) {
      sessionHandlersRef.current.set(sessionId, new Set());
    }
    sessionHandlersRef.current.get(sessionId)!.add(handler);

    return () => {
      const handlers = sessionHandlersRef.current.get(sessionId);
      handlers?.delete(handler);
      if (handlers?.size === 0) {
        sessionHandlersRef.current.delete(sessionId);
      }
    };
  };

  // Connect on mount
  useEffect(() => {
    connect();
    return () => disconnect();
  }, []);

  return (
    <GlobalEventsContext.Provider
      value={{
        subscribe,
        subscribeToSession,
        isConnected: isConnectedRef.current,
      }}
    >
      {children}
    </GlobalEventsContext.Provider>
  );
}

export function useGlobalEvents() {
  const context = useContext(GlobalEventsContext);
  if (!context) {
    throw new Error("useGlobalEvents must be used within a GlobalEventsProvider");
  }
  return context;
}

// Helper to extract sessionId from any event
function getSessionIdFromEvent(event: OpenCodeEvent): string | null {
  switch (event.type) {
    case "message.part.updated":
      return (event as EventMessagePartUpdated).properties.part.sessionID ?? null;
    case "message.updated":
      return (event as EventMessageUpdated).properties.info.sessionID;
    case "session.status":
      return (event as EventSessionStatus).properties.sessionID;
    case "session.diff":
      return (event as EventSessionDiff).properties.sessionID;
    case "session.idle":
      return (event as EventSessionIdle).properties.sessionID;
    case "session.error":
      return (event as EventSessionError).properties.sessionID;
    default:
      return null;
  }
}
