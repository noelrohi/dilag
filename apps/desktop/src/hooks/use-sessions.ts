import { useEffect, useCallback, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  useSessionStore,
  useCurrentSessionId,
  useSessionMessages,
  useSessionStatus,
  useIsServerReady,
  useError,
  useDebugEvents,
  useHasRunningTools,
  type MessagePart,
  type SessionMeta,
} from "@/context/session-store"
import {
  useSessionsList,
  useCurrentSession,
  useSessionMutations,
  sessionKeys,
} from "@/hooks/use-session-data"
import { useGlobalEvents, useConnectionStatus, type Event } from "@/context/global-events"
import { useModelStore } from "@/hooks/use-models"
import { useAgentStore } from "@/hooks/use-agents"
import { withErrorHandler } from "@/lib/async-utils"
import { bridge } from "@/lib/bridge"
import type { AgentMessage as BridgeAgentMessage, ProjectMeta } from "@dilag/desktop-bridge"
import type { FileUIPart } from "ai"
import { deliverDilagPrompt } from "@/lib/prompt-delivery"

export type SendMessageOptions = {
  streamingBehavior?: "steer" | "followUp"
}

type CreateSessionInProjectOptions = {
  platform?: "web" | "mobile"
  initialPrompt?: string
  files?: FileUIPart[]
  name?: string
}

// Convert bridge message parts to our internal format.
function convertPart(
  part: BridgeAgentMessage["parts"][number],
  messageID: string,
  sessionID: string,
): MessagePart {
  return {
    id: part.id,
    messageID,
    sessionID,
    type: part.type as MessagePart["type"],
    text: "text" in part ? part.text : undefined,
    tool: "tool" in part ? part.tool : undefined,
    state: "state" in part ? (part.state as MessagePart["state"]) : undefined,
    // File part fields
    mime: "mime" in part ? part.mime : undefined,
    url: "url" in part ? part.url : undefined,
    filename: "filename" in part ? part.filename : undefined,
    // Step part fields
    provider: part.provider,
    model: part.model,
  }
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
  const queryClient = useQueryClient()
  const { connectionStatus } = useConnectionStatus()

  // React Query for sessions list
  const { data: sessions = [], isLoading: isLoadingSessions } = useSessionsList()

  // Zustand for client state
  const currentSessionId = useCurrentSessionId()
  const messages = useSessionMessages(currentSessionId)
  const sessionStatus = useSessionStatus(currentSessionId)
  const hasRunningTools = useHasRunningTools(currentSessionId)
  const isServerReady = useIsServerReady()
  const error = useError()
  const debugEvents = useDebugEvents()

  // Derived: current session from React Query data
  const currentSession = useCurrentSession(sessions, currentSessionId)

  // React Query mutations
  const {
    updateSession: saveSessionUpdate,
    deleteSession: removeSession,
    toggleFavorite: toggleSessionFavorite,
  } = useSessionMutations()

  // Zustand actions
  const {
    setCurrentSessionId,
    setMessages,
    setSessionStatus,
    setSessionError,
    clearDebugEvents,
    setError,
    setServerReady,
    clearSessionData,
    resetRealtimeState,
  } = useSessionStore()

  const { isServerReady: globalServerReady, subscribeToSession } = useGlobalEvents()

  // Track cleanup functions for async operations
  const cleanupRef = useRef<(() => void)[]>([])
  const isMountedRef = useRef(true)

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      cleanupRef.current.forEach((cleanup) => cleanup())
      cleanupRef.current = []
    }
  }, [])

  // Load messages for a session - defined early so it can be used in effects
  const loadSessionMessages = useCallback(
    async (sessionId: string, directory?: string) => {
      // Load messages
      let response
      try {
        response = await bridge.agent.getMessages({
          sessionID: sessionId,
          directory: directory ?? "",
        })
      } catch (err) {
        // Session might not exist in the agent runtime yet - this is expected
        console.debug(`[loadSessionMessages(${sessionId})] Session may not exist yet:`, err)
        setMessages(sessionId, [])
        return
      }

      if (response) {
        const msgs = response.map((msg) => ({
          id: msg.info.id,
          sessionID: msg.info.sessionID,
          role: msg.info.role as "user" | "assistant",
          time: msg.info.time,
        }))
        setMessages(sessionId, msgs)

        // Set parts for each message
        const state = useSessionStore.getState()
        response.forEach((msg) => {
          msg.parts?.forEach((part) => {
            state.updatePart(msg.info.id, convertPart(part, msg.info.id, msg.info.sessionID))
          })
        })
      }
    },
    [setMessages],
  )

  // Handle reconnection bootstrap - refetch state after SSE reconnects
  const hasBootstrappedRef = useRef(false)
  const prevConnectionStatusRef = useRef(connectionStatus)
  useEffect(() => {
    const wasDisconnected = prevConnectionStatusRef.current !== "connected"
    const isNowConnected = connectionStatus === "connected"
    prevConnectionStatusRef.current = connectionStatus

    if (isNowConnected && wasDisconnected && hasBootstrappedRef.current) {
      resetRealtimeState()

      // Invalidate React Query cache to trigger refetch
      queryClient.invalidateQueries({ queryKey: sessionKeys.all })

      // If we have a current session, reload its messages
      if (currentSessionId && currentSession) {
        loadSessionMessages(currentSessionId, currentSession.cwd)
      }
    }

    // Mark as bootstrapped after first connection
    if (isNowConnected) {
      hasBootstrappedRef.current = true
    }
  }, [
    connectionStatus,
    currentSessionId,
    currentSession,
    resetRealtimeState,
    queryClient,
    loadSessionMessages,
  ])

  // Track if initialized to prevent double init
  const initializedRef = useRef(false)

  // Initialize when server is ready - select most recent session and load its messages
  useEffect(() => {
    if (!globalServerReady || initializedRef.current) return
    initializedRef.current = true

    setError(null)
    setServerReady(true)

    // Auto-select most recent session if available and none selected
    if (sessions.length > 0 && !currentSessionId) {
      const mostRecent = sessions[sessions.length - 1]
      setCurrentSessionId(mostRecent.id)
      loadSessionMessages(mostRecent.id, mostRecent.cwd)
    }
  }, [
    globalServerReady,
    sessions,
    currentSessionId,
    setError,
    setServerReady,
    setCurrentSessionId,
    loadSessionMessages,
  ])

  // Listen for session.updated events to sync agent data (title, updated_at) to Dilag.
  useEffect(() => {
    if (!currentSessionId) return

    // Helper to check if title is the default format (e.g., "New session - 2024-01-07T...")
    const isDefaultTitle = (title: string) => {
      return /^(New session - |Child session - )\d{4}-\d{2}-\d{2}T/.test(title)
    }

    const unsubscribe = subscribeToSession(currentSessionId, async (event: Event) => {
      if (event.type === "session.updated" && "properties" in event) {
        const info = (
          event.properties as {
            info?: { id?: string; title?: string; time?: { updated?: number } }
          }
        )?.info
        if (info?.id === currentSessionId && isMountedRef.current) {
          const updates: { name?: string; updated_at?: string } = {}

          // Sync title if the agent generated a real title.
          if (info?.title && !isDefaultTitle(info.title)) {
            console.log("[useSessions] Title from agent:", info.title)
            updates.name = info.title
          }

          // Sync updated_at timestamp from the agent runtime.
          if (info?.time?.updated) {
            updates.updated_at = new Date(info.time.updated).toISOString()
          }

          // Pi SDK is the source of truth for project sessions. Keep legacy
          // session metadata in sync only for old sessions without a project.
          if (Object.keys(updates).length > 0) {
            if (currentSession?.projectId) {
              queryClient.invalidateQueries({ queryKey: sessionKeys.list() })
            } else {
              await saveSessionUpdate({
                id: currentSessionId,
                updates,
              })
            }
          }
        }
      }
    })

    return unsubscribe
  }, [currentSessionId, subscribeToSession, saveSessionUpdate, currentSession, queryClient])

  const createSession = useCallback(
    async (name?: string, platform?: "web" | "mobile"): Promise<string | null> => {
      try {
        setError(null)

        const projects = await bridge.projects.list()
        const sortedProjects = [...projects].sort(
          (a, b) => new Date(b.last_opened_at).getTime() - new Date(a.last_opened_at).getTime(),
        )
        const project = sortedProjects.find((item) => item.pinned) ?? sortedProjects[0]
        if (!project) throw new Error("Create a project before starting a design")
        const cwd = project.path

        const response = await bridge.agent.createSession({ directory: cwd })
        const sessionId = response.id

        // Create session metadata
        const now = new Date().toISOString()
        const sessionMeta: SessionMeta = {
          id: sessionId,
          name: name ?? `Session ${sessions.length + 1}`,
          created_at: now,
          updated_at: now,
          cwd,
          platform: platform ?? project.platform ?? "web",
          projectId: project.id,
        }
        await bridge.sessions.saveMeta({ session: sessionMeta })

        // Update React Query cache optimistically. Pi SDK owns persistence.
        queryClient.setQueryData<SessionMeta[]>(sessionKeys.list(), (old) =>
          old ? [...old, sessionMeta] : [sessionMeta],
        )
        queryClient.invalidateQueries({ queryKey: sessionKeys.list() })

        // Update Zustand client state
        setCurrentSessionId(sessionId)
        setMessages(sessionId, [])

        return sessionId
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create session")
        console.error("Failed to create session:", err)
        return null
      }
    },
    [sessions.length, setError, setCurrentSessionId, setMessages, queryClient],
  )

  const createSessionInProject = useCallback(
    async (
      project: ProjectMeta,
      optionsOrPlatform: CreateSessionInProjectOptions | "web" | "mobile" = {},
    ): Promise<string | null> => {
      const options =
        typeof optionsOrPlatform === "string" ? { platform: optionsOrPlatform } : optionsOrPlatform
      const platform = options.platform ?? project.platform
      const { initialPrompt, files, name } = options
      try {
        setError(null)
        const response = await bridge.agent.createSession({ directory: project.path })
        const now = new Date().toISOString()
        const sessionMeta: SessionMeta = {
          id: response.id,
          name: name ?? "New chat",
          created_at: now,
          updated_at: now,
          cwd: project.path,
          platform,
          projectId: project.id,
          favorite: project.pinned,
        }
        await bridge.sessions.saveMeta({ session: sessionMeta })
        queryClient.setQueryData<SessionMeta[]>(sessionKeys.list(), (old) =>
          old ? [...old, sessionMeta] : [sessionMeta],
        )
        setCurrentSessionId(response.id)
        setMessages(response.id, [])
        queryClient.invalidateQueries({ queryKey: sessionKeys.list() })

        if (initialPrompt?.trim() || (files && files.length > 0)) {
          const { selectedModel, variants } = useModelStore.getState()
          const selectedThinkingLevel = selectedModel
            ? variants[`${selectedModel.providerID}/${selectedModel.modelID}`]
            : undefined

          setSessionStatus(response.id, "running")
          setSessionError(response.id, null)

          void deliverDilagPrompt({
            session: {
              id: response.id,
              cwd: project.path,
              platform,
            },
            content: initialPrompt ?? "",
            files,
            isFirstMessage: true,
            sessionStatus: "idle",
            hasRunningTools: false,
            model: selectedModel,
            thinkingLevel: selectedThinkingLevel,
          }).catch((err) => {
            if (!isMountedRef.current) return
            setError(err instanceof Error ? err.message : "Failed to send first message")
            setSessionStatus(response.id, "error")
            console.error("Failed to send first project prompt:", err)
          })
        }

        return response.id
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create chat")
        console.error("Failed to create project chat:", err)
        return null
      }
    },
    [queryClient, setCurrentSessionId, setError, setMessages, setSessionError, setSessionStatus],
  )

  const selectSession = useCallback(
    async (sessionId: string) => {
      setCurrentSessionId(sessionId)

      // Get session's directory for isolation
      const session = sessions.find((s) => s.id === sessionId)
      await loadSessionMessages(sessionId, session?.cwd)
    },
    [sessions, setCurrentSessionId, loadSessionMessages],
  )

  const renameSession = useCallback(
    async (sessionId: string, name: string) => {
      const nextName = name.trim()
      if (!nextName) return

      try {
        const session = sessions.find((item) => item.id === sessionId)
        await bridge.agent.renameSession({
          sessionID: sessionId,
          name: nextName,
          directory: session?.cwd,
        })
        queryClient.setQueryData<SessionMeta[]>(
          sessionKeys.list(),
          (old) =>
            old?.map((item) =>
              item.id === sessionId
                ? { ...item, name: nextName, updated_at: new Date().toISOString() }
                : item,
            ) ?? [],
        )
        if (session) {
          await bridge.sessions.saveMeta({
            session: { ...session, name: nextName, updated_at: new Date().toISOString() },
          })
        }
        queryClient.invalidateQueries({ queryKey: sessionKeys.list() })
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to rename session")
        console.error("Failed to rename session:", err)
      }
    },
    [queryClient, sessions, setError],
  )

  const deleteSession = useCallback(
    async (sessionId: string) => {
      try {
        const session = sessions.find((item) => item.id === sessionId)

        // Delete from the agent runtime (may not exist if never sent a message)
        await withErrorHandler(
          () => bridge.agent.deleteSession({ sessionID: sessionId, directory: session?.cwd }),
          `deleteSession(${sessionId})`,
          undefined, // Continue on error - session may not exist in the runtime
        )

        if (session?.projectId) {
          await removeSession(sessionId).catch(() => undefined)
          queryClient.setQueryData<SessionMeta[]>(
            sessionKeys.list(),
            (old) => old?.filter((item) => item.id !== sessionId) ?? [],
          )
          queryClient.invalidateQueries({ queryKey: sessionKeys.list() })
        } else {
          // Delete legacy local metadata (React Query mutation)
          await removeSession(sessionId)
        }

        // Clear Zustand real-time data
        clearSessionData(sessionId)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete session")
        console.error("Failed to delete session:", err)
      }
    },
    [sessions, queryClient, removeSession, clearSessionData, setError],
  )

  const stopSession = useCallback(async () => {
    if (!currentSessionId || !currentSession) return

    // Get abortRunningTools action from store
    const { abortRunningTools } = useSessionStore.getState()

    try {
      await bridge.agent.abort({ sessionID: currentSessionId })
      setSessionStatus(currentSessionId, "idle")
      // Also abort any stuck running tools (backend may not clean them up)
      abortRunningTools(currentSessionId)
    } catch (err) {
      console.error("Failed to stop session:", err)
      // Still set to idle and abort tools - abort may fail if session already stopped
      setSessionStatus(currentSessionId, "idle")
      abortRunningTools(currentSessionId)
    }
  }, [currentSessionId, currentSession, setSessionStatus])

  // Fork a Pi session at a previous message into a separate session file.
  const forkSession = useCallback(
    async (messageId: string): Promise<string | null> => {
      if (!currentSessionId || !currentSession) return null

      try {
        setError(null)
        const response = await bridge.agent.forkSession({
          sessionID: currentSessionId,
          targetId: messageId,
        })
        const newSessionId = response.id
        const now = new Date().toISOString()
        const sessionMeta: SessionMeta = {
          id: newSessionId,
          name: `Fork of ${currentSession.name}`,
          created_at: now,
          updated_at: now,
          cwd: currentSession.cwd,
          parentID: currentSessionId,
          platform: currentSession.platform,
          projectId: currentSession.projectId,
          favorite: currentSession.favorite,
        }
        await bridge.sessions.saveMeta({ session: sessionMeta })

        queryClient.setQueryData<SessionMeta[]>(sessionKeys.list(), (old) =>
          old ? [...old, sessionMeta] : [sessionMeta],
        )
        queryClient.invalidateQueries({ queryKey: sessionKeys.list() })
        setCurrentSessionId(newSessionId)
        await loadSessionMessages(newSessionId, currentSession.cwd)
        return newSessionId
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fork session")
        console.error("Failed to fork session:", err)
        return null
      }
    },
    [
      currentSessionId,
      currentSession,
      queryClient,
      setCurrentSessionId,
      loadSessionMessages,
      setError,
    ],
  )

  // Fork session with designs only - creates a new session and copies screen designs (no chat history)
  const forkSessionDesignsOnly = useCallback(async (): Promise<string | null> => {
    if (!currentSessionId || !currentSession?.cwd) return null

    try {
      setError(null)

      // Create a new chat in the same project folder.
      const cwd = currentSession.cwd
      const response = await bridge.agent.createSession({ directory: cwd })
      const newSessionId = response.id

      // Copy designs from current session to new session
      await bridge.designs.copyBetweenSessions({
        sourceCwd: currentSession.cwd,
        destCwd: cwd,
      })

      // Create session metadata with parentID reference
      const now = new Date().toISOString()
      const sessionMeta: SessionMeta = {
        id: newSessionId,
        name: `Fork of ${currentSession.name}`,
        created_at: now,
        updated_at: now,
        cwd,
        parentID: currentSessionId,
        platform: currentSession.platform,
        projectId: currentSession.projectId,
        favorite: currentSession.favorite,
      }
      await bridge.sessions.saveMeta({ session: sessionMeta })

      queryClient.setQueryData<SessionMeta[]>(sessionKeys.list(), (old) =>
        old ? [...old, sessionMeta] : [sessionMeta],
      )
      queryClient.invalidateQueries({ queryKey: sessionKeys.list() })

      // Switch to the new session
      setCurrentSessionId(newSessionId)
      setMessages(newSessionId, [])

      return newSessionId
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fork session")
      console.error("Failed to fork session with designs:", err)
      return null
    }
  }, [currentSessionId, currentSession, queryClient, setCurrentSessionId, setMessages, setError])

  const sendMessage = useCallback(
    async (content: string, files?: FileUIPart[], options?: SendMessageOptions) => {
      console.log("[sendMessage] called with:", {
        content: content?.slice(0, 50),
        currentSessionId,
        hasCurrentSession: !!currentSession,
      })
      if (!currentSessionId || !currentSession) {
        console.warn("[sendMessage] early return - missing session", {
          currentSessionId,
          currentSession,
        })
        return
      }

      // Get selected model and reasoning level from store
      const { selectedModel, variants } = useModelStore.getState()
      const selectedThinkingLevel = selectedModel
        ? variants[`${selectedModel.providerID}/${selectedModel.modelID}`]
        : undefined
      // Get selected agent from store
      const { selectedAgent } = useAgentStore.getState()
      const agentName = selectedAgent ?? "build"
      const directory = currentSession.cwd

      try {
        setError(null)

        // Set session status to running
        setSessionStatus(currentSessionId, "running")

        // Clear any previous session error
        setSessionError(currentSessionId, null)

        console.log("[sendMessage] agent:", agentName)
        console.log(
          "[sendMessage] model:",
          selectedModel
            ? `${selectedModel.providerID}/${selectedModel.modelID}`
            : "first available",
        )
        console.log("[sendMessage] directory:", directory)

        console.log("[sendMessage] calling bridge.agent.prompt with:", {
          sessionID: currentSessionId,
          agent: agentName,
          model: selectedModel,
          thinkingLevel: selectedThinkingLevel,
        })
        const delivery = await deliverDilagPrompt({
          session: {
            id: currentSessionId,
            cwd: directory,
            platform: currentSession.platform ?? "web",
          },
          content,
          files,
          isFirstMessage: messages.length === 0,
          sessionStatus,
          hasRunningTools,
          streamingBehavior: options?.streamingBehavior,
          model: selectedModel,
          thinkingLevel: selectedThinkingLevel,
        })
        console.log("[sendMessage] prompt accepted", delivery)
        return delivery
      } catch (err) {
        if (!isMountedRef.current) return
        setError(err instanceof Error ? err.message : "Failed to send message")
        setSessionStatus(currentSessionId, "error")
        console.error("Failed to send message:", err)
        throw err
      }
    },
    [
      currentSessionId,
      currentSession,
      messages,
      sessionStatus,
      hasRunningTools,
      setError,
      setSessionStatus,
      setSessionError,
    ],
  )

  const toggleFavorite = useCallback(
    async (sessionId: string) => {
      await toggleSessionFavorite(sessionId)
    },
    [toggleSessionFavorite],
  )

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
    createSessionInProject,
    selectSession,
    renameSession,
    deleteSession,
    sendMessage,
    stopSession,
    forkSession,
    forkSessionDesignsOnly,
    clearDebugEvents,
    toggleFavorite,
  }
}
