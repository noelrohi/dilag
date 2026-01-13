import { useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useSessionStore,
  useCurrentSessionId,
  useFilteredSessionMessages,
  useSessionStatus,
  useIsServerReady,
  useError,
  useDebugEvents,
  useHasRunningTools,
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
import { useAgentStore } from "@/hooks/use-agents";
import { withErrorHandler } from "@/lib/async-utils";
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
  const messages = useFilteredSessionMessages(currentSessionId);
  const sessionStatus = useSessionStatus(currentSessionId);
  const hasRunningTools = useHasRunningTools(currentSessionId);
  const isServerReady = useIsServerReady();
  const error = useError();
  const debugEvents = useDebugEvents();

  // Derived: current session from React Query data
  const currentSession = useCurrentSession(sessions, currentSessionId);

  // React Query mutations
  const { createSession: saveSession, updateSession: saveSessionUpdate, deleteSession: removeSession, toggleFavorite: toggleSessionFavorite } = useSessionMutations();

  // Zustand actions
  const {
    setCurrentSessionId,
    setMessages,
    setSessionStatus,
    setSessionError,
    setSessionRevert,
    clearDebugEvents,
    setError,
    setServerReady,
    clearSessionData,
    resetRealtimeState,
  } = useSessionStore();

  const { isServerReady: globalServerReady, subscribeToSession } = useGlobalEvents();

  // Track cleanup functions for async operations
  const cleanupRef = useRef<(() => void)[]>([]);
  const isMountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      cleanupRef.current.forEach((cleanup) => cleanup());
      cleanupRef.current = [];
    };
  }, []);

  // Load messages for a session - defined early so it can be used in effects
  const loadSessionMessages = useCallback(
    async (sessionId: string, directory?: string) => {
      // Load session info first to get revert state
      try {
        const sessionInfo = await sdk.session.get({ sessionID: sessionId, directory });
        if (sessionInfo?.data?.revert) {
          setSessionRevert(sessionId, sessionInfo.data.revert);
        } else {
          setSessionRevert(sessionId, null);
        }
      } catch (err) {
        console.debug(`[loadSessionMessages(${sessionId})] Failed to get session info:`, err);
      }

      // Load messages
      let response;
      try {
        response = await sdk.session.messages({ sessionID: sessionId, directory });
      } catch (err) {
        // Session might not exist in OpenCode yet - this is expected
        console.debug(`[loadSessionMessages(${sessionId})] Session may not exist yet:`, err);
        setMessages(sessionId, []);
        return;
      }

      if (response?.data) {
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
    },
    [sdk, setMessages, setSessionRevert]
  );

  // Handle reconnection bootstrap - refetch state after SSE reconnects
  const hasBootstrappedRef = useRef(false);
  const prevConnectionStatusRef = useRef(connectionStatus);
  useEffect(() => {
    const wasDisconnected = prevConnectionStatusRef.current !== "connected";
    const isNowConnected = connectionStatus === "connected";
    prevConnectionStatusRef.current = connectionStatus;

    if (isNowConnected && wasDisconnected && hasBootstrappedRef.current) {
      resetRealtimeState();

      // Invalidate React Query cache to trigger refetch
      queryClient.invalidateQueries({ queryKey: sessionKeys.all });

      // If we have a current session, reload its messages
      if (currentSessionId && currentSession) {
        loadSessionMessages(currentSessionId, currentSession.cwd);
      }
    }

    // Mark as bootstrapped after first connection
    if (isNowConnected) {
      hasBootstrappedRef.current = true;
    }
  }, [connectionStatus, currentSessionId, currentSession, resetRealtimeState, queryClient, loadSessionMessages]);

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

  // Listen for session.updated events to sync OpenCode title to dilag
  useEffect(() => {
    if (!currentSessionId) return;

    // Helper to check if title is the default format (e.g., "New session - 2024-01-07T...")
    const isDefaultTitle = (title: string) => {
      return /^(New session - |Child session - )\d{4}-\d{2}-\d{2}T/.test(title);
    };

    const unsubscribe = subscribeToSession(currentSessionId, async (event: Event) => {
      if (event.type === "session.updated" && "properties" in event) {
        const info = (event.properties as { info?: { id?: string; title?: string } })?.info;
        if (info?.id === currentSessionId && info?.title && !isDefaultTitle(info.title)) {
          // OpenCode generated a real title, update dilag's session name
          console.log("[useSessions] Title from OpenCode:", info.title);
          if (isMountedRef.current) {
            await saveSessionUpdate({
              id: currentSessionId,
              updates: { name: info.title },
            });
          }
        }
      }
    });

    return unsubscribe;
  }, [currentSessionId, subscribeToSession, saveSessionUpdate]);

  const createSession = useCallback(
    async (name?: string, platform: "web" | "mobile" = "web"): Promise<string | null> => {
      try {
        setError(null);

        const dirId = crypto.randomUUID();
        const cwd = await createSessionDir(dirId);

        // No project initialization needed - AI generates HTML screens directly
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
          platform,
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

        // Delete from OpenCode (may not exist if never sent a message)
        await withErrorHandler(
          () => sdk.session.delete({ sessionID: sessionId, directory: session?.cwd }),
          `deleteSession(${sessionId})`,
          undefined // Continue on error - session may not exist in OpenCode
        );

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

  const stopSession = useCallback(async () => {
    if (!currentSessionId || !currentSession) return;

    // Get abortRunningTools action from store
    const { abortRunningTools } = useSessionStore.getState();

    try {
      await sdk.session.abort({
        sessionID: currentSessionId,
        directory: currentSession.cwd,
      });
      setSessionStatus(currentSessionId, "idle");
      // Also abort any stuck running tools (backend may not clean them up)
      abortRunningTools(currentSessionId);
    } catch (err) {
      console.error("Failed to stop session:", err);
      // Still set to idle and abort tools - abort may fail if session already stopped
      setSessionStatus(currentSessionId, "idle");
      abortRunningTools(currentSessionId);
    }
  }, [currentSessionId, currentSession, sdk, setSessionStatus]);

  // Fork session from a specific message - creates a new session with history up to that message
  // Uses parent's directory so OpenCode can find the forked messages
  const forkSession = useCallback(
    async (messageId: string): Promise<string | null> => {
      if (!currentSessionId || !currentSession) return null;

      try {
        setError(null);

        // Call SDK to fork the session - uses parent's directory
        const response = await sdk.session.fork({
          sessionID: currentSessionId,
          messageID: messageId,
          directory: currentSession.cwd,
        });

        if (!response.data) {
          throw new Error("Failed to fork session");
        }

        const forkedSession = response.data;

        // Use parent's directory - OpenCode associates the forked session with this directory
        // This means screens will persist, but chat history is properly forked
        const sessionMeta: SessionMeta = {
          id: forkedSession.id,
          name: `Fork of ${currentSession.name}`,
          created_at: new Date().toISOString(),
          cwd: currentSession.cwd,
          parentID: currentSessionId,
        };

        // Save to Tauri + update React Query cache
        await saveSession(sessionMeta);

        // Switch to the forked session
        setCurrentSessionId(forkedSession.id);
        await loadSessionMessages(forkedSession.id, currentSession.cwd);

        return forkedSession.id;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fork session");
        console.error("Failed to fork session:", err);
        return null;
      }
    },
    [currentSessionId, currentSession, sdk, saveSession, setCurrentSessionId, loadSessionMessages, setError]
  );

  // Revert session to a specific message - hides this message and all after it
  // Messages are NOT deleted - just filtered out based on session.revert state
  // Actual deletion happens when user sends a new message (server handles cleanup)
  const revertToMessage = useCallback(
    async (messageId: string): Promise<boolean> => {
      if (!currentSessionId || !currentSession) return false;

      try {
        setError(null);

        // Call SDK to revert the session - returns updated session with revert state
        const response = await sdk.session.revert({
          sessionID: currentSessionId,
          messageID: messageId,
          directory: currentSession.cwd,
        });

        // Set revert state from response (also updated via SSE, but set immediately for responsiveness)
        if (response?.data?.revert) {
          setSessionRevert(currentSessionId, response.data.revert);
        }

        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to revert session");
        console.error("Failed to revert session:", err);
        return false;
      }
    },
    [currentSessionId, currentSession, sdk, setError, setSessionRevert]
  );

  // Unrevert session - restores visibility of reverted messages
  // Messages are NOT reloaded - they're already in state, just filtered by revert state
  const unrevertSession = useCallback(async (): Promise<boolean> => {
    if (!currentSessionId || !currentSession) return false;

    try {
      setError(null);

      // Call SDK to unrevert the session
      await sdk.session.unrevert({
        sessionID: currentSessionId,
        directory: currentSession.cwd,
      });

      // Clear local revert state - messages will now be unfiltered
      // (also updated via SSE, but set immediately for responsiveness)
      setSessionRevert(currentSessionId, null);

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unrevert session");
      console.error("Failed to unrevert session:", err);
      return false;
    }
  }, [currentSessionId, currentSession, sdk, setError, setSessionRevert]);

  // Fork session with designs only - creates a new session and copies screen designs (no chat history)
  const forkSessionDesignsOnly = useCallback(
    async (): Promise<string | null> => {
      if (!currentSessionId || !currentSession?.cwd) return null;

      try {
        setError(null);

        // Create a new session directory
        const dirId = crypto.randomUUID();
        const cwd = await createSessionDir(dirId);

        // Create session in OpenCode with the new directory
        const response = await sdk.session.create({ directory: cwd });
        if (!response.data) {
          throw new Error("Failed to create session");
        }
        const newSessionId = response.data.id;

        // Copy designs from current session to new session
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("copy_session_designs", {
          sourceCwd: currentSession.cwd,
          destCwd: cwd,
        });

        // Create session metadata with parentID reference
        const sessionMeta: SessionMeta = {
          id: newSessionId,
          name: `Fork of ${currentSession.name}`,
          created_at: new Date().toISOString(),
          cwd,
          parentID: currentSessionId,
        };

        // Save to Tauri + update React Query cache
        await saveSession(sessionMeta);

        // Switch to the new session
        setCurrentSessionId(newSessionId);
        setMessages(newSessionId, []);

        return newSessionId;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fork session");
        console.error("Failed to fork session with designs:", err);
        return null;
      }
    },
    [currentSessionId, currentSession, sdk, saveSession, setCurrentSessionId, setMessages, setError]
  );

  const sendMessage = useCallback(
    async (content: string, files?: FileUIPart[]) => {
      console.log("[sendMessage] called with:", { content: content?.slice(0, 50), currentSessionId, hasCurrentSession: !!currentSession });
      if (!currentSessionId || !currentSession) {
        console.warn("[sendMessage] early return - missing session", { currentSessionId, currentSession });
        return;
      }

      // Get selected model and variant from store
      const { selectedModel, variants } = useModelStore.getState();
      // Get selected agent from store
      const { selectedAgent } = useAgentStore.getState();
      const agentName = selectedAgent ?? "build";
      const directory = currentSession.cwd;

      // Get variant for current model
      const modelKey = selectedModel
        ? `${selectedModel.providerID}/${selectedModel.modelID}`
        : null;
      const variant = modelKey ? variants[modelKey] : undefined;

      try {
        setError(null);

        // Set session status to running
        setSessionStatus(currentSessionId, "running");

        // Clear any previous session error
        setSessionError(currentSessionId, null);

        // Send message using SDK - fire and forget
        // User message will be added via server events (message.updated)
        const model = selectedModel ?? {
          providerID: "anthropic",
          modelID: "claude-sonnet-4-20250514",
        };
        console.log("[sendMessage] agent:", agentName);
        console.log("[sendMessage] model:", `${model.providerID}/${model.modelID}`);
        console.log("[sendMessage] directory:", directory);

        // On first message, prepend skill instruction
        const platform = currentSession.platform ?? "web";
        const isFirstMessage = messages.length === 0;
        const skillHint = isFirstMessage 
          ? `[Use ${platform}-design skill]\n\n` 
          : "";

        // Build parts array with text and optional file attachments
        const parts: (TextPartInput | FilePartInput)[] = [
          { type: "text", text: skillHint + content }
        ];

        // Add file parts if any
        // HTML screen references: prepend @ScreenName inline, append HTML context at end
        // Other files (images, etc.) are sent as file parts
        const screenContexts: string[] = [];
        const screenNames: string[] = [];
        
        if (files && files.length > 0) {
          for (const file of files) {
            if (file.url) {
              // HTML files: collect for inline @name prefix and hidden context block
              if (file.mediaType === "text/html") {
                const base64Match = file.url.match(/^data:text\/html;base64,(.+)$/);
                if (base64Match) {
                  try {
                    const htmlContent = decodeURIComponent(escape(atob(base64Match[1])));
                    const screenName = file.filename?.replace('.html', '') || 'Screen';
                    screenNames.push(screenName);
                    screenContexts.push(`<screen_context name="${screenName}">\n${htmlContent}\n</screen_context>`);
                  } catch (e) {
                    console.error("[sendMessage] Failed to decode HTML content:", e);
                  }
                }
              } else {
                // Other files (images, etc.) sent as file parts
                parts.push({
                  type: "file",
                  mime: file.mediaType || "application/octet-stream",
                  url: file.url,
                  filename: file.filename,
                });
              }
            }
          }
        }
        
        // Update the text part with inline @names and append screen context
        if (screenNames.length > 0) {
          const inlineRefs = screenNames.map(name => `@${name}`).join(' ');
          const contextBlock = screenContexts.join('\n\n');
          parts[0] = {
            type: "text",
            text: `${inlineRefs} ${skillHint}${content}\n\n${contextBlock}`,
          };
        }

        console.log("[sendMessage] calling sdk.session.prompt with:", { sessionID: currentSessionId, agent: agentName, model, variant, partsCount: parts.length });
        sdk.session.prompt({
          sessionID: currentSessionId,
          directory,
          agent: agentName,
          model,
          parts,
          variant,
        }).then((response) => {
          console.log("[sendMessage] prompt response:", response);
        }).catch((err) => {
          if (!isMountedRef.current) return;
          setError(err instanceof Error ? err.message : "Failed to send message");
          setSessionStatus(currentSessionId, "error");
          console.error("[sendMessage] Failed to send message:", err);
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to send message");
        setSessionStatus(currentSessionId, "error");
        console.error("Failed to send message:", err);
      }
    },
    [currentSessionId, currentSession, messages, setError, setSessionStatus, setSessionError, sdk]
  );

  const toggleFavorite = useCallback(
    async (sessionId: string) => {
      await toggleSessionFavorite(sessionId);
    },
    [toggleSessionFavorite]
  );

  return {
    sessions,
    currentSessionId,
    currentSession,
    messages,
    // Fallback to hasRunningTools when session status is stale/unknown but tools are still running
    isLoading: sessionStatus === "running" || sessionStatus === "busy" || hasRunningTools,
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
    stopSession,
    forkSession,
    forkSessionDesignsOnly,
    revertToMessage,
    unrevertSession,
    clearDebugEvents,
    toggleFavorite,
  };
}
