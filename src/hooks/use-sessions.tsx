import { useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  useSessionStore,
  useSessions as useSessionsList,
  useCurrentSessionId,
  useCurrentSession,
  useSessionMessages,
  useSessionStatus,
  useIsServerReady,
  useError,
  useDebugEvents,
  type MessagePart,
} from "@/context/session-store";
import { useGlobalEvents, useSDK, type Event } from "@/context/global-events";
import { useModelStore } from "@/hooks/use-models";
import type { Part } from "@opencode-ai/sdk/v2/client";

// Session metadata stored locally via Tauri
interface SessionMeta {
  id: string;
  name: string;
  created_at: string;
  cwd: string;
}

// Tauri commands for local session management
async function createSessionDir(sessionId: string): Promise<string> {
  return invoke<string>("create_session_dir", { sessionId });
}

async function saveSessionMetadata(session: SessionMeta): Promise<void> {
  return invoke<void>("save_session_metadata", { session });
}

async function loadSessionsMetadata(): Promise<SessionMeta[]> {
  return invoke<SessionMeta[]>("load_sessions_metadata");
}

async function deleteSessionMetadata(sessionId: string): Promise<void> {
  return invoke<void>("delete_session_metadata", { sessionId });
}

// Convert SDK message format to our internal format
function convertPart(part: Part, messageID: string, sessionID: string): MessagePart {
  return {
    id: part.id,
    messageID,
    sessionID,
    type: part.type as MessagePart["type"],
    text: "text" in part ? part.text : undefined,
    tool: "tool" in part ? part.tool : undefined,
    state: "state" in part ? part.state : undefined,
  };
}

// Main hook for session management
export function useSessions() {
  const sessions = useSessionsList();
  const currentSessionId = useCurrentSessionId();
  const currentSession = useCurrentSession();
  const messages = useSessionMessages(currentSessionId);
  const sessionStatus = useSessionStatus(currentSessionId);
  const isServerReady = useIsServerReady();
  const error = useError();
  const debugEvents = useDebugEvents();

  const sdk = useSDK();

  const {
    addSession,
    updateSession,
    removeSession,
    setCurrentSessionId,
    setMessages,
    setSessionStatus,
    clearDebugEvents,
    handleEvent,
    setError,
  } = useSessionStore();

  const { subscribe, subscribeToSession, isServerReady: globalServerReady } = useGlobalEvents();

  // Use ref for handleEvent to avoid infinite loops
  const handleEventRef = useRef(handleEvent);
  handleEventRef.current = handleEvent;

  // Subscribe to global events (only once on mount)
  useEffect(() => {
    console.log("[useSessions] Setting up global event subscription");
    const handler = (event: Event) => {
      console.log("[useSessions] Received event:", event.type);
      handleEventRef.current(event);
    };
    const unsubscribe = subscribe(handler);
    console.log("[useSessions] Subscribed to global events");
    return () => {
      console.log("[useSessions] Unsubscribing from global events");
      unsubscribe();
    };
  }, [subscribe]);

  // Subscribe to current session events specifically
  useEffect(() => {
    if (!currentSessionId) return;
    const handler = (event: Event) => {
      handleEventRef.current(event);
    };
    return subscribeToSession(currentSessionId, handler);
  }, [currentSessionId, subscribeToSession]);

  // Track if initialized to prevent double init
  const initializedRef = useRef(false);

  // Initialize and load sessions once server is ready
  useEffect(() => {
    if (!globalServerReady || initializedRef.current) return;
    initializedRef.current = true;

    async function init() {
      try {
        useSessionStore.getState().setError(null);
        useSessionStore.getState().setServerReady(true);

        // Load persisted sessions
        const savedSessions = await loadSessionsMetadata();
        useSessionStore.getState().setSessions(savedSessions);

        // Select the most recent session if available
        if (savedSessions.length > 0) {
          const mostRecent = savedSessions[savedSessions.length - 1];
          useSessionStore.getState().setCurrentSessionId(mostRecent.id);

          // Load messages for this session using SDK
          try {
            const response = await sdk.session.messages({
              sessionID: mostRecent.id,
              directory: mostRecent.cwd,
            });

            if (response.data) {
              const msgs = response.data.map((msg) => ({
                id: msg.info.id,
                sessionID: msg.info.sessionID,
                role: msg.info.role as "user" | "assistant",
                time: msg.info.time,
              }));
              useSessionStore.getState().setMessages(mostRecent.id, msgs);

              // Set parts for each message
              const state = useSessionStore.getState();
              response.data.forEach((msg) => {
                msg.parts?.forEach((part) => {
                  state.updatePart(msg.info.id, convertPart(part, msg.info.id, msg.info.sessionID));
                });
              });
            }
          } catch {
            // Session might not exist in OpenCode yet
            useSessionStore.getState().setMessages(mostRecent.id, []);
          }
        }
      } catch (err) {
        useSessionStore.getState().setError(err instanceof Error ? err.message : "Failed to initialize");
        console.error("Failed to initialize:", err);
      }
    }

    init();
  }, [globalServerReady, sdk]);

  const createSession = useCallback(
    async (name?: string): Promise<string | null> => {
      try {
        setError(null);

        // Create session directory first
        const dirId = crypto.randomUUID();
        const cwd = await createSessionDir(dirId);

        // Create session in OpenCode with the directory for isolation
        const response = await sdk.session.create({ directory: cwd });
        if (!response.data) {
          throw new Error("Failed to create session");
        }
        const sessionId = response.data.id;

        // Create session metadata
        const sessionMeta: SessionMeta = {
          id: sessionId,
          name: name ?? `Session ${sessions.length + 1}`,
          created_at: new Date().toISOString(),
          cwd,
        };

        // Save to local storage
        await saveSessionMetadata(sessionMeta);

        // Update state
        addSession(sessionMeta);
        setCurrentSessionId(sessionId);
        setMessages(sessionId, []);

        return sessionId;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create session");
        console.error("Failed to create session:", err);
        return null;
      }
    },
    [sessions.length, setError, addSession, setCurrentSessionId, setMessages, sdk]
  );

  const selectSession = useCallback(
    async (sessionId: string) => {
      setCurrentSessionId(sessionId);

      // Get session's directory for isolation
      const session = sessions.find((s) => s.id === sessionId);
      const directory = session?.cwd;

      try {
        // Load messages for this session using SDK
        const response = await sdk.session.messages({
          sessionID: sessionId,
          directory,
        });

        if (response.data) {
          const msgs = response.data.map((msg) => ({
            id: msg.info.id,
            sessionID: msg.info.sessionID,
            role: msg.info.role as "user" | "assistant",
            time: msg.info.time,
          }));
          setMessages(sessionId, msgs);

          // Set parts for each message
          const state = useSessionStore.getState();
          response.data.forEach((msg) => {
            msg.parts?.forEach((part) => {
              state.updatePart(msg.info.id, convertPart(part, msg.info.id, msg.info.sessionID));
            });
          });
        }
      } catch {
        // Session might not exist in OpenCode, start fresh
        setMessages(sessionId, []);
      }
    },
    [sessions, setCurrentSessionId, setMessages, sdk]
  );

  const deleteSession = useCallback(
    async (sessionId: string) => {
      try {
        // Get session's directory
        const session = sessions.find((s) => s.id === sessionId);

        // Delete from OpenCode
        try {
          await sdk.session.delete({
            sessionID: sessionId,
            directory: session?.cwd,
          });
        } catch {
          // Might not exist in OpenCode, continue anyway
        }

        // Delete local metadata and directory
        await deleteSessionMetadata(sessionId);

        // Update state
        removeSession(sessionId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete session");
        console.error("Failed to delete session:", err);
      }
    },
    [sessions, removeSession, setError, sdk]
  );

  const sendMessage = useCallback(
    async (content: string) => {
      if (!currentSessionId || !currentSession) return;

      // Get selected model from store
      const { selectedModel } = useModelStore.getState();

      // Check if this is the first message (for title update)
      const isFirstMessage = messages.length === 0;
      const directory = currentSession.cwd;

      try {
        setError(null);

        // Set session status to running
        setSessionStatus(currentSessionId, "running");

        // Send message using SDK - fire and forget
        // User message will be added via server events (message.updated)
        sdk.session.prompt({
          sessionID: currentSessionId,
          directory,
          model: selectedModel ?? {
            providerID: "anthropic",
            modelID: "claude-sonnet-4-20250514",
          },
          parts: [{ type: "text", text: content }],
        }).catch((err) => {
          setError(err instanceof Error ? err.message : "Failed to send message");
          setSessionStatus(currentSessionId, "error");
          console.error("Failed to send message:", err);
        });

        // Update title from OpenCode after first response
        if (isFirstMessage) {
          // Delay slightly to let the session process
          setTimeout(() => {
            sdk.session.get({
              sessionID: currentSessionId,
              directory,
            }).then(async (response) => {
              if (response.data?.title) {
                const updatedSession = { ...currentSession, name: response.data.title };
                await saveSessionMetadata(updatedSession);
                updateSession(currentSessionId, { name: response.data.title });
              }
            });
          }, 2000);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to send message");
        setSessionStatus(currentSessionId, "error");
        console.error("Failed to send message:", err);
      }
    },
    [currentSessionId, currentSession, messages.length, setError, setSessionStatus, updateSession, sdk]
  );

  return {
    sessions,
    currentSessionId,
    messages,
    isLoading: sessionStatus === "running",
    isServerReady,
    error,
    debugEvents,
    sessionStatus,
    createSession,
    selectSession,
    deleteSession,
    sendMessage,
    clearDebugEvents,
  };
}
