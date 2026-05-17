import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SidebarProvider } from "@dilag/ui/sidebar"
import type { ProjectMeta } from "@dilag/desktop-bridge"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { AppSidebar } from "./app-sidebar"

const mockNavigate = vi.hoisted(() => vi.fn())
const mockCreateSessionInProject = vi.hoisted(() => vi.fn())
const mockOpenNewDesign = vi.hoisted(() => vi.fn())
const mockOpenProjectComposer = vi.hoisted(() => vi.fn())

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  useLocation: () => ({ pathname: "/" }),
  useNavigate: () => mockNavigate,
}))

vi.mock("@/hooks/use-sessions", () => ({
  useSessions: () => ({
    sessions: [],
    createSessionInProject: mockCreateSessionInProject,
    renameSession: vi.fn(),
    deleteSession: vi.fn(),
  }),
}))

vi.mock("@/features/new-design/use-new-design-flow", () => ({
  useNewDesignFlow: () => ({
    openNewDesign: mockOpenNewDesign,
    openProjectComposer: mockOpenProjectComposer,
  }),
}))

function project(overrides: Partial<ProjectMeta> = {}): ProjectMeta {
  return {
    id: "project-1",
    name: "Untitled project",
    path: "/projects/untitled-project",
    platform: "web",
    pinned: false,
    expanded: true,
    created_at: "2026-05-17T00:00:00.000Z",
    last_opened_at: "2026-05-17T00:00:00.000Z",
    ...overrides,
  }
}

function renderSidebar() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <SidebarProvider>
        <AppSidebar />
      </SidebarProvider>
    </QueryClientProvider>,
  )
}

describe("AppSidebar", () => {
  const mockListProjects = vi.mocked(window.desktopBridge!.projects.list)
  const mockUpdateProject = vi.mocked(window.desktopBridge!.projects.update)

  beforeEach(() => {
    vi.clearAllMocks()
    global.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    mockListProjects.mockResolvedValue([project()])
    mockUpdateProject.mockImplementation(async ({ id, updates }) =>
      project({ id, ...updates, name: updates.name ?? "Untitled project" }),
    )
  })

  it("renames a project from the project actions menu", async () => {
    const user = userEvent.setup()
    renderSidebar()

    await user.click(await screen.findByRole("button", { name: "Untitled project actions" }))
    await user.click(await screen.findByRole("menuitem", { name: /rename project/i }))

    const dialog = await screen.findByRole("dialog", { name: /rename project/i })
    const input = screen.getByRole("textbox")
    expect(dialog).toBeInTheDocument()
    expect(input).toHaveValue("Untitled project")

    await user.clear(input)
    await user.type(input, "Client portal")
    await user.click(screen.getByRole("button", { name: "Rename" }))

    await waitFor(() => {
      expect(mockUpdateProject).toHaveBeenCalledWith({
        id: "project-1",
        updates: { name: "Client portal" },
      })
    })
    expect(await screen.findByText("Client portal")).toBeInTheDocument()
  })

  it("opens the project composer when creating a new chat from a project", async () => {
    const user = userEvent.setup()
    renderSidebar()

    await user.click(await screen.findByRole("button", { name: "Create new chat" }))

    expect(mockOpenProjectComposer).toHaveBeenCalledWith("project-1")
    expect(mockCreateSessionInProject).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalledWith(
      expect.objectContaining({ to: "/studio/$sessionId" }),
    )
  })
})
