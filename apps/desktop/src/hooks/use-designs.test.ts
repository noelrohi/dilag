import { describe, expect, it, vi, beforeEach } from "vitest"
import { act, renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createElement, type ReactNode } from "react"
import {
  isSessionDesignFileChange,
  useSessionDesigns,
  type DesignFile,
  type Violation,
} from "./use-designs"
import { useSessionStore } from "@/context/session-store"

// ---------- Fixture factory ----------

/** Build a fixture `DesignFile` with sensible defaults; override any field. */
export function makeDesignFile(overrides: Partial<DesignFile> = {}): DesignFile {
  return {
    filename: "home.html",
    title: "Home",
    screen_type: "web",
    html: "<!DOCTYPE html><html><body></body></html>",
    modified_at: 1_700_000_000,
    violations: [],
    ...overrides,
  }
}

/** Build a violation fixture. */
export function makeViolation(overrides: Partial<Violation> = {}): Violation {
  return {
    rule: "real_url",
    snippet: 'href="https://example.com',
    ...overrides,
  }
}

// ---------- Tests ----------

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return createElement(QueryClientProvider, { client }, children)
}

describe("useSessionDesigns", () => {
  const mockLoadForSession = vi.mocked(window.desktopBridge!.designs.loadForSession)

  beforeEach(() => {
    mockLoadForSession.mockReset()
    useSessionStore.setState({ recentFileChanges: [] })
  })

  it("returns DesignFile[] with empty violations when session is clean", async () => {
    const clean = makeDesignFile({ filename: "landing.html", title: "Landing" })
    mockLoadForSession.mockResolvedValue([clean])

    const { result } = renderHook(() => useSessionDesigns("/sessions/abc"), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual([clean])
    expect(result.current.data?.[0].violations).toEqual([])
    expect(mockLoadForSession).toHaveBeenCalledWith({
      sessionCwd: "/sessions/abc",
    })
  })

  it("surfaces violations returned from the backend", async () => {
    const dirty = makeDesignFile({
      filename: "bad.html",
      title: "Bad",
      violations: [
        makeViolation({ rule: "keyframes", snippet: "@keyframes fade" }),
        makeViolation({ rule: "emoji_as_icon", snippet: "🚀" }),
      ],
    })
    mockLoadForSession.mockResolvedValue([dirty])

    const { result } = renderHook(() => useSessionDesigns("/sessions/xyz"), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const design = result.current.data?.[0]
    expect(design?.violations).toHaveLength(2)
    expect(design?.violations.map((v) => v.rule)).toEqual(["keyframes", "emoji_as_icon"])
  })

  it("does not fetch when sessionCwd is undefined", () => {
    renderHook(() => useSessionDesigns(undefined), { wrapper })
    expect(mockLoadForSession).not.toHaveBeenCalled()
  })

  it("refetches when a session screen html file changes", async () => {
    const initial = makeDesignFile({ filename: "home.html", title: "Home" })
    const updated = makeDesignFile({
      filename: "home.html",
      title: "Home Updated",
      modified_at: initial.modified_at + 1,
    })
    mockLoadForSession.mockResolvedValueOnce([initial]).mockResolvedValueOnce([updated])

    const { result } = renderHook(() => useSessionDesigns("/sessions/abc"), { wrapper })
    await waitFor(() => expect(result.current.data).toEqual([initial]))

    act(() => {
      useSessionStore.setState({
        recentFileChanges: [
          {
            file: "/sessions/abc/screens/home.html",
            event: "change",
            timestamp: Date.now(),
          },
        ],
      })
    })

    await waitFor(() => expect(mockLoadForSession).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(result.current.data).toEqual([updated]))
  })

  it("does not refetch for non-design file changes in the same session", async () => {
    const initial = makeDesignFile({ filename: "home.html", title: "Home" })
    mockLoadForSession.mockResolvedValue([initial])

    const { result } = renderHook(() => useSessionDesigns("/sessions/abc"), { wrapper })
    await waitFor(() => expect(result.current.data).toEqual([initial]))

    act(() => {
      useSessionStore.setState({
        recentFileChanges: [
          {
            file: "/sessions/abc/src/app.tsx",
            event: "change",
            timestamp: Date.now(),
          },
        ],
      })
    })

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(mockLoadForSession).toHaveBeenCalledTimes(1)
  })
})

describe("isSessionDesignFileChange", () => {
  it("matches screen html files written with absolute or relative paths", () => {
    expect(isSessionDesignFileChange("/sessions/abc/screens/home.html", "/sessions/abc")).toBe(true)
    expect(isSessionDesignFileChange("screens/home.html", "/sessions/abc")).toBe(true)
  })

  it("matches root html files because the backend loader supports session-root designs", () => {
    expect(isSessionDesignFileChange("/sessions/abc/home.html", "/sessions/abc")).toBe(true)
  })

  it("ignores non-html and nested non-screen files", () => {
    expect(isSessionDesignFileChange("/sessions/abc/screens/home.png", "/sessions/abc")).toBe(false)
    expect(isSessionDesignFileChange("/sessions/abc/src/home.html", "/sessions/abc")).toBe(false)
  })
})
