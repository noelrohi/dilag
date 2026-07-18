import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { SessionMeta } from "@/context/session-store"
import { afterEach, describe, expect, it, vi } from "vitest"
import { RecentSessions } from "./recent-sessions"

const mockNavigate = vi.hoisted(() => vi.fn())

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}))

function session(overrides: Partial<SessionMeta> = {}): SessionMeta {
  return {
    id: "session-1",
    name: "Session 1",
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    cwd: "/projects/main",
    projectId: "project-1",
    ...overrides,
  }
}

function renderRecentSessions({ sessions }: { sessions: SessionMeta[] }) {
  render(<RecentSessions sessions={sessions} projectId="project-1" />)
}

describe("RecentSessions", () => {
  afterEach(() => {
    vi.useRealTimers()
    mockNavigate.mockReset()
  })

  it("renders the 4 most recently updated sessions for the project, newest first", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-08T12:00:00.000Z"))

    renderRecentSessions({
      sessions: [
        session({ id: "s1", name: "Excluded fifth", updated_at: "2026-07-08T07:00:00.000Z" }),
        session({ id: "s2", name: "Second", updated_at: "2026-07-08T11:00:00.000Z" }),
        session({ id: "s3", name: "Newest", updated_at: "2026-07-08T11:30:00.000Z" }),
        session({ id: "s4", name: "Fourth", updated_at: "2026-07-08T09:00:00.000Z" }),
        session({ id: "s5", name: "Third", updated_at: "2026-07-08T10:00:00.000Z" }),
        session({ id: "s6", name: "Excluded sixth", updated_at: "2026-07-08T06:00:00.000Z" }),
      ],
    })

    expect(screen.getByRole("region", { name: "Recent chats" })).toBeInTheDocument()
    expect(screen.queryByText("Excluded fifth")).not.toBeInTheDocument()
    expect(screen.queryByText("Excluded sixth")).not.toBeInTheDocument()
    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Newest30m ago",
      "Second1h ago",
      "Third2h ago",
      "Fourth3h ago",
    ])
  })

  it("excludes sessions from another project", () => {
    renderRecentSessions({
      sessions: [
        session({ id: "s1", name: "Current project", projectId: "project-1" }),
        session({
          id: "s2",
          name: "Other project",
          cwd: "/projects/other",
          projectId: "project-2",
        }),
      ],
    })

    expect(screen.getByText("Current project")).toBeInTheDocument()
    expect(screen.queryByText("Other project")).not.toBeInTheDocument()
  })

  it("renders nothing when there are no recent sessions", () => {
    const { container } = render(<RecentSessions sessions={[]} projectId="project-1" />)

    expect(container).toBeEmptyDOMElement()
  })

  it("navigates to a session when clicked", async () => {
    const user = userEvent.setup()
    renderRecentSessions({
      sessions: [session({ id: "session-2", name: "Homepage polish" })],
    })

    await user.click(screen.getByRole("button", { name: /homepage polish/i }))

    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/project/$projectId/session/$sessionId",
      params: { projectId: "project-1", sessionId: "session-2" },
    })
  })
})
