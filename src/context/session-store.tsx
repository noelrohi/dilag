import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type {
  Event,
  EventMessagePartUpdated,
  EventMessageUpdated,
  EventSessionStatus,
  EventSessionDiff,
  FileDiff,
  ToolState,
} from "@opencode-ai/sdk/v2/client";

// Re-export SDK types
export type { ToolState, FileDiff };

// Our internal session status type (simpler than SDK's object type)
export type SessionStatus = "idle" | "running" | "error" | "unknown";

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

interface SessionState {
  // Core state
  sessions: SessionMeta[];
  currentSessionId: string | null;
  messages: Record<string, Message[]>; // Keyed by sessionId
  parts: Record<string, MessagePart[]>; // Keyed by messageId (like OpenCode!)
  sessionStatus: Record<string, SessionStatus>; // Keyed by sessionId
  sessionDiffs: Record<string, FileDiff[]>; // Keyed by sessionId

  // UI state
  isServerReady: boolean;
  error: string | null;

  // Debug
  debugEvents: Event[];

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
  updatePart: (messageId: string, part: MessagePart) => void;
  setSessionStatus: (sessionId: string, status: SessionStatus) => void;
  setSessionDiffs: (sessionId: string, diffs: FileDiff[]) => void;
  addDebugEvent: (event: Event) => void;
  clearDebugEvents: () => void;

  // Event handler
  handleEvent: (event: Event) => void;
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
      sessions: [],
      currentSessionId: null,
      messages: {},
      parts: {}, // Parts stored separately by messageId
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
          // Check if already exists by ID
          const exists = state.messages[sessionId].some((m) => m.id === message.id);
          if (exists) return;

          // Insert by timestamp order
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

      // Store parts separately by messageId (like OpenCode)
      updatePart: (messageId, part) =>
        set((state) => {
          const parts = state.parts[messageId];
          if (!parts) {
            // Create new parts array for this message
            state.parts[messageId] = [part];
            return;
          }

          // Find existing part by ID using binary search
          const result = binarySearch(parts, part.id, (p) => p.id);
          if (result.found) {
            // Update existing part - replace entirely (like OpenCode's reconcile)
            parts[result.index] = part;
          } else {
            // Insert new part in sorted order
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

      // Central event handler - matches OpenCode's pattern exactly
      handleEvent: (event) => {
        const { addDebugEvent, updatePart, addMessage, updateMessage, setSessionStatus, setSessionDiffs } = get();

        // Add to debug events
        addDebugEvent(event);

        switch (event.type) {
          case "message.part.updated": {
            // Match OpenCode exactly - only need messageId for parts!
            const sdkPart = (event as EventMessagePartUpdated).properties.part;
            if (sdkPart.messageID) {
              // Convert SDK Part to our internal MessagePart type
              const part: MessagePart = {
                id: sdkPart.id,
                messageID: sdkPart.messageID,
                sessionID: sdkPart.sessionID,
                type: sdkPart.type as MessagePart["type"],
                text: "text" in sdkPart ? sdkPart.text : undefined,
                tool: "tool" in sdkPart ? sdkPart.tool : undefined,
                state: "state" in sdkPart ? sdkPart.state : undefined,
              };
              console.log("[EVENT] message.part.updated", {
                partId: part.id,
                messageId: part.messageID,
                type: part.type,
                hasText: !!part.text
              });
              updatePart(sdkPart.messageID, part);

              // Debug: log current parts state
              const state = get();
              console.log("[STATE] parts for message:", state.parts[sdkPart.messageID]?.length ?? 0);
            }
            break;
          }

          case "message.updated": {
            const { info } = (event as EventMessageUpdated).properties;
            const state = get();
            const messages = state.messages[info.sessionID];
            const exists = messages?.some((m) => m.id === info.id);
            const isCompleted = "completed" in info.time && !!info.time.completed;

            console.log("[EVENT] message.updated", {
              messageId: info.id,
              sessionId: info.sessionID,
              role: info.role,
              completed: isCompleted,
              exists,
              messagesCount: messages?.length ?? 0
            });

            if (!exists) {
              // Message doesn't exist yet - create it (like OpenCode)
              const newMessage: Message = {
                id: info.id,
                sessionID: info.sessionID,
                role: info.role,
                time: info.time as { created: number; completed?: number },
                isStreaming: !isCompleted,
              };
              console.log("[ACTION] Adding new message:", newMessage);
              addMessage(info.sessionID, newMessage);

              // Debug: verify message was added
              const newState = get();
              console.log("[STATE] messages after add:", newState.messages[info.sessionID]?.length);
            } else if (isCompleted) {
              // Message exists and is complete - update it
              console.log("[ACTION] Marking message complete");
              updateMessage(info.sessionID, info.id, {
                isStreaming: false,
                time: info.time as { created: number; completed?: number },
              });
            }
            break;
          }

          case "session.status": {
            const { sessionID, status } = (event as EventSessionStatus).properties;
            // SDK status is { type: "idle" | "running" | ... }
            const statusType = status.type as SessionStatus;
            setSessionStatus(sessionID, statusType);
            break;
          }

          case "session.diff": {
            const props = (event as EventSessionDiff).properties;
            setSessionDiffs(props.sessionID, props.diff);
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
const EMPTY_PARTS: MessagePart[] = [];
const EMPTY_DIFFS: FileDiff[] = [];

// Selector hooks for performance
export const useSessions = () => useSessionStore((state) => state.sessions);
export const useCurrentSessionId = () => useSessionStore((state) => state.currentSessionId);
export const useCurrentSession = () =>
  useSessionStore((state) => state.sessions.find((s) => s.id === state.currentSessionId) ?? null);
export const useSessionMessages = (sessionId: string | null) =>
  useSessionStore((state) => (sessionId ? state.messages[sessionId] ?? EMPTY_MESSAGES : EMPTY_MESSAGES));
export const useMessageParts = (messageId: string | null) =>
  useSessionStore((state) => (messageId ? state.parts[messageId] ?? EMPTY_PARTS : EMPTY_PARTS));
export const useSessionStatus = (sessionId: string | null) =>
  useSessionStore((state) => (sessionId ? state.sessionStatus[sessionId] ?? "unknown" : "unknown"));
export const useSessionDiffs = (sessionId: string | null) =>
  useSessionStore((state) => (sessionId ? state.sessionDiffs[sessionId] ?? EMPTY_DIFFS : EMPTY_DIFFS));
export const useIsServerReady = () => useSessionStore((state) => state.isServerReady);
export const useError = () => useSessionStore((state) => state.error);
export const useDebugEvents = () => useSessionStore((state) => state.debugEvents);
