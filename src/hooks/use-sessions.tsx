import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import {
  getClient,
  startServer,
  createSessionDir,
  saveSessionMetadata,
  loadSessionsMetadata,
  deleteSessionMetadata,
  type SessionMeta,
  type OpencodeClient,
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

// Helper to extract text from parts array
function extractTextFromParts(parts: unknown): string {
  if (!Array.isArray(parts)) return "";
  return parts
    .filter(
      (p): p is { type: string; text: string } =>
        typeof p === "object" && p !== null && "type" in p && p.type === "text"
    )
    .map((p) => p.text ?? "")
    .join("");
}

export function SessionsProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isServerReady, setIsServerReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [client, setClient] = useState<OpencodeClient | null>(null);

  // Initialize server and load sessions on mount
  useEffect(() => {
    async function init() {
      try {
        setIsLoading(true);
        setError(null);

        // Start the OpenCode server
        await startServer();

        // Get the client
        const c = await getClient();
        setClient(c);
        setIsServerReady(true);

        // Load persisted sessions
        const savedSessions = await loadSessionsMetadata();
        setSessions(savedSessions);

        // Select the most recent session if available
        if (savedSessions.length > 0) {
          const mostRecent = savedSessions[savedSessions.length - 1];
          setCurrentSessionId(mostRecent.id);
          // Messages will be loaded on demand or stored locally
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
      if (!client) return null;

      try {
        setIsLoading(true);
        setError(null);

        // Create session in OpenCode
        const response = await client.session.create({});
        const sessionId = response.data?.id;

        if (!sessionId) {
          throw new Error("Failed to create session - no ID returned");
        }

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
    [client, sessions.length]
  );

  const selectSession = useCallback(
    async (sessionId: string) => {
      setCurrentSessionId(sessionId);
      // Clear messages when switching sessions
      // In a production app, you might want to load/cache messages per session
      setMessages([]);
    },
    []
  );

  const deleteSession = useCallback(
    async (sessionId: string) => {
      try {
        setIsLoading(true);

        // Delete from OpenCode if possible
        if (client) {
          try {
            await client.session.delete({ path: { id: sessionId } });
          } catch {
            // Might not exist in OpenCode, continue anyway
          }
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
    [client, currentSessionId]
  );

  const sendMessage = useCallback(
    async (content: string) => {
      if (!client || !currentSessionId) return;

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
        const response = await client.session.prompt({
          path: { id: currentSessionId },
          body: {
            parts: [{ type: "text", text: content }],
          },
        });

        // Add assistant response
        if (response.data) {
          const data = response.data as { info?: { id?: string }; parts?: unknown };
          const assistantContent = extractTextFromParts(data.parts);

          const assistantMessage: Message = {
            id: data.info?.id ?? crypto.randomUUID(),
            role: "assistant",
            content: assistantContent,
            createdAt: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, assistantMessage]);
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
    [client, currentSessionId]
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
