import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { createOpencodeClient, type Event, type OpencodeClient } from "@opencode-ai/sdk/v2/client";

// Re-export types from SDK for convenience
export type { Event } from "@opencode-ai/sdk/v2/client";
export type {
  EventMessagePartUpdated,
  EventMessageUpdated,
  EventSessionStatus,
  EventSessionUpdated,
  EventSessionDiff,
  EventSessionIdle,
  EventSessionError,
  SessionStatus,
  Part,
  ToolState,
  FileDiff,
} from "@opencode-ai/sdk/v2/client";

const OPENCODE_PORT = 4096;

type EventHandler = (event: Event) => void;

interface GlobalEventsContextValue {
  sdk: OpencodeClient;
  subscribe: (handler: EventHandler) => () => void;
  subscribeToSession: (sessionId: string, handler: EventHandler) => () => void;
  isConnected: boolean;
  isServerReady: boolean;
}

const GlobalEventsContext = createContext<GlobalEventsContextValue | null>(null);

export function GlobalEventsProvider({ children }: { children: ReactNode }) {
  const [isServerReady, setIsServerReady] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const handlersRef = useRef<Set<EventHandler>>(new Set());
  const sessionHandlersRef = useRef<Map<string, Set<EventHandler>>>(new Map());
  const abortControllerRef = useRef<AbortController | null>(null);

  // Create SDK client
  const sdkRef = useRef<OpencodeClient | null>(null);
  if (!sdkRef.current) {
    sdkRef.current = createOpencodeClient({
      baseUrl: `http://127.0.0.1:${OPENCODE_PORT}`,
    });
  }
  const sdk = sdkRef.current;

  // Subscribe to all events
  const subscribe = useCallback((handler: EventHandler): (() => void) => {
    handlersRef.current.add(handler);
    return () => handlersRef.current.delete(handler);
  }, []);

  // Subscribe to events for a specific session
  const subscribeToSession = useCallback((sessionId: string, handler: EventHandler): (() => void) => {
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
  }, []);

  // Helper to extract sessionId from any event
  const getSessionIdFromEvent = (event: Event): string | null => {
    if ("properties" in event && event.properties) {
      const props = event.properties as Record<string, unknown>;
      if ("sessionID" in props) return props.sessionID as string;
      if ("info" in props && typeof props.info === "object" && props.info !== null) {
        const info = props.info as Record<string, unknown>;
        if ("sessionID" in info) return info.sessionID as string;
      }
      if ("part" in props && typeof props.part === "object" && props.part !== null) {
        const part = props.part as Record<string, unknown>;
        if ("sessionID" in part) return part.sessionID as string;
      }
    }
    return null;
  };

  // Start server and connect to event stream
  useEffect(() => {
    let mounted = true;
    abortControllerRef.current = new AbortController();

    async function init() {
      console.log("[GlobalEvents] Starting OpenCode server...");
      try {
        const port = await invoke<number>("start_opencode_server");
        console.log("[GlobalEvents] Server started on port", port);

        if (!mounted) return;
        setIsServerReady(true);

        // Connect to SSE event stream using SDK
        console.log("[GlobalEvents] Connecting to event stream...");
        const events = await sdk.global.event();

        if (!mounted) return;
        setIsConnected(true);
        console.log("[GlobalEvents] Connected to event stream");

        // Process events
        for await (const event of events.stream) {
          if (!mounted) break;

          const payload = event.payload;
          console.log("[SSE] Event received:", payload.type);

          // Notify all global handlers
          handlersRef.current.forEach((handler) => handler(payload));

          // Notify session-specific handlers
          const sessionId = getSessionIdFromEvent(payload);
          if (sessionId) {
            const sessionHandlers = sessionHandlersRef.current.get(sessionId);
            sessionHandlers?.forEach((handler) => handler(payload));
          }
        }
      } catch (err) {
        console.error("[GlobalEvents] Error:", err);
        // Still mark as ready so UI can show error state
        if (mounted) {
          setIsServerReady(true);
          setIsConnected(false);
        }
      }
    }

    init();

    return () => {
      mounted = false;
      abortControllerRef.current?.abort();
      console.log("[GlobalEvents] Cleanup - disconnected");
    };
  }, [sdk]);

  return (
    <GlobalEventsContext.Provider
      value={{
        sdk,
        subscribe,
        subscribeToSession,
        isConnected,
        isServerReady,
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

export function useSDK() {
  const { sdk } = useGlobalEvents();
  return sdk;
}
