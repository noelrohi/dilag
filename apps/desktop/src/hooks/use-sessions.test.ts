import { describe, it, expect, beforeEach, vi, type Mock } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createElement, type ReactNode } from "react"

vi.mock("@/context/global-events", () => ({
  useGlobalEvents: vi.fn(() => ({
    isServerReady: true,
    subscribeToSession: vi.fn(() => () => {}),
  })),
  useConnectionStatus: vi.fn(() => ({ connectionStatus: "connected" })),
}))

vi.mock("@/hooks/use-session-data", () => ({
  useSessionsList: vi.fn(() => ({ data: mockSessions, isLoading: false })),
  useCurrentSession: vi.fn(
    (sessions, id) => sessions?.find((s: { id: string }) => s.id === id) ?? null,
  ),
  useSessionMutations: vi.fn(() => ({
    createSession: vi.fn(),
    updateSession: vi.fn(),
    deleteSession: vi.fn(),
    toggleFavorite: vi.fn(),
  })),
  createSessionDir: vi.fn(() => Promise.resolve("/mock/session/dir")),
  sessionKeys: {
    all: ["sessions"],
    lists: () => ["sessions", "list"],
    list: () => ["sessions", "list"],
  },
}))

vi.mock("@/hooks/use-models", () => ({
  useModelStore: {
    getState: vi.fn(() => ({ selectedModel: null, variants: {} })),
  },
}))

vi.mock("@/hooks/use-agents", () => ({
  useAgentStore: {
    getState: vi.fn(() => ({ selectedAgent: null })),
  },
}))

const mockSessions = [
  { id: "session-1", name: "Test Session", created_at: "2024-01-01", cwd: "/mock/cwd/1" },
  { id: "session-2", name: "Another Session", created_at: "2024-01-02", cwd: "/mock/cwd/2" },
]

import { useSessions } from "./use-sessions"
import { useSessionStore } from "@/context/session-store"
import { useModelStore } from "@/hooks/use-models"
import { useCurrentSession } from "@/hooks/use-session-data"

const mockPrompt = vi.mocked(window.desktopBridge!.agent.prompt)
const mockAbort = vi.mocked(window.desktopBridge!.agent.abort)
const mockNavigateTree = vi.mocked(window.desktopBridge!.agent.navigateTree)
const mockGetSession = vi.mocked(window.desktopBridge!.agent.getSession)
const mockGetMessages = vi.mocked(window.desktopBridge!.agent.getMessages)

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe("use-sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrompt.mockResolvedValue(undefined)
    mockAbort.mockResolvedValue(undefined)
    mockNavigateTree.mockResolvedValue({ cancelled: false })
    mockGetSession.mockResolvedValue({
      id: "session-1",
      cwd: "/mock/cwd/1",
      title: "Test Session",
    })
    mockGetMessages.mockResolvedValue([])

    useSessionStore.setState({
      currentSessionId: "session-1",
      screenPositions: {},
      messages: { "session-1": [] },
      parts: {},
      sessionStatus: {},
      sessionDiffs: {},
      sessionRevert: {},
      sessionErrors: {},
      isServerReady: true,
      error: null,
      debugEvents: [],
    })
    ;(useModelStore.getState as Mock).mockReturnValue({ selectedModel: null, variants: {} })
  })

  describe("sendMessage", () => {
    it("sends prompts through the Pi bridge with the first-run skill hint", async () => {
      const { result } = renderHook(() => useSessions(), { wrapper: createWrapper() })

      await act(async () => {
        await result.current.sendMessage("Hello")
      })

      expect(mockPrompt).toHaveBeenCalledWith({
        sessionID: "session-1",
        directory: "/mock/cwd/1",
        text: "/skill:web-design Hello",
        images: [],
        model: null,
      })
    })

    it("uses the selected model when one exists", async () => {
      ;(useModelStore.getState as Mock).mockReturnValue({
        selectedModel: { providerID: "google", modelID: "gemini-2.5-flash" },
        variants: {},
      })

      const { result } = renderHook(() => useSessions(), { wrapper: createWrapper() })

      await act(async () => {
        await result.current.sendMessage("Hello")
      })

      expect(mockPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          model: {
            providerID: "google",
            modelID: "gemini-2.5-flash",
          },
        }),
      )
    })

    it("does not send when currentSession is null", async () => {
      useSessionStore.setState({ currentSessionId: "session-1" })
      ;(useCurrentSession as unknown as Mock).mockReturnValueOnce(null)

      const { result } = renderHook(() => useSessions(), { wrapper: createWrapper() })

      await act(async () => {
        await result.current.sendMessage("Hello")
      })

      expect(mockPrompt).not.toHaveBeenCalled()
    })

    it("passes image attachments through the Pi bridge", async () => {
      const { result } = renderHook(() => useSessions(), { wrapper: createWrapper() })

      await act(async () => {
        await result.current.sendMessage("Hello with image", [
          {
            type: "file",
            url: "data:image/png;base64,abc",
            mediaType: "image/png",
            filename: "test.png",
          },
        ])
      })

      expect(mockPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          text: "/skill:web-design Hello with image",
          images: [{ type: "image", mimeType: "image/png", data: "abc" }],
        }),
      )
    })

    it("sets session status to running when sending", async () => {
      const { result } = renderHook(() => useSessions(), { wrapper: createWrapper() })

      await act(async () => {
        await result.current.sendMessage("Hello")
      })

      expect(useSessionStore.getState().sessionStatus["session-1"]).toBe("running")
    })

    it("handles prompt errors gracefully", async () => {
      mockPrompt.mockRejectedValueOnce(new Error("API Error"))

      const { result } = renderHook(() => useSessions(), { wrapper: createWrapper() })

      await act(async () => {
        await result.current.sendMessage("Hello")
      })

      await waitFor(() => {
        expect(useSessionStore.getState().sessionStatus["session-1"]).toBe("error")
        expect(useSessionStore.getState().error).toBe("API Error")
      })
    })
  })

  describe("session management", () => {
    it("returns sessions from query", () => {
      const { result } = renderHook(() => useSessions(), { wrapper: createWrapper() })

      expect(result.current.sessions).toEqual(mockSessions)
    })

    it("returns current session based on currentSessionId", () => {
      const { result } = renderHook(() => useSessions(), { wrapper: createWrapper() })

      expect(result.current.currentSession).toEqual(mockSessions[0])
    })

    it("returns isServerReady state", () => {
      const { result } = renderHook(() => useSessions(), { wrapper: createWrapper() })

      expect(result.current.isServerReady).toBe(true)
    })
  })

  describe("stopSession", () => {
    it("aborts the Pi session and sets status to idle", async () => {
      const { result } = renderHook(() => useSessions(), { wrapper: createWrapper() })

      await act(async () => {
        await result.current.stopSession()
      })

      expect(mockAbort).toHaveBeenCalledWith({ sessionID: "session-1" })
      expect(useSessionStore.getState().sessionStatus["session-1"]).toBe("idle")
    })
  })

  describe("tree navigation", () => {
    it("uses Pi tree navigation for timeline revert", async () => {
      useSessionStore.getState().setSessionRevert("session-1", { messageID: "stale-message" })

      const { result } = renderHook(() => useSessions(), { wrapper: createWrapper() })

      await act(async () => {
        await result.current.revertToMessage("msg-1")
      })

      expect(mockNavigateTree).toHaveBeenCalledWith({
        sessionID: "session-1",
        targetId: "msg-1",
        summarize: false,
      })
      expect(useSessionStore.getState().sessionRevert["session-1"]).toBeNull()
    })
  })
})
