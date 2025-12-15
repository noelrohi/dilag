import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import {
  getBaseUrl,
  startServer,
  createSession as createOpenCodeSession,
  deleteSession as deleteOpenCodeSession,
  getSessionMessages,
  getSession,
  sendMessageStreaming,
  createSessionDir,
  saveSessionMetadata,
  loadSessionsMetadata,
  deleteSessionMetadata,
  extractTextFromParts,
  type SessionMeta,
  type OpenCodeMessage,
} from "@/lib/opencode";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  isStreaming?: boolean;
}

interface SessionsContextValue {
  sessions: SessionMeta[];
  currentSessionId: string | null;
  messages: Message[];
  isLoading: boolean;
  isServerReady: boolean;
  error: string | null;
  createSession: (name?: string) => Promise<string | null>;
  selectSession: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
}

const SessionsContext = createContext<SessionsContextValue | null>(null);

// Convert OpenCode message to our Message format
function convertMessage(msg: OpenCodeMessage): Message {
  return {
    id: msg.info.id,
    role: msg.info.role,
    content: extractTextFromParts(msg.parts),
    createdAt: new Date(msg.info.time.created).toISOString(),
  };
}

export function SessionsProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isServerReady, setIsServerReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize server and load sessions on mount
  useEffect(() => {
    async function init() {
      try {
        setIsLoading(true);
        setError(null);

        // Start the OpenCode server
        await startServer();

        // Initialize the base URL
        await getBaseUrl();

        setIsServerReady(true);

        // Load persisted sessions
        const savedSessions = await loadSessionsMetadata();
        setSessions(savedSessions);

        // Select the most recent session if available
        if (savedSessions.length > 0) {
          const mostRecent = savedSessions[savedSessions.length - 1];
          setCurrentSessionId(mostRecent.id);

          // Load messages for this session (pass directory for isolation)
          try {
            const openCodeMessages = await getSessionMessages(mostRecent.id, mostRecent.cwd);
            setMessages(openCodeMessages.map(convertMessage));
          } catch {
            // Session might not exist in OpenCode yet
            setMessages([]);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to initialize");
        console.error("Failed to initialize:", err);
      } finally {
        setIsLoading(false);
      }
    }

    init();
  }, []);

  const createSession = useCallback(
    async (name?: string): Promise<string | null> => {
      try {
        setIsLoading(true);
        setError(null);

        // Create session directory first (use UUID for unique path)
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
        setSessions((prev) => [...prev, sessionMeta]);
        setCurrentSessionId(sessionId);
        setMessages([]);

        return sessionId;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to create session"
        );
        console.error("Failed to create session:", err);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [sessions.length]
  );

  const selectSession = useCallback(async (sessionId: string) => {
    setCurrentSessionId(sessionId);
    setIsLoading(true);

    // Get session's directory for isolation
    const session = sessions.find((s) => s.id === sessionId);
    const directory = session?.cwd;

    try {
      // Load messages for this session (pass directory for isolation)
      const openCodeMessages = await getSessionMessages(sessionId, directory);
      setMessages(openCodeMessages.map(convertMessage));
    } catch {
      // Session might not exist in OpenCode, start fresh
      setMessages([]);
    } finally {
      setIsLoading(false);
    }
  }, [sessions]);

  const deleteSession = useCallback(
    async (sessionId: string) => {
      try {
        setIsLoading(true);

        // Delete from OpenCode
        try {
          await deleteOpenCodeSession(sessionId);
        } catch {
          // Might not exist in OpenCode, continue anyway
        }

        // Delete local metadata and directory
        await deleteSessionMetadata(sessionId);

        // Update state
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));

        if (currentSessionId === sessionId) {
          setCurrentSessionId(null);
          setMessages([]);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to delete session"
        );
        console.error("Failed to delete session:", err);
      } finally {
        setIsLoading(false);
      }
    },
    [currentSessionId]
  );

  const sendMessage = useCallback(
    async (content: string) => {
      if (!currentSessionId) return;

      // Check if this is the first message (for title update)
      const isFirstMessage = messages.length === 0;

      // Get session's directory for isolation
      const currentSession = sessions.find((s) => s.id === currentSessionId);
      const directory = currentSession?.cwd;

      // Generate a temporary ID for the assistant message
      const assistantMessageId = crypto.randomUUID();

      try {
        setIsLoading(true);
        setError(null);

        // Add user message optimistically
        const userMessage: Message = {
          id: crypto.randomUUID(),
          role: "user",
          content,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, userMessage]);

        // Add placeholder assistant message for streaming
        const assistantMessage: Message = {
          id: assistantMessageId,
          role: "assistant",
          content: "",
          createdAt: new Date().toISOString(),
          isStreaming: true,
        };
        setMessages((prev) => [...prev, assistantMessage]);

        // Send with streaming (pass directory for session isolation)
        const cleanup = await sendMessageStreaming(
          currentSessionId,
          content,
          {
            onText: (delta) => {
              // Append delta to assistant message content
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, content: msg.content + delta }
                    : msg
                )
              );
            },
            onComplete: (messageInfo) => {
              // Mark message as complete and update ID
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, id: messageInfo.id, isStreaming: false }
                    : msg
                )
              );
              setIsLoading(false);

              // Update title from OpenCode after first response
              if (isFirstMessage && currentSession) {
                getSession(currentSessionId, directory).then(async (openCodeSession) => {
                  const updatedSession = { ...currentSession, name: openCodeSession.title };
                  await saveSessionMetadata(updatedSession);
                  setSessions((prev) =>
                    prev.map((s) => (s.id === currentSessionId ? updatedSession : s))
                  );
                });
              }

              // Clean up event source
              cleanup();
            },
            onError: (err) => {
              setError(err.message);
              setIsLoading(false);
              cleanup();
            },
          },
          undefined, // use default model
          directory
        );
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to send message"
        );
        console.error("Failed to send message:", err);
        setIsLoading(false);
      }
    },
    [currentSessionId, messages.length, sessions]
  );

  return (
    <SessionsContext.Provider
      value={{
        sessions,
        currentSessionId,
        messages,
        isLoading,
        isServerReady,
        error,
        createSession,
        selectSession,
        deleteSession,
        sendMessage,
      }}
    >
      {children}
    </SessionsContext.Provider>
  );
}

export function useSessions() {
  const context = useContext(SessionsContext);
  if (!context) {
    throw new Error("useSessions must be used within a SessionsProvider");
  }
  return context;
}
