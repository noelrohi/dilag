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

// SSE Reconnection Configuration
const SSE_CONFIG = {
  defaultRetryDelay: 3000,      // 3 seconds initial delay
  maxRetryDelay: 30000,         // 30 seconds max delay
  maxRetryAttempts: undefined,  // Unlimited retries by default
  backoffFactor: 2,             // Double delay each attempt
};

type EventHandler = (event: Event) => void;

// Connection status type
export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "reconnecting";

interface GlobalEventsContextValue {
  sdk: OpencodeClient;
  subscribe: (handler: EventHandler) => () => void;
  subscribeToSession: (sessionId: string, handler: EventHandler) => () => void;
  connectionStatus: ConnectionStatus;
  reconnectAttempt: number;
  isConnected: boolean;
  isServerReady: boolean;
  bootstrap: () => Promise<void>;
}

const GlobalEventsContext = createContext<GlobalEventsContextValue | null>(null);

export function GlobalEventsProvider({ children }: { children: ReactNode }) {
  const [isServerReady, setIsServerReady] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const handlersRef = useRef<Set<EventHandler>>(new Set());
  const sessionHandlersRef = useRef<Map<string, Set<EventHandler>>>(new Map());
  const abortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const bootstrapCallbacksRef = useRef<Set<() => void>>(new Set());

  // Create SDK client with timeout disabled for SSE
  const sdkRef = useRef<OpencodeClient | null>(null);
  if (!sdkRef.current) {
    const customFetch = (input: RequestInfo | URL, init?: RequestInit) => {
      // Disable timeout for SSE connections
      if (init && typeof input === "string" && input.includes("/event")) {
        // @ts-expect-error - timeout is a non-standard property
        if (init) init.timeout = false;
      }
      return fetch(input, init);
    };
    
    sdkRef.current = createOpencodeClient({
      baseUrl: `http://127.0.0.1:${OPENCODE_PORT}`,
      fetch: customFetch,
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

  // Calculate retry delay with exponential backoff
  const calculateRetryDelay = (attempt: number, serverRetryDelay?: number): number => {
    // If server provided a retry delay, use it
    if (serverRetryDelay !== undefined) {
      return serverRetryDelay;
    }
    // Otherwise use exponential backoff
    const delay = SSE_CONFIG.defaultRetryDelay * Math.pow(SSE_CONFIG.backoffFactor, attempt - 1);
    return Math.min(delay, SSE_CONFIG.maxRetryDelay);
  };

  // Bootstrap function to reload all state after reconnection
  const bootstrap = useCallback(async () => {
    console.log("[GlobalEvents] Running bootstrap - notifying listeners");
    // Notify all registered bootstrap callbacks
    bootstrapCallbacksRef.current.forEach((callback) => callback());
  }, []);

  // Handle disposal events that require re-bootstrap
  const handleDisposalEvent = useCallback((event: Event) => {
    if (event.type === "global.disposed") {
      console.log("[GlobalEvents] Global disposed - running full bootstrap");
      bootstrap();
    } else if (event.type === "server.instance.disposed") {
      console.log("[GlobalEvents] Server instance disposed - running bootstrap");
      bootstrap();
    }
  }, [bootstrap]);

  // Connect to SSE with reconnection logic
  const connectToSSE = useCallback(async () => {
    let attempt = 0;
    let serverRetryDelay: number | undefined;

    while (mountedRef.current) {
      // Check max retry attempts
      if (SSE_CONFIG.maxRetryAttempts !== undefined && attempt >= SSE_CONFIG.maxRetryAttempts) {
        console.log("[GlobalEvents] Max retry attempts reached, giving up");
        setConnectionStatus("disconnected");
        break;
      }

      attempt++;
      setReconnectAttempt(attempt);
      
      if (attempt === 1) {
        setConnectionStatus("connecting");
      } else {
        setConnectionStatus("reconnecting");
        console.log(`[GlobalEvents] Reconnection attempt ${attempt}...`);
      }

      try {
        console.log("[GlobalEvents] Connecting to event stream...");
        const events = await sdk.global.event();

        if (!mountedRef.current) break;
        
        // Reset attempt counter on successful connection
        attempt = 0;
        setReconnectAttempt(0);
        setConnectionStatus("connected");
        console.log("[GlobalEvents] Connected to event stream");

        // Run bootstrap on reconnection (but not first connection)
        if (attempt > 1) {
          await bootstrap();
        }

        // Process events
        for await (const event of events.stream) {
          if (!mountedRef.current) break;

          const payload = event.payload;
          console.log("[SSE] Event received:", payload.type);

          // Handle disposal events first
          handleDisposalEvent(payload);

          // Notify all global handlers
          handlersRef.current.forEach((handler) => {
            try {
              handler(payload);
            } catch (err) {
              console.error("[GlobalEvents] Handler error:", err);
            }
          });

          // Notify session-specific handlers
          const sessionId = getSessionIdFromEvent(payload);
          if (sessionId) {
            const sessionHandlers = sessionHandlersRef.current.get(sessionId);
            sessionHandlers?.forEach((handler) => {
              try {
                handler(payload);
              } catch (err) {
                console.error("[GlobalEvents] Session handler error:", err);
              }
            });
          }
        }

        // Stream ended normally (server closed connection)
        console.log("[GlobalEvents] Stream ended, will reconnect...");
      } catch (err) {
        console.error("[GlobalEvents] Connection error:", err);
        
        if (!mountedRef.current) break;
        setConnectionStatus("reconnecting");
      }

      // Calculate and wait for retry delay
      const delay = calculateRetryDelay(attempt, serverRetryDelay);
      console.log(`[GlobalEvents] Waiting ${delay}ms before retry...`);
      
      await new Promise((resolve) => {
        const timeout = setTimeout(resolve, delay);
        // Allow abort to cancel the delay
        if (abortControllerRef.current) {
          abortControllerRef.current.signal.addEventListener("abort", () => {
            clearTimeout(timeout);
            resolve(undefined);
          }, { once: true });
        }
      });
    }
  }, [sdk, bootstrap, handleDisposalEvent]);

  // Start server and connect to event stream
  useEffect(() => {
    mountedRef.current = true;
    abortControllerRef.current = new AbortController();

    async function init() {
      console.log("[GlobalEvents] Starting OpenCode server...");
      try {
        const port = await invoke<number>("start_opencode_server");
        console.log("[GlobalEvents] Server started on port", port);

        if (!mountedRef.current) return;
        setIsServerReady(true);

        // Start SSE connection with reconnection logic
        await connectToSSE();
      } catch (err) {
        console.error("[GlobalEvents] Server start error:", err);
        if (mountedRef.current) {
          setIsServerReady(false);
          setConnectionStatus("disconnected");
        }
      }
    }

    init();

    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
      console.log("[GlobalEvents] Cleanup - disconnected");
    };
  }, [connectToSSE]);

  return (
    <GlobalEventsContext.Provider
      value={{
        sdk,
        subscribe,
        subscribeToSession,
        connectionStatus,
        reconnectAttempt,
        isConnected: connectionStatus === "connected",
        isServerReady,
        bootstrap,
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

export function useConnectionStatus() {
  const { connectionStatus, reconnectAttempt } = useGlobalEvents();
  return { connectionStatus, reconnectAttempt };
}
