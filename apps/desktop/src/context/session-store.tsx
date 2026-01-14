import { useMemo } from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type { Event, FileDiff, ToolState } from "@opencode-ai/sdk/v2/client";
import {
  isEventMessagePartUpdated,
  isEventMessageUpdated,
  isEventMessageRemoved,
  isEventSessionStatus,
  isEventSessionDiff,
  isEventSessionIdle,
  isEventSessionError,
  isEventSessionUpdated,
  isEventServerHeartbeat,
  isEventFileWatcherUpdated,
  isEventProjectUpdated,
  isEventVcsBranchUpdated,
  isEventPermissionAsked,
  isEventPermissionReplied,
  isEventQuestionAsked,
  isEventQuestionReplied,
  isEventQuestionRejected,
  type PermissionRequest,
  type QuestionRequest,
  type EventQuestionAsked,
  type EventQuestionReplied,
  type EventQuestionRejected,
} from "@/lib/event-guards";

// Re-export types for consumers
export type { PermissionRequest, QuestionRequest, QuestionInfo, QuestionOption } from "@/lib/event-guards";

// Re-export SDK types
export type { ToolState, FileDiff };

// Our internal session status type (simpler than SDK's object type)
export type SessionStatus = "idle" | "running" | "busy" | "error" | "unknown";

// Types
export type Platform = "web" | "mobile";

export interface SessionMeta {
  id: string;
  name: string;
  created_at: string;
  cwd: string;
  parentID?: string; // Reference to parent session if forked
  platform?: Platform; // "web" (default) or "mobile"
  favorite?: boolean;
}

// Revert state for a session
export interface SessionRevertState {
  messageID: string;
  partID?: string;
  snapshot?: string;
  diff?: string;
}

// Server health state
export interface ServerHealth {
  lastHeartbeat: number;
  isHealthy: boolean;
}

// VCS branch state
export interface VcsBranchState {
  branch: string | null;
  lastUpdated: number;
}

// File watcher event
export interface FileWatcherEvent {
  file: string;
  event: "add" | "change" | "unlink";
  timestamp: number;
}

// Session file write tracking state
export interface SessionFileWriteState {
  hasFiles: boolean;
  firstFileTimestamp: number | null;
  fileCount: number;
}

// Files/directories to ignore when tracking writes
const IGNORE_PATTERNS = ["node_modules", ".git", "bun.lockb", "package.json", ".DS_Store"];

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
  sessionRevert: Record<string, SessionRevertState | null>; // Keyed by sessionId - tracks revert state

  // New event state
  serverHealth: ServerHealth;
  pendingPermissions: Record<string, PermissionRequest[]>; // Keyed by sessionId
  pendingQuestions: Record<string, QuestionRequest[]>; // Keyed by sessionId
  vcsBranch: VcsBranchState;
  recentFileChanges: FileWatcherEvent[];
  sessionFileWrites: Record<string, SessionFileWriteState>; // Keyed by session cwd

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
  setSessionRevert: (sessionId: string, revert: SessionRevertState | null) => void;
  removeMessage: (sessionId: string, messageId: string) => void;
  removeMessagesAfter: (sessionId: string, messageId: string) => void;
  clearSessionData: (sessionId: string) => void;
  abortRunningTools: (sessionId: string) => void;

  // Actions - New event state
  setServerHealth: (health: ServerHealth) => void;
  addPendingPermission: (sessionId: string, request: PermissionRequest) => void;
  removePendingPermission: (sessionId: string, requestId: string) => void;
  clearPendingPermissions: (sessionId: string) => void;
  syncPendingPermissions: (permissions: PermissionRequest[]) => void;
  addPendingQuestion: (sessionId: string, request: QuestionRequest) => void;
  removePendingQuestion: (sessionId: string, requestId: string) => void;
  clearPendingQuestions: (sessionId: string) => void;
  syncPendingQuestions: (questions: QuestionRequest[]) => void;
  setVcsBranch: (branch: string | null) => void;
  addFileChange: (event: FileWatcherEvent) => void;
  trackFileWrite: (sessionCwd: string, filePath: string) => void;

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
      sessionRevert: {},
      serverHealth: { lastHeartbeat: 0, isHealthy: false },
      pendingPermissions: {},
      pendingQuestions: {},
      vcsBranch: { branch: null, lastUpdated: 0 },
      recentFileChanges: [],
      sessionFileWrites: {},
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

      setSessionRevert: (sessionId, revert) =>
        set((state) => {
          state.sessionRevert[sessionId] = revert;
        }),

      removeMessage: (sessionId, messageId) =>
        set((state) => {
          const messages = state.messages[sessionId];
          if (messages) {
            state.messages[sessionId] = messages.filter((m) => m.id !== messageId);
          }
          // Also remove parts for this message
          delete state.parts[messageId];
        }),

      removeMessagesAfter: (sessionId, messageId) =>
        set((state) => {
          const messages = state.messages[sessionId];
          if (!messages) return;

          // Find the index of the target message
          const targetIndex = messages.findIndex((m) => m.id === messageId);
          if (targetIndex === -1) return;

          // Remove all messages after the target (keep target and before)
          const removedMessages = messages.slice(targetIndex + 1);
          state.messages[sessionId] = messages.slice(0, targetIndex + 1);

          // Remove parts for all removed messages
          for (const msg of removedMessages) {
            delete state.parts[msg.id];
          }
        }),

      clearSessionData: (sessionId) =>
        set((state) => {
          delete state.messages[sessionId];
          delete state.sessionStatus[sessionId];
          delete state.sessionDiffs[sessionId];
          delete state.sessionErrors[sessionId];
          delete state.sessionRevert[sessionId];
          delete state.pendingPermissions[sessionId];
          delete state.pendingQuestions[sessionId];
          if (state.currentSessionId === sessionId) {
            state.currentSessionId = null;
          }
        }),

      // Mark all running tools as aborted for a session (used when stop fails to clean up backend state)
      abortRunningTools: (sessionId) =>
        set((state) => {
          const messages = state.messages[sessionId];
          if (!messages) return;

          for (const message of messages) {
            const parts = state.parts[message.id];
            if (!parts) continue;

            for (const part of parts) {
              if (part.type === "tool" && part.state?.status === "running") {
                const now = Date.now();
                const start = part.state.time?.start ?? now;
                part.state = {
                  ...part.state,
                  status: "error",
                  error: "Aborted",
                  time: { start, end: now },
                };
              }
            }
          }
        }),

      // New event state actions
      setServerHealth: (health) =>
        set((state) => {
          state.serverHealth = health;
        }),

      addPendingPermission: (sessionId, request) =>
        set((state) => {
          if (!state.pendingPermissions[sessionId]) {
            state.pendingPermissions[sessionId] = [];
          }
          // Avoid duplicates
          const exists = state.pendingPermissions[sessionId].some(
            (p) => p.id === request.id
          );
          if (!exists) {
            state.pendingPermissions[sessionId].push(request);
          }
        }),

      removePendingPermission: (sessionId, requestId) =>
        set((state) => {
          if (state.pendingPermissions[sessionId]) {
            state.pendingPermissions[sessionId] = state.pendingPermissions[
              sessionId
            ].filter((p) => p.id !== requestId);
          }
        }),

      clearPendingPermissions: (sessionId) =>
        set((state) => {
          delete state.pendingPermissions[sessionId];
        }),

      syncPendingPermissions: (permissions) =>
        set((state) => {
          // Clear all existing permissions and rebuild from server state
          state.pendingPermissions = {};
          for (const permission of permissions) {
            if (!state.pendingPermissions[permission.sessionID]) {
              state.pendingPermissions[permission.sessionID] = [];
            }
            state.pendingPermissions[permission.sessionID].push(permission);
          }
        }),

      addPendingQuestion: (sessionId, request) =>
        set((state) => {
          if (!state.pendingQuestions[sessionId]) {
            state.pendingQuestions[sessionId] = [];
          }
          // Avoid duplicates
          const exists = state.pendingQuestions[sessionId].some(
            (q) => q.id === request.id
          );
          if (!exists) {
            state.pendingQuestions[sessionId].push(request);
          }
        }),

      removePendingQuestion: (sessionId, requestId) =>
        set((state) => {
          if (state.pendingQuestions[sessionId]) {
            state.pendingQuestions[sessionId] = state.pendingQuestions[
              sessionId
            ].filter((q) => q.id !== requestId);
          }
        }),

      clearPendingQuestions: (sessionId) =>
        set((state) => {
          delete state.pendingQuestions[sessionId];
        }),

      syncPendingQuestions: (questions) =>
        set((state) => {
          // Clear all existing questions and rebuild from server state
          state.pendingQuestions = {};
          for (const question of questions) {
            if (!state.pendingQuestions[question.sessionID]) {
              state.pendingQuestions[question.sessionID] = [];
            }
            state.pendingQuestions[question.sessionID].push(question);
          }
        }),

      setVcsBranch: (branch) =>
        set((state) => {
          state.vcsBranch = { branch, lastUpdated: Date.now() };
        }),

      addFileChange: (event) =>
        set((state) => {
          // Keep only last 50 file changes
          if (state.recentFileChanges.length >= 50) {
            state.recentFileChanges = state.recentFileChanges.slice(-49);
          }
          state.recentFileChanges.push(event);
        }),

      trackFileWrite: (sessionCwd, filePath) =>
        set((state) => {
          // Skip ignored files/directories
          if (IGNORE_PATTERNS.some((p) => filePath.includes(p))) return;

          const existing = state.sessionFileWrites[sessionCwd];
          if (existing) {
            // Already tracking, increment count
            existing.fileCount += 1;
          } else {
            // First file for this session
            state.sessionFileWrites[sessionCwd] = {
              hasFiles: true,
              firstFileTimestamp: Date.now(),
              fileCount: 1,
            };
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
          state.sessionRevert = {};
          state.pendingPermissions = {};
          state.pendingQuestions = {};
          state.serverHealth = { lastHeartbeat: 0, isHealthy: false };
          state.vcsBranch = { branch: null, lastUpdated: 0 };
          state.recentFileChanges = [];
          state.sessionFileWrites = {};
          state.debugEvents = [];
          state.error = null;
          // Note: currentSessionId and screenPositions are preserved
        }),

      // Central event handler for SSE - handles real-time updates
      handleEvent: (event) => {
        const {
          addDebugEvent, updatePart, addMessage, updateMessage, setSessionStatus,
          setSessionDiffs, setSessionError, setSessionRevert, removeMessage,
          setServerHealth, addPendingPermission, removePendingPermission,
          addPendingQuestion, removePendingQuestion,
          setVcsBranch, addFileChange
        } = get();

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
              mime: "mime" in sdkPart ? sdkPart.mime : undefined,
              url: "url" in sdkPart ? sdkPart.url : undefined,
              filename: "filename" in sdkPart ? sdkPart.filename : undefined,
              provider:
                "provider" in sdkPart && typeof (sdkPart as { provider?: unknown }).provider === "string"
                  ? (sdkPart as { provider: string }).provider
                  : undefined,
              model:
                "model" in sdkPart && typeof (sdkPart as { model?: unknown }).model === "string"
                  ? (sdkPart as { model: string }).model
                  : undefined,
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

        if (isEventMessageRemoved(event)) {
          const { sessionID, messageID } = event.properties;
          removeMessage(sessionID, messageID);
          return;
        }

        if (isEventSessionUpdated(event)) {
          const { info } = event.properties;
          // Update revert state from session info
          setSessionRevert(info.id, info.revert ?? null);
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

        // Handle server heartbeat
        if (isEventServerHeartbeat(event)) {
          setServerHealth({ lastHeartbeat: Date.now(), isHealthy: true });
          return;
        }

        // Handle file watcher updates
        if (isEventFileWatcherUpdated(event)) {
          const { file, event: fileEvent } = event.properties;
          addFileChange({ file, event: fileEvent, timestamp: Date.now() });
          return;
        }

        // Handle project updates
        if (isEventProjectUpdated(event)) {
          // For now just acknowledge - could be used to refresh project info
          return;
        }

        // Handle VCS branch updates
        if (isEventVcsBranchUpdated(event)) {
          setVcsBranch(event.properties.branch ?? null);
          return;
        }

        // Handle permission requests
        if (isEventPermissionAsked(event)) {
          const request = event.properties;
          addPendingPermission(request.sessionID, request);
          return;
        }

        // Handle permission replies (confirmation that permission was handled)
        if (isEventPermissionReplied(event)) {
          const { sessionID, requestID } = event.properties;
          removePendingPermission(sessionID, requestID);
          return;
        }

        // Handle question requests
        if (isEventQuestionAsked(event)) {
          const questionEvent = event as unknown as EventQuestionAsked;
          const request = questionEvent.properties;
          addPendingQuestion(request.sessionID, request);
          return;
        }

        // Handle question replies (question was answered)
        if (isEventQuestionReplied(event)) {
          const questionEvent = event as unknown as EventQuestionReplied;
          const { sessionID, requestID } = questionEvent.properties;
          removePendingQuestion(sessionID, requestID);
          return;
        }

        // Handle question rejections (question was dismissed)
        if (isEventQuestionRejected(event)) {
          const questionEvent = event as unknown as EventQuestionRejected;
          const { sessionID, requestID } = questionEvent.properties;
          removePendingQuestion(sessionID, requestID);
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
        sessionFileWrites: state.sessionFileWrites,
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
export const useSessionRevert = (sessionId: string | null) =>
  useSessionStore((state) => (sessionId ? state.sessionRevert[sessionId] ?? null : null));

// New event state selectors
const EMPTY_PERMISSIONS: PermissionRequest[] = [];
const EMPTY_QUESTIONS: QuestionRequest[] = [];

export const useServerHealth = () =>
  useSessionStore((state) => state.serverHealth);

export const usePendingPermissions = (sessionId: string | null) =>
  useSessionStore((state) =>
    sessionId
      ? state.pendingPermissions[sessionId] ?? EMPTY_PERMISSIONS
      : EMPTY_PERMISSIONS
  );

export const usePendingQuestions = (sessionId: string | null) =>
  useSessionStore((state) =>
    sessionId
      ? state.pendingQuestions[sessionId] ?? EMPTY_QUESTIONS
      : EMPTY_QUESTIONS
  );

export const useVcsBranch = () =>
  useSessionStore((state) => state.vcsBranch.branch);

export const useRecentFileChanges = () =>
  useSessionStore((state) => state.recentFileChanges);

export const useSessionHasFiles = (sessionCwd: string | null) =>
  useSessionStore((state) =>
    sessionCwd ? state.sessionFileWrites[sessionCwd]?.hasFiles ?? false : false
  );

export const useTrackFileWrite = () =>
  useSessionStore((state) => state.trackFileWrite);

// Types for stuck tool detection
export interface RunningQuestionTool {
  messageId: string;
  partId: string;
  callId: string;
  startTime: number;
}

export interface RunningPermissionTool {
  messageId: string;
  partId: string;
  callId: string;
  tool: string;
  startTime: number;
}

// Tools that typically require permission
const PERMISSION_TOOLS = ["bash", "write", "edit", "read", "glob", "grep", "webfetch", "websearch", "task"];

// Hook to check if session has any running tools (for fallback isLoading detection)
export function useHasRunningTools(sessionId: string | null): boolean {
  const messages = useSessionStore((state) =>
    sessionId ? state.messages[sessionId] ?? EMPTY_MESSAGES : EMPTY_MESSAGES
  );
  const parts = useSessionStore((state) => state.parts);

  return useMemo(() => {
    if (!sessionId) return false;

    for (const message of messages) {
      const messageParts = parts[message.id] ?? [];
      for (const part of messageParts) {
        if (
          part.type === "tool" &&
          part.state?.status === "running"
        ) {
          return true;
        }
      }
    }

    return false;
  }, [sessionId, messages, parts]);
}

// Hook to find running question tools for a session
export function useRunningQuestionTools(sessionId: string | null): RunningQuestionTool[] {
  const messages = useSessionStore((state) =>
    sessionId ? state.messages[sessionId] ?? EMPTY_MESSAGES : EMPTY_MESSAGES
  );
  const parts = useSessionStore((state) => state.parts);

  return useMemo(() => {
    if (!sessionId) return [];

    const runningTools: RunningQuestionTool[] = [];

    for (const message of messages) {
      const messageParts = parts[message.id] ?? [];
      for (const part of messageParts) {
        if (
          part.type === "tool" &&
          part.tool === "question" &&
          part.state?.status === "running"
        ) {
          const state = part.state as { status: "running"; time?: { start?: number } };
          runningTools.push({
            messageId: message.id,
            partId: part.id,
            callId: part.state && "input" in part.state ? (part.state as Record<string, unknown>).callID as string ?? part.id : part.id,
            startTime: state.time?.start ?? Date.now(),
          });
        }
      }
    }

    return runningTools;
  }, [sessionId, messages, parts]);
}

// Hook to find running permission tools for a session (bash, write, edit, etc.)
export function useRunningPermissionTools(sessionId: string | null): RunningPermissionTool[] {
  const messages = useSessionStore((state) =>
    sessionId ? state.messages[sessionId] ?? EMPTY_MESSAGES : EMPTY_MESSAGES
  );
  const parts = useSessionStore((state) => state.parts);

  return useMemo(() => {
    if (!sessionId) return [];

    const runningTools: RunningPermissionTool[] = [];

    for (const message of messages) {
      const messageParts = parts[message.id] ?? [];
      for (const part of messageParts) {
        if (
          part.type === "tool" &&
          part.tool &&
          PERMISSION_TOOLS.includes(part.tool) &&
          part.state?.status === "running"
        ) {
          const state = part.state as { status: "running"; time?: { start?: number } };
          runningTools.push({
            messageId: message.id,
            partId: part.id,
            callId: part.state && "input" in part.state ? (part.state as Record<string, unknown>).callID as string ?? part.id : part.id,
            tool: part.tool,
            startTime: state.time?.start ?? Date.now(),
          });
        }
      }
    }

    return runningTools;
  }, [sessionId, messages, parts]);
}

// Hook that returns messages filtered by revert state
// If session is reverted, only shows messages BEFORE the revert point (matching OpenCode's pattern)
// The revert messageID is the FIRST message to be hidden
export function useFilteredSessionMessages(sessionId: string | null) {
  const messages = useSessionStore((state) =>
    sessionId ? state.messages[sessionId] ?? EMPTY_MESSAGES : EMPTY_MESSAGES
  );
  const revertMessageID = useSessionStore((state) =>
    sessionId ? state.sessionRevert[sessionId]?.messageID ?? null : null
  );

  // Memoize the filtered result to avoid creating new arrays on every render
  return useMemo(() => {
    if (!revertMessageID) return messages;
    // Filter to show only messages BEFORE the revert point (id < revertID)
    return messages.filter((m) => m.id < revertMessageID);
  }, [messages, revertMessageID]);
}
