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
  sendMessage as sendOpenCodeMessage,
  createSessionDir,
  saveSessionMetadata,
  loadSessionsMetadata,
  deleteSessionMetadata,
  extractTextFromParts,
  generateTitle,
  type SessionMeta,
  type OpenCodeMessage,
} from "@/lib/opencode";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
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

          // Load messages for this session
          try {
            const openCodeMessages = await getSessionMessages(mostRecent.id);
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

        // Create session in OpenCode
        const openCodeSession = await createOpenCodeSession();
        const sessionId = openCodeSession.id;

        // Create the session directory
        const cwd = await createSessionDir(sessionId);

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

    try {
      // Load messages for this session
      const openCodeMessages = await getSessionMessages(sessionId);
      setMessages(openCodeMessages.map(convertMessage));
    } catch {
      // Session might not exist in OpenCode, start fresh
      setMessages([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

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

      // Check if this is the first message (for title generation)
      const isFirstMessage = messages.length === 0;

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

        // Send to OpenCode
        const response = await sendOpenCodeMessage(currentSessionId, content);

        // Add assistant response
        const assistantMessage: Message = {
          id: response.info.id,
          role: "assistant",
          content: extractTextFromParts(response.parts),
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMessage]);

        // Generate title after first response
        if (isFirstMessage) {
          const currentSession = sessions.find((s) => s.id === currentSessionId);
          if (currentSession) {
            generateTitle(content).then(async (title) => {
              const updatedSession = { ...currentSession, name: title };
              await saveSessionMetadata(updatedSession);
              setSessions((prev) =>
                prev.map((s) => (s.id === currentSessionId ? updatedSession : s))
              );
            });
          }
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to send message"
        );
        console.error("Failed to send message:", err);
      } finally {
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
