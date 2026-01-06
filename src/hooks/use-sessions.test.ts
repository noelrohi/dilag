import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

vi.mock("@/context/global-events", () => ({
  useGlobalEvents: vi.fn(() => ({ isServerReady: true })),
  useSDK: vi.fn(() => mockSDK),
  useConnectionStatus: vi.fn(() => ({ connectionStatus: "connected" })),
}));

vi.mock("@/hooks/use-session-data", () => ({
  useSessionsList: vi.fn(() => ({ data: mockSessions, isLoading: false })),
  useCurrentSession: vi.fn((sessions, id) => sessions?.find((s: { id: string }) => s.id === id) ?? null),
  useSessionMutations: vi.fn(() => ({
    createSession: vi.fn(),
    updateSession: vi.fn(),
    deleteSession: vi.fn(),
  })),
  createSessionDir: vi.fn(() => Promise.resolve("/mock/session/dir")),
  sessionKeys: { all: ["sessions"], lists: () => ["sessions", "list"], list: () => ["sessions", "list"] },
}));

vi.mock("@/hooks/use-models", () => ({
  useModelStore: {
    getState: vi.fn(() => ({ selectedModel: null })),
  },
}));

const mockSDK = {
  session: {
    create: vi.fn(() => Promise.resolve({ data: { id: "new-session-id" } })),
    get: vi.fn(() => Promise.resolve({ data: { id: "session-1", title: "Test Session" } })),
    messages: vi.fn(() => Promise.resolve({ data: [] })),
    prompt: vi.fn(() => Promise.resolve({ data: {} })),
    delete: vi.fn(() => Promise.resolve()),
    abort: vi.fn(() => Promise.resolve()),
    fork: vi.fn(() => Promise.resolve({ data: { id: "forked-session-id" } })),
    revert: vi.fn(() => Promise.resolve({ data: { revert: null } })),
    unrevert: vi.fn(() => Promise.resolve()),
  },
};

const mockSessions = [
  { id: "session-1", name: "Test Session", created_at: "2024-01-01", cwd: "/mock/cwd/1" },
  { id: "session-2", name: "Another Session", created_at: "2024-01-02", cwd: "/mock/cwd/2" },
];

import { useSessions } from "./use-sessions";
import { useSessionStore } from "@/context/session-store";
import { useModelStore } from "@/hooks/use-models";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("use-sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
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
    });

    (useModelStore.getState as Mock).mockReturnValue({ selectedModel: null });
  });

  describe("sendMessage", () => {
    it("should use default anthropic model when no model selected", async () => {
      const { result } = renderHook(() => useSessions(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.sendMessage("Hello");
      });

      expect(mockSDK.session.prompt).toHaveBeenCalledWith(
        expect.objectContaining({
          model: {
            providerID: "anthropic",
            modelID: "claude-sonnet-4-20250514",
          },
        })
      );
    });

    it("should use opencode provider when selected", async () => {
      (useModelStore.getState as Mock).mockReturnValue({
        selectedModel: { providerID: "opencode", modelID: "big-pickle" },
      });

      const { result } = renderHook(() => useSessions(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.sendMessage("Hello");
      });

      expect(mockSDK.session.prompt).toHaveBeenCalledWith(
        expect.objectContaining({
          model: {
            providerID: "opencode",
            modelID: "big-pickle",
          },
        })
      );
    });

    it("should use selected model when non-opencode provider", async () => {
      (useModelStore.getState as Mock).mockReturnValue({
        selectedModel: { providerID: "google", modelID: "gemini-2.5-flash" },
      });

      const { result } = renderHook(() => useSessions(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.sendMessage("Hello");
      });

      expect(mockSDK.session.prompt).toHaveBeenCalledWith(
        expect.objectContaining({
          model: {
            providerID: "google",
            modelID: "gemini-2.5-flash",
          },
        })
      );
    });

    it("should always use designer agent", async () => {
      const { result } = renderHook(() => useSessions(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.sendMessage("Hello");
      });

      expect(mockSDK.session.prompt).toHaveBeenCalledWith(
        expect.objectContaining({
          agent: "designer",
        })
      );
    });

    it("should not send message when currentSession is null", async () => {
      useSessionStore.setState({ currentSessionId: null });

      const { result } = renderHook(() => useSessions(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.sendMessage("Hello");
      });

      expect(mockSDK.session.prompt).not.toHaveBeenCalled();
    });

    it("should not send message when currentSessionId is null", async () => {
      useSessionStore.setState({ currentSessionId: "non-existent-session" });

      const { result } = renderHook(() => useSessions(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.sendMessage("Hello");
      });

      expect(mockSDK.session.prompt).not.toHaveBeenCalled();
    });

    it("should include file parts when files are provided", async () => {
      const { result } = renderHook(() => useSessions(), { wrapper: createWrapper() });

      const files = [
        { type: "file" as const, url: "data:image/png;base64,abc", mediaType: "image/png", filename: "test.png" },
      ];

      await act(async () => {
        await result.current.sendMessage("Hello with image", files);
      });

      expect(mockSDK.session.prompt).toHaveBeenCalledWith(
        expect.objectContaining({
          parts: [
            { type: "text", text: "Hello with image" },
            { type: "file", mime: "image/png", url: "data:image/png;base64,abc", filename: "test.png" },
          ],
        })
      );
    });

    it("should set session status to running when sending", async () => {
      const { result } = renderHook(() => useSessions(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.sendMessage("Hello");
      });

      expect(useSessionStore.getState().sessionStatus["session-1"]).toBe("running");
    });

    it("should handle SDK errors gracefully", async () => {
      mockSDK.session.prompt.mockRejectedValueOnce(new Error("API Error"));

      const { result } = renderHook(() => useSessions(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.sendMessage("Hello");
      });

      await waitFor(() => {
        expect(useSessionStore.getState().sessionStatus["session-1"]).toBe("error");
        expect(useSessionStore.getState().error).toBe("API Error");
      });
    });
  });

  describe("session management", () => {
    it("should return sessions from query", () => {
      const { result } = renderHook(() => useSessions(), { wrapper: createWrapper() });

      expect(result.current.sessions).toEqual(mockSessions);
    });

    it("should return current session based on currentSessionId", () => {
      const { result } = renderHook(() => useSessions(), { wrapper: createWrapper() });

      expect(result.current.currentSession).toEqual(mockSessions[0]);
    });

    it("should return isServerReady state", () => {
      const { result } = renderHook(() => useSessions(), { wrapper: createWrapper() });

      expect(result.current.isServerReady).toBe(true);
    });
  });

  describe("stopSession", () => {
    it("should call abort and set status to idle", async () => {
      const { result } = renderHook(() => useSessions(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.stopSession();
      });

      expect(mockSDK.session.abort).toHaveBeenCalledWith({
        sessionID: "session-1",
        directory: "/mock/cwd/1",
      });
      expect(useSessionStore.getState().sessionStatus["session-1"]).toBe("idle");
    });
  });
});
