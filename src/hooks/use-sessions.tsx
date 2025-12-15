import { useEffect, useCallback, useRef } from "react";
import {
  getBaseUrl,
  startServer,
  createSession as createOpenCodeSession,
  deleteSession as deleteOpenCodeSession,
  getSessionMessages,
  getSession,
  sendMessageToSession,
  createSessionDir,
  saveSessionMetadata,
  loadSessionsMetadata,
  deleteSessionMetadata,
  type SessionMeta,
  type OpenCodeMessage,
} from "@/lib/opencode";
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
  type Message,
} from "@/context/session-store";
import { useGlobalEvents } from "@/context/global-events";

// Convert OpenCode message to our Message format
function convertMessage(msg: OpenCodeMessage): Message {
  return {
    id: msg.info.id,
    sessionID: msg.info.sessionID,
    role: msg.info.role,
    parts: msg.parts,
    time: msg.info.time,
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

  const {
    addSession,
    updateSession,
    removeSession,
    setCurrentSessionId,
    setMessages,
    addMessage,
    setSessionStatus,
    clearDebugEvents,
    handleEvent,
    setError,
  } = useSessionStore();

  const { subscribe, subscribeToSession } = useGlobalEvents();

  // Use ref for handleEvent to avoid infinite loops
  const handleEventRef = useRef(handleEvent);
  handleEventRef.current = handleEvent;

  // Subscribe to global events (only once on mount)
  useEffect(() => {
    const handler = (event: Parameters<typeof handleEvent>[0]) => {
      handleEventRef.current(event);
    };
    return subscribe(handler);
  }, [subscribe]);

  // Subscribe to current session events specifically
  useEffect(() => {
    if (!currentSessionId) return;
    const handler = (event: Parameters<typeof handleEvent>[0]) => {
      handleEventRef.current(event);
    };
    return subscribeToSession(currentSessionId, handler);
  }, [currentSessionId, subscribeToSession]);

  // Track if initialized to prevent double init
  const initializedRef = useRef(false);

  // Initialize server and load sessions on mount (only once)
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    async function init() {
      try {
        useSessionStore.getState().setError(null);

        // Start the OpenCode server
        await startServer();

        // Initialize the base URL
        await getBaseUrl();

        useSessionStore.getState().setServerReady(true);

        // Load persisted sessions
        const savedSessions = await loadSessionsMetadata();
        useSessionStore.getState().setSessions(savedSessions);

        // Select the most recent session if available
        if (savedSessions.length > 0) {
          const mostRecent = savedSessions[savedSessions.length - 1];
          useSessionStore.getState().setCurrentSessionId(mostRecent.id);

          // Load messages for this session
          try {
            const openCodeMessages = await getSessionMessages(mostRecent.id, mostRecent.cwd);
            useSessionStore.getState().setMessages(mostRecent.id, openCodeMessages.map(convertMessage));
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
  }, []);

  const createSession = useCallback(
    async (name?: string): Promise<string | null> => {
      try {
        setError(null);

        // Create session directory first
        const dirId = crypto.randomUUID();
        const cwd = await createSessionDir(dirId);

        // Create session in OpenCode with the directory for isolation
        const openCodeSession = await createOpenCodeSession(cwd);
        const sessionId = openCodeSession.id;

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
    [sessions.length, setError, addSession, setCurrentSessionId, setMessages]
  );

  const selectSession = useCallback(
    async (sessionId: string) => {
      setCurrentSessionId(sessionId);

      // Get session's directory for isolation
      const session = sessions.find((s) => s.id === sessionId);
      const directory = session?.cwd;

      try {
        // Load messages for this session
        const openCodeMessages = await getSessionMessages(sessionId, directory);
        setMessages(sessionId, openCodeMessages.map(convertMessage));
      } catch {
        // Session might not exist in OpenCode, start fresh
        setMessages(sessionId, []);
      }
    },
    [sessions, setCurrentSessionId, setMessages]
  );

  const deleteSession = useCallback(
    async (sessionId: string) => {
      try {
        // Delete from OpenCode
        try {
          await deleteOpenCodeSession(sessionId);
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
    [removeSession, setError]
  );

  const sendMessage = useCallback(
    async (content: string) => {
      if (!currentSessionId || !currentSession) return;

      // Check if this is the first message (for title update)
      const isFirstMessage = messages.length === 0;
      const directory = currentSession.cwd;

      try {
        setError(null);

        // Add user message optimistically
        const userMessage: Message = {
          id: crypto.randomUUID(),
          sessionID: currentSessionId,
          role: "user",
          parts: [{ id: crypto.randomUUID(), type: "text", text: content }],
          time: { created: Date.now() },
        };
        addMessage(currentSessionId, userMessage);

        // Add placeholder assistant message for streaming
        const assistantMessageId = crypto.randomUUID();
        const assistantMessage: Message = {
          id: assistantMessageId,
          sessionID: currentSessionId,
          role: "assistant",
          parts: [],
          time: { created: Date.now() },
          isStreaming: true,
        };
        addMessage(currentSessionId, assistantMessage);

        // Set session status to running
        setSessionStatus(currentSessionId, "running");

        // Send message - events will come via global event stream
        await sendMessageToSession(currentSessionId, content, undefined, directory);

        // Update title from OpenCode after first response
        if (isFirstMessage) {
          getSession(currentSessionId, directory).then(async (openCodeSession) => {
            const updatedSession = { ...currentSession, name: openCodeSession.title };
            await saveSessionMetadata(updatedSession);
            updateSession(currentSessionId, { name: openCodeSession.title });
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to send message");
        setSessionStatus(currentSessionId, "error");
        console.error("Failed to send message:", err);
      }
    },
    [currentSessionId, currentSession, messages.length, setError, addMessage, setSessionStatus, updateSession]
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
