import { act, render, screen } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { SidebarProvider, useSidebar } from "@dilag/ui/sidebar"
import { SidebarMenuEventBridge } from "./sidebar-menu-event-bridge"

const menuEventsMock = vi.hoisted(() => ({
  registerSidebarToggle: vi.fn(),
}))

vi.mock("@/context/menu-events", () => ({
  useMenuEvents: () => ({
    toggleSidebar: vi.fn(),
    toggleChat: vi.fn(),
    registerChatToggle: vi.fn(),
    registerSidebarToggle: menuEventsMock.registerSidebarToggle,
  }),
}))

function SidebarStateProbe() {
  const { state } = useSidebar()
  return <div data-testid="sidebar-state">{state}</div>
}

describe("SidebarMenuEventBridge", () => {
  let registeredToggle: (() => void) | null

  beforeEach(() => {
    registeredToggle = null
    menuEventsMock.registerSidebarToggle.mockReset()
    menuEventsMock.registerSidebarToggle.mockImplementation((callback: () => void) => {
      registeredToggle = callback
      return () => {
        if (registeredToggle === callback) {
          registeredToggle = null
        }
      }
    })
  })

  it("registers the active sidebar toggle for native menu events", () => {
    render(
      <SidebarProvider>
        <SidebarMenuEventBridge />
        <SidebarStateProbe />
      </SidebarProvider>,
    )

    expect(screen.getByTestId("sidebar-state")).toHaveTextContent("expanded")
    expect(menuEventsMock.registerSidebarToggle).toHaveBeenCalled()
    expect(registeredToggle).toBeTypeOf("function")

    act(() => registeredToggle?.())
    expect(screen.getByTestId("sidebar-state")).toHaveTextContent("collapsed")

    act(() => registeredToggle?.())
    expect(screen.getByTestId("sidebar-state")).toHaveTextContent("expanded")
  })
})
