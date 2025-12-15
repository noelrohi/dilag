import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import {
  type OpenCodeEvent,
  type EventMessagePartUpdated,
  type EventMessageUpdated,
  type EventSessionStatus,
  type EventSessionDiff,
  type FileDiff,
  type SessionStatus,
  type ToolState,
} from "./global-events";

// Re-export types
export type { ToolState, SessionStatus, FileDiff };

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
  parts: MessagePart[];
  time: { created: number; completed?: number };
  isStreaming?: boolean;
}

interface SessionState {
  // Core state
  sessions: SessionMeta[];
  currentSessionId: string | null;
  messages: Record<string, Message[]>; // Keyed by sessionId
  sessionStatus: Record<string, SessionStatus>; // Keyed by sessionId
  sessionDiffs: Record<string, FileDiff[]>; // Keyed by sessionId

  // UI state
  isServerReady: boolean;
  error: string | null;

  // Debug
  debugEvents: OpenCodeEvent[];

  // Actions
  setServerReady: (ready: boolean) => void;
  setError: (error: string | null) => void;
  setSessions: (sessions: SessionMeta[]) => void;
  addSession: (session: SessionMeta) => void;
  updateSession: (id: string, updates: Partial<SessionMeta>) => void;
  removeSession: (id: string) => void;
  setCurrentSessionId: (id: string | null) => void;
  setMessages: (sessionId: string, messages: Message[]) => void;
  addMessage: (sessionId: string, message: Message) => void;
  updateMessage: (sessionId: string, messageId: string, updates: Partial<Message>) => void;
  updateMessagePart: (sessionId: string, messageId: string, part: MessagePart, delta?: string) => void;
  setSessionStatus: (sessionId: string, status: SessionStatus) => void;
  setSessionDiffs: (sessionId: string, diffs: FileDiff[]) => void;
  addDebugEvent: (event: OpenCodeEvent) => void;
  clearDebugEvents: () => void;

  // Event handler
  handleEvent: (event: OpenCodeEvent) => void;
}

// Binary search for efficient sorted insertions
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

export const useSessionStore = create<SessionState>()(
  persist(
    immer((set, get) => ({
      // Initial state
      sessions: [],
      currentSessionId: null,
      messages: {},
      sessionStatus: {},
      sessionDiffs: {},
      isServerReady: false,
      error: null,
      debugEvents: [],

      // Actions
      setServerReady: (ready) =>
        set((state) => {
          state.isServerReady = ready;
        }),

      setError: (error) =>
        set((state) => {
          state.error = error;
        }),

      setSessions: (sessions) =>
        set((state) => {
          state.sessions = sessions;
        }),

      addSession: (session) =>
        set((state) => {
          state.sessions.push(session);
        }),

      updateSession: (id, updates) =>
        set((state) => {
          const index = state.sessions.findIndex((s) => s.id === id);
          if (index !== -1) {
            Object.assign(state.sessions[index], updates);
          }
        }),

      removeSession: (id) =>
        set((state) => {
          state.sessions = state.sessions.filter((s) => s.id !== id);
          if (state.currentSessionId === id) {
            state.currentSessionId = null;
          }
          delete state.messages[id];
          delete state.sessionStatus[id];
          delete state.sessionDiffs[id];
        }),

      setCurrentSessionId: (id) =>
        set((state) => {
          state.currentSessionId = id;
        }),

      setMessages: (sessionId, messages) =>
        set((state) => {
          state.messages[sessionId] = messages;
        }),

      addMessage: (sessionId, message) =>
        set((state) => {
          if (!state.messages[sessionId]) {
            state.messages[sessionId] = [];
          }
          const result = binarySearch(state.messages[sessionId], message.id, (m) => m.id);
          if (!result.found) {
            state.messages[sessionId].splice(result.index, 0, message);
          }
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

      updateMessagePart: (sessionId, messageId, part, delta) =>
        set((state) => {
          const messages = state.messages[sessionId];
          if (!messages) return;

          // Find message
          const msgResult = binarySearch(messages, messageId, (m) => m.id);
          if (!msgResult.found) return;

          const message = messages[msgResult.index];

          // Find or create part
          const partIndex = message.parts.findIndex((p) => p.id === part.id);

          if (partIndex >= 0) {
            // Update existing part
            if (part.type === "text" && delta) {
              // For text parts, append delta
              message.parts[partIndex].text = (message.parts[partIndex].text || "") + delta;
            } else {
              // For other parts, replace entirely
              message.parts[partIndex] = part;
            }
          } else {
            // Add new part
            if (part.type === "text" && delta) {
              message.parts.push({ ...part, text: delta });
            } else {
              message.parts.push(part);
            }
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

      addDebugEvent: (event) =>
        set((state) => {
          // Keep last 500 events
          if (state.debugEvents.length >= 500) {
            state.debugEvents = state.debugEvents.slice(-499);
          }
          state.debugEvents.push(event);
        }),

      clearDebugEvents: () =>
        set((state) => {
          state.debugEvents = [];
        }),

      // Central event handler
      handleEvent: (event) => {
        const { addDebugEvent, updateMessagePart, updateMessage, setSessionStatus, setSessionDiffs } = get();

        // Add to debug events
        addDebugEvent(event);

        switch (event.type) {
          case "message.part.updated": {
            const { part, delta } = (event as EventMessagePartUpdated).properties;
            if (part.sessionID && part.messageID) {
              updateMessagePart(part.sessionID, part.messageID, part, delta);
            }
            break;
          }

          case "message.updated": {
            const { info } = (event as EventMessageUpdated).properties;
            // If message is complete, update it
            if (info.time.completed) {
              updateMessage(info.sessionID, info.id, {
                isStreaming: false,
                time: info.time,
              });
            }
            break;
          }

          case "session.status": {
            const { sessionID, status } = (event as EventSessionStatus).properties;
            setSessionStatus(sessionID, status);
            break;
          }

          case "session.diff": {
            const { sessionID, diffs } = (event as EventSessionDiff).properties;
            setSessionDiffs(sessionID, diffs);
            break;
          }

          case "session.idle": {
            const e = event as { properties: { sessionID: string } };
            setSessionStatus(e.properties.sessionID, "idle");
            break;
          }

          case "session.error": {
            const e = event as { properties: { sessionID: string } };
            setSessionStatus(e.properties.sessionID, "error");
            break;
          }
        }
      },
    })),
    {
      name: "dilag-session-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist UI preferences, not messages (they come from server)
        currentSessionId: state.currentSessionId,
      }),
    }
  )
);

// Stable empty references to avoid infinite loops
const EMPTY_MESSAGES: Message[] = [];
const EMPTY_DIFFS: FileDiff[] = [];

// Selector hooks for performance
export const useSessions = () => useSessionStore((state) => state.sessions);
export const useCurrentSessionId = () => useSessionStore((state) => state.currentSessionId);
export const useCurrentSession = () =>
  useSessionStore((state) => state.sessions.find((s) => s.id === state.currentSessionId) ?? null);
export const useSessionMessages = (sessionId: string | null) =>
  useSessionStore((state) => (sessionId ? state.messages[sessionId] ?? EMPTY_MESSAGES : EMPTY_MESSAGES));
export const useSessionStatus = (sessionId: string | null) =>
  useSessionStore((state) => (sessionId ? state.sessionStatus[sessionId] ?? "unknown" : "unknown"));
export const useSessionDiffs = (sessionId: string | null) =>
  useSessionStore((state) => (sessionId ? state.sessionDiffs[sessionId] ?? EMPTY_DIFFS : EMPTY_DIFFS));
export const useIsServerReady = () => useSessionStore((state) => state.isServerReady);
export const useError = () => useSessionStore((state) => state.error);
export const useDebugEvents = () => useSessionStore((state) => state.debugEvents);
