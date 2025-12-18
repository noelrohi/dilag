import { useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useSessionStore,
  useCurrentSessionId,
  useSessionMessages,
  useSessionStatus,
  useIsServerReady,
  useError,
  useDebugEvents,
  type MessagePart,
  type SessionMeta,
} from "@/context/session-store";
import {
  useSessionsList,
  useCurrentSession,
  useSessionMutations,
  createSessionDir,
  sessionKeys,
} from "@/hooks/use-session-data";
import { useGlobalEvents, useSDK, useConnectionStatus, type Event } from "@/context/global-events";
import { useModelStore } from "@/hooks/use-models";
import type { Part, FilePartInput, TextPartInput } from "@opencode-ai/sdk/v2/client";
import type { FileUIPart } from "ai";

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
    // File part fields
    mime: "mime" in part ? part.mime : undefined,
    url: "url" in part ? part.url : undefined,
    filename: "filename" in part ? part.filename : undefined,
  };
}

/**
 * Main hook for session management
 * 
 * Architecture:
 * - Sessions list: React Query (useSessionsList)
 * - Current session selection: Zustand (client state)
 * - Messages/parts: Zustand (real-time SSE updates)
 * - CRUD operations: React Query mutations
 */
export function useSessions() {
  const sdk = useSDK();
  const queryClient = useQueryClient();
  const { connectionStatus } = useConnectionStatus();

  // React Query for sessions list
  const { data: sessions = [], isLoading: isLoadingSessions } = useSessionsList();

  // Zustand for client state
  const currentSessionId = useCurrentSessionId();
  const messages = useSessionMessages(currentSessionId);
  const sessionStatus = useSessionStatus(currentSessionId);
  const isServerReady = useIsServerReady();
  const error = useError();
  const debugEvents = useDebugEvents();

  // Derived: current session from React Query data
  const currentSession = useCurrentSession(sessions, currentSessionId);

  // React Query mutations
  const { createSession: saveSession, updateSession: saveSessionUpdate, deleteSession: removeSession } = useSessionMutations();

  // Zustand actions
  const {
    setCurrentSessionId,
    setMessages,
    setSessionStatus,
    clearDebugEvents,
    handleEvent,
    setError,
    setServerReady,
    clearSessionData,
    resetRealtimeState,
  } = useSessionStore();

  const { subscribe, subscribeToSession, isServerReady: globalServerReady } = useGlobalEvents();

  // Use ref for handleEvent to avoid infinite loops
  const handleEventRef = useRef(handleEvent);
  handleEventRef.current = handleEvent;

  // Load messages for a session - defined early so it can be used in effects
  const loadSessionMessages = useCallback(
    async (sessionId: string, directory?: string) => {
      try {
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
        // Session might not exist in OpenCode yet
        setMessages(sessionId, []);
      }
    },
    [sdk, setMessages]
  );

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

  // Handle reconnection bootstrap - refetch state after SSE reconnects
  const hasBootstrappedRef = useRef(false);
  useEffect(() => {
    if (connectionStatus === "connected" && hasBootstrappedRef.current) {
      console.log("[useSessions] SSE reconnected - running bootstrap");
      
      // Reset Zustand realtime state (messages, parts, status will be refetched)
      resetRealtimeState();
      
      // Invalidate React Query cache to trigger refetch
      queryClient.invalidateQueries({ queryKey: sessionKeys.all });
      
      // If we have a current session, reload its messages
      if (currentSessionId && currentSession) {
        loadSessionMessages(currentSessionId, currentSession.cwd);
      }
    }
    
    // Mark as bootstrapped after first connection
    if (connectionStatus === "connected") {
      hasBootstrappedRef.current = true;
    }
  }, [connectionStatus, currentSessionId, currentSession, resetRealtimeState, queryClient, loadSessionMessages]);

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

  // Initialize when server is ready - select most recent session and load its messages
  useEffect(() => {
    if (!globalServerReady || initializedRef.current) return;
    initializedRef.current = true;

    setError(null);
    setServerReady(true);

    // Auto-select most recent session if available and none selected
    if (sessions.length > 0 && !currentSessionId) {
      const mostRecent = sessions[sessions.length - 1];
      setCurrentSessionId(mostRecent.id);
      loadSessionMessages(mostRecent.id, mostRecent.cwd);
    }
  }, [globalServerReady, sessions, currentSessionId, setError, setServerReady, setCurrentSessionId, loadSessionMessages]);

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

        // Save to Tauri + update React Query cache
        await saveSession(sessionMeta);

        // Update Zustand client state
        setCurrentSessionId(sessionId);
        setMessages(sessionId, []);

        return sessionId;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create session");
        console.error("Failed to create session:", err);
        return null;
      }
    },
    [sessions.length, setError, setCurrentSessionId, setMessages, sdk, saveSession]
  );

  const selectSession = useCallback(
    async (sessionId: string) => {
      setCurrentSessionId(sessionId);

      // Get session's directory for isolation
      const session = sessions.find((s) => s.id === sessionId);
      await loadSessionMessages(sessionId, session?.cwd);
    },
    [sessions, setCurrentSessionId, loadSessionMessages]
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

        // Delete local metadata (React Query mutation)
        await removeSession(sessionId);

        // Clear Zustand real-time data
        clearSessionData(sessionId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete session");
        console.error("Failed to delete session:", err);
      }
    },
    [sessions, removeSession, clearSessionData, setError, sdk]
  );

  const sendMessage = useCallback(
    async (content: string, files?: FileUIPart[]) => {
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
        const model = selectedModel ?? {
          providerID: "anthropic",
          modelID: "claude-sonnet-4-20250514",
        };
        console.log("[sendMessage] agent:", "designer");
        console.log("[sendMessage] model:", `${model.providerID}/${model.modelID}`);
        console.log("[sendMessage] directory:", directory);

        // Build parts array with text and optional file attachments
        const parts: (TextPartInput | FilePartInput)[] = [
          { type: "text", text: content }
        ];

        // Add file parts if any
        if (files && files.length > 0) {
          for (const file of files) {
            if (file.url) {
              parts.push({
                type: "file",
                mime: file.mediaType || "application/octet-stream",
                url: file.url,
                filename: file.filename,
              });
            }
          }
        }

        sdk.session.prompt({
          sessionID: currentSessionId,
          directory,
          agent: "designer",
          model,
          parts,
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
                await saveSessionUpdate({
                  id: currentSessionId,
                  updates: { name: response.data.title },
                });
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
    [currentSessionId, currentSession, messages.length, setError, setSessionStatus, saveSessionUpdate, sdk]
  );

  return {
    sessions,
    currentSessionId,
    currentSession,
    messages,
    isLoading: sessionStatus === "running",
    isLoadingSessions,
    isServerReady,
    error,
    debugEvents,
    sessionStatus,
    connectionStatus,
    createSession,
    selectSession,
    deleteSession,
    sendMessage,
    clearDebugEvents,
  };
}
