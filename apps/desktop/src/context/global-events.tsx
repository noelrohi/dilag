import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { extractSessionId, type Event } from "@/lib/event-guards"
import { useSessionStore } from "@/context/session-store"
import { bridge } from "@/lib/bridge"

export type {
  Event,
  EventMessagePartUpdated,
  EventMessageUpdated,
  EventSessionStatus,
  EventSessionUpdatedCustom as EventSessionUpdated,
  EventSessionDiff,
  EventSessionIdle,
  EventSessionError,
  Part,
  ToolState,
  SnapshotFileDiff as FileDiff,
} from "@/lib/event-guards"

type EventHandler = (event: Event) => void

export type ConnectionStatus = "disconnected" | "connecting" | "connected"

interface GlobalEventsContextValue {
  subscribe: (handler: EventHandler) => () => void
  subscribeToSession: (sessionId: string, handler: EventHandler) => () => void
  connectionStatus: ConnectionStatus
  isConnected: boolean
  isServerReady: boolean
  serverError: string | null
  retryStart: () => Promise<void>
  bootstrap: () => Promise<void>
}

const GlobalEventsContext = createContext<GlobalEventsContextValue | null>(null)

export function GlobalEventsProvider({ children }: { children: ReactNode }) {
  const [isServerReady, setIsServerReady] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected")
  const handlersRef = useRef<Set<EventHandler>>(new Set())
  const sessionHandlersRef = useRef<Map<string, Set<EventHandler>>>(new Map())
  const mountedRef = useRef(true)
  const bootstrapCallbacksRef = useRef<Set<() => void>>(new Set())
  const unsubscribeRef = useRef<(() => void) | undefined>(undefined)
  const startingRef = useRef(false)

  const subscribe = useCallback((handler: EventHandler): (() => void) => {
    handlersRef.current.add(handler)
    return () => handlersRef.current.delete(handler)
  }, [])

  const subscribeToSession = useCallback(
    (sessionId: string, handler: EventHandler): (() => void) => {
      if (!sessionHandlersRef.current.has(sessionId)) {
        sessionHandlersRef.current.set(sessionId, new Set())
      }
      sessionHandlersRef.current.get(sessionId)!.add(handler)

      return () => {
        const handlers = sessionHandlersRef.current.get(sessionId)
        handlers?.delete(handler)
        if (handlers?.size === 0) {
          sessionHandlersRef.current.delete(sessionId)
        }
      }
    },
    [],
  )

  const bootstrap = useCallback(async () => {
    console.log("[GlobalEvents] Running bootstrap - syncing pending questions")

    try {
      const questions = await bridge.agent.listQuestions()
      useSessionStore
        .getState()
        .syncPendingQuestions(questions as import("@/lib/event-guards").QuestionRequest[])
      console.log("[GlobalEvents] Synced", questions.length, "pending questions")
    } catch (err) {
      console.error("[GlobalEvents] Failed to sync questions:", err)
    }

    bootstrapCallbacksRef.current.forEach((callback) => callback())
  }, [])

  const startRuntime = useCallback(async () => {
    // Guard against two concurrent starts (e.g. mount + a fast Retry click).
    if (startingRef.current) return
    startingRef.current = true

    console.log("[GlobalEvents] Starting agent runtime...")
    setConnectionStatus("connecting")
    setServerError(null)

    try {
      await bridge.agent.start()
      console.log("[GlobalEvents] Agent runtime started")

      if (!mountedRef.current) return
      setConnectionStatus("connected")
      setIsServerReady(true)
      setServerError(null)

      await bootstrap()

      // Guard against double-subscription on retry: drop any prior listener first.
      unsubscribeRef.current?.()
      unsubscribeRef.current = bridge.agent.onEvent((payload) => {
        const event = payload as Event
        if (!mountedRef.current) return

        useSessionStore.getState().handleEvent(event)

        handlersRef.current.forEach((handler) => {
          try {
            handler(event)
          } catch (err) {
            console.error("[GlobalEvents] Handler error:", err)
          }
        })

        const sessionId = extractSessionId(event)
        if (sessionId) {
          const sessionHandlers = sessionHandlersRef.current.get(sessionId)
          sessionHandlers?.forEach((handler) => {
            try {
              handler(event)
            } catch (err) {
              console.error("[GlobalEvents] Session handler error:", err)
            }
          })
        }
      })
    } catch (err) {
      console.error("[GlobalEvents] Agent runtime start error:", err)
      if (mountedRef.current) {
        setIsServerReady(false)
        setServerError(err instanceof Error ? err.message : String(err))
        setConnectionStatus("disconnected")
      }
    } finally {
      startingRef.current = false
    }
  }, [bootstrap])

  useEffect(() => {
    mountedRef.current = true

    startRuntime()

    return () => {
      mountedRef.current = false
      unsubscribeRef.current?.()
      unsubscribeRef.current = undefined
      console.log("[GlobalEvents] Cleanup - disconnected")
    }
  }, [startRuntime])

  return (
    <GlobalEventsContext.Provider
      value={{
        subscribe,
        subscribeToSession,
        connectionStatus,
        isConnected: connectionStatus === "connected",
        isServerReady,
        serverError,
        retryStart: startRuntime,
        bootstrap,
      }}
    >
      {children}
    </GlobalEventsContext.Provider>
  )
}

export function useGlobalEvents() {
  const context = useContext(GlobalEventsContext)
  if (!context) {
    throw new Error("useGlobalEvents must be used within a GlobalEventsProvider")
  }
  return context
}

export function useConnectionStatus() {
  const { connectionStatus } = useGlobalEvents()
  return { connectionStatus }
}
