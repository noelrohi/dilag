import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type { Event, FileDiff, ToolState } from "@opencode-ai/sdk/v2/client";
import {
  isEventMessagePartUpdated,
  isEventMessageUpdated,
  isEventSessionStatus,
  isEventSessionDiff,
  isEventSessionIdle,
  isEventSessionError,
} from "@/lib/event-guards";

// Re-export SDK types
export type { ToolState, FileDiff };

// Our internal session status type (simpler than SDK's object type)
export type SessionStatus = "idle" | "running" | "busy" | "error" | "unknown";

// Types
export interface SessionMeta {
  id: string;
  name: string;
  created_at: string;
  cwd: string;
}

export interface MessagePart {
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
}

export interface Message {
  id: string;
  sessionID: string;
  role: "user" | "assistant";
  time: { created: number; completed?: number };
  isStreaming?: boolean;
}

// Design screen type for preview components
export interface DesignScreen {
  id: string;
  sessionId: string;
  messageId: string;
  title: string;
  type: "mobile" | "web";
  filePath: string;
  html: string;
  createdAt: number;
}

// Screen position for canvas
export interface ScreenPosition {
  id: string;
  x: number;
  y: number;
}

/**
 * Session Store - Zustand store for CLIENT-ONLY and REAL-TIME state
 * 
 * Architecture (TkDodo/KCD hybrid approach):
 * - Zustand handles: Real-time SSE data (messages, parts), UI state, client preferences
 * - React Query handles: Server state fetching (sessions list, initial message load)
 * 
 * This store intentionally does NOT manage the sessions list - that's in React Query.
 */
interface SessionState {
  // Client state (UI preferences)
  currentSessionId: string | null;
  screenPositions: Record<string, ScreenPosition[]>; // Persisted

  // Real-time state (from SSE events)
  messages: Record<string, Message[]>; // Keyed by sessionId
  parts: Record<string, MessagePart[]>; // Keyed by messageId
  sessionStatus: Record<string, SessionStatus>; // Keyed by sessionId
  sessionDiffs: Record<string, FileDiff[]>; // Keyed by sessionId
  sessionErrors: Record<string, { name: string; message: string } | null>; // Keyed by sessionId

  // Server connection state
  isServerReady: boolean;
  error: string | null;

  // Debug
  debugEvents: Event[];

  // Actions - Client state
  setCurrentSessionId: (id: string | null) => void;
  setScreenPositions: (sessionId: string, positions: ScreenPosition[]) => void;

  // Actions - Real-time state
  setMessages: (sessionId: string, messages: Message[]) => void;
  addMessage: (sessionId: string, message: Message) => void;
  updateMessage: (sessionId: string, messageId: string, updates: Partial<Message>) => void;
  updatePart: (messageId: string, part: MessagePart) => void;
  setSessionStatus: (sessionId: string, status: SessionStatus) => void;
  setSessionDiffs: (sessionId: string, diffs: FileDiff[]) => void;
  setSessionError: (sessionId: string, error: { name: string; message: string } | null) => void;
  clearSessionData: (sessionId: string) => void;

  // Actions - Server state
  setServerReady: (ready: boolean) => void;
  setError: (error: string | null) => void;

  // Actions - Debug
  addDebugEvent: (event: Event) => void;
  clearDebugEvents: () => void;

  // Event handler for SSE
  handleEvent: (event: Event) => void;

  // Bootstrap/Reset - Called after SSE reconnection
  resetRealtimeState: () => void;
}

// Binary search for efficient sorted insertions (by ID for lookups)
function binarySearch<T>(arr: T[], id: string, getId: (item: T) => string): { found: boolean; index: number } {
  let low = 0;
  let high = arr.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const midId = getId(arr[mid]);

    if (midId === id) {
      return { found: true, index: mid };
    } else if (midId < id) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return { found: false, index: low };
}

// Binary search by timestamp for message ordering
function binarySearchByTime(arr: Message[], timestamp: number): { index: number } {
  let low = 0;
  let high = arr.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (arr[mid].time.created < timestamp) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return { index: low };
}

export const useSessionStore = create<SessionState>()(
  persist(
    immer((set, get) => ({
      // Initial state
      currentSessionId: null,
      screenPositions: {},
      messages: {},
      parts: {},
      sessionStatus: {},
      sessionDiffs: {},
      sessionErrors: {},
      isServerReady: false,
      error: null,
      debugEvents: [],

      // Client state actions
      setCurrentSessionId: (id) =>
        set((state) => {
          state.currentSessionId = id;
        }),

      setScreenPositions: (sessionId, positions) =>
        set((state) => {
          state.screenPositions[sessionId] = positions;
        }),

      // Real-time state actions
      setMessages: (sessionId, messages) =>
        set((state) => {
          state.messages[sessionId] = messages;
        }),

      addMessage: (sessionId, message) =>
        set((state) => {
          if (!state.messages[sessionId]) {
            state.messages[sessionId] = [];
          }
          const exists = state.messages[sessionId].some((m) => m.id === message.id);
          if (exists) return;

          const { index } = binarySearchByTime(state.messages[sessionId], message.time.created);
          state.messages[sessionId].splice(index, 0, message);
        }),

      updateMessage: (sessionId, messageId, updates) =>
        set((state) => {
          const messages = state.messages[sessionId];
          if (!messages) return;

          const result = binarySearch(messages, messageId, (m) => m.id);
          if (result.found) {
            Object.assign(messages[result.index], updates);
          }
        }),

      updatePart: (messageId, part) =>
        set((state) => {
          const parts = state.parts[messageId];
          if (!parts) {
            state.parts[messageId] = [part];
            return;
          }

          const result = binarySearch(parts, part.id, (p) => p.id);
          if (result.found) {
            parts[result.index] = part;
          } else {
            parts.splice(result.index, 0, part);
          }
        }),

      setSessionStatus: (sessionId, status) =>
        set((state) => {
          state.sessionStatus[sessionId] = status;
        }),

      setSessionDiffs: (sessionId, diffs) =>
        set((state) => {
          state.sessionDiffs[sessionId] = diffs;
        }),

      setSessionError: (sessionId, error) =>
        set((state) => {
          state.sessionErrors[sessionId] = error;
        }),

      clearSessionData: (sessionId) =>
        set((state) => {
          delete state.messages[sessionId];
          delete state.sessionStatus[sessionId];
          delete state.sessionDiffs[sessionId];
          delete state.sessionErrors[sessionId];
          if (state.currentSessionId === sessionId) {
            state.currentSessionId = null;
          }
        }),

      // Server state actions
      setServerReady: (ready) =>
        set((state) => {
          state.isServerReady = ready;
        }),

      setError: (error) =>
        set((state) => {
          state.error = error;
        }),

      // Debug actions
      addDebugEvent: (event) =>
        set((state) => {
          if (state.debugEvents.length >= 500) {
            state.debugEvents = state.debugEvents.slice(-499);
          }
          state.debugEvents.push(event);
        }),

      clearDebugEvents: () =>
        set((state) => {
          state.debugEvents = [];
        }),

      // Reset realtime state - called after SSE reconnection to clear stale data
      resetRealtimeState: () =>
        set((state) => {
          // Clear all real-time state but preserve client preferences
          state.messages = {};
          state.parts = {};
          state.sessionStatus = {};
          state.sessionDiffs = {};
          state.sessionErrors = {};
          state.debugEvents = [];
          state.error = null;
          // Note: currentSessionId and screenPositions are preserved
        }),

      // Central event handler for SSE - handles real-time updates
      handleEvent: (event) => {
        const { addDebugEvent, updatePart, addMessage, updateMessage, setSessionStatus, setSessionDiffs, setSessionError } = get();

        addDebugEvent(event);

        // Use type guards for type-safe event handling
        if (isEventMessagePartUpdated(event)) {
          const sdkPart = event.properties.part;
          if (sdkPart.messageID) {
            const part: MessagePart = {
              id: sdkPart.id,
              messageID: sdkPart.messageID,
              sessionID: sdkPart.sessionID,
              type: sdkPart.type as MessagePart["type"],
              text: "text" in sdkPart ? sdkPart.text : undefined,
              tool: "tool" in sdkPart ? sdkPart.tool : undefined,
              state: "state" in sdkPart ? sdkPart.state : undefined,
            };
            updatePart(sdkPart.messageID, part);
          }
          return;
        }

        if (isEventMessageUpdated(event)) {
          const { info } = event.properties;
          const state = get();
          const messages = state.messages[info.sessionID];
          const exists = messages?.some((m) => m.id === info.id);
          const isCompleted = "completed" in info.time && !!info.time.completed;

          if (!exists) {
            const newMessage: Message = {
              id: info.id,
              sessionID: info.sessionID,
              role: info.role,
              time: info.time as { created: number; completed?: number },
              isStreaming: !isCompleted,
            };
            addMessage(info.sessionID, newMessage);
          } else if (isCompleted) {
            updateMessage(info.sessionID, info.id, {
              isStreaming: false,
              time: info.time as { created: number; completed?: number },
            });
          }
          return;
        }

        if (isEventSessionStatus(event)) {
          const { sessionID, status } = event.properties;
          const statusType = status.type as SessionStatus;
          setSessionStatus(sessionID, statusType);
          return;
        }

        if (isEventSessionDiff(event)) {
          const { sessionID, diff } = event.properties;
          setSessionDiffs(sessionID, diff);
          return;
        }

        if (isEventSessionIdle(event)) {
          setSessionStatus(event.properties.sessionID, "idle");
          return;
        }

        if (isEventSessionError(event)) {
          const { sessionID, error } = event.properties;
          if (sessionID) {
            setSessionStatus(sessionID, "error");
            // Extract error message from typed error
            if (error && "data" in error && error.data) {
              const data = error.data as Record<string, unknown>;
              const message = data.message || "Unknown error";
              setSessionError(sessionID, {
                name: error.name,
                message: typeof message === "string" ? message : "Unknown error",
              });
            }
          }
          return;
        }

        // Log unhandled event types for debugging
        console.debug("[SessionStore] Unhandled event type:", event.type);
      },
    })),
    {
      name: "dilag-session-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        currentSessionId: state.currentSessionId,
        screenPositions: state.screenPositions,
      }),
    }
  )
);

// Stable empty references to avoid re-renders
const EMPTY_MESSAGES: Message[] = [];
const EMPTY_PARTS: MessagePart[] = [];
const EMPTY_DIFFS: FileDiff[] = [];
const EMPTY_POSITIONS: ScreenPosition[] = [];

// Selector hooks for Zustand state
export const useCurrentSessionId = () => useSessionStore((state) => state.currentSessionId);
export const useSessionMessages = (sessionId: string | null) =>
  useSessionStore((state) => (sessionId ? state.messages[sessionId] ?? EMPTY_MESSAGES : EMPTY_MESSAGES));
export const useMessageParts = (messageId: string | null) =>
  useSessionStore((state) => (messageId ? state.parts[messageId] ?? EMPTY_PARTS : EMPTY_PARTS));
export const useSessionStatus = (sessionId: string | null) =>
  useSessionStore((state) => (sessionId ? state.sessionStatus[sessionId] ?? "unknown" : "unknown"));
export const useSessionDiffs = (sessionId: string | null) =>
  useSessionStore((state) => (sessionId ? state.sessionDiffs[sessionId] ?? EMPTY_DIFFS : EMPTY_DIFFS));
export const useSessionError = (sessionId: string | null) =>
  useSessionStore((state) => (sessionId ? state.sessionErrors[sessionId] ?? null : null));
export const useScreenPositions = (sessionId: string | null) =>
  useSessionStore((state) => (sessionId ? state.screenPositions[sessionId] ?? EMPTY_POSITIONS : EMPTY_POSITIONS));
export const useIsServerReady = () => useSessionStore((state) => state.isServerReady);
export const useError = () => useSessionStore((state) => state.error);
export const useDebugEvents = () => useSessionStore((state) => state.debugEvents);
export const useResetRealtimeState = () => useSessionStore((state) => state.resetRealtimeState);
export const useAllSessionStatuses = () => useSessionStore((state) => state.sessionStatus);
