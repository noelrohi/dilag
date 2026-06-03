import { createContext, useContext, useEffect, useCallback, useRef, type ReactNode } from "react"
import { useLocation, useNavigate } from "@tanstack/react-router"
import { toast } from "sonner"
import type { NativeMenuContext } from "@dilag/desktop-bridge"
import { useUpdaterContext } from "@/context/updater-context"
import { useNewDesignFlow } from "@/features/new-design/use-new-design-flow"
import { useProjectsList } from "@/hooks/use-projects"
import { bridge } from "@/lib/bridge"

interface MenuEventHandler {
  toggleSidebar: () => void
  toggleChat: () => void
  registerChatToggle: (callback: () => void) => () => void
  registerSidebarToggle: (callback: () => void) => () => void
}

const MenuEventsContext = createContext<MenuEventHandler | null>(null)

function getNativeMenuContext(pathname: string): NativeMenuContext {
  if (/^\/studio\/[^/]+\/?$/.test(pathname)) return "session"
  if (/^\/project\/[^/]+\/session\/[^/]+\/?$/.test(pathname)) return "session"
  return "default"
}

// Custom hook to expose menu event handlers for components that need to respond to menu events
export function useMenuEvents() {
  const context = useContext(MenuEventsContext)
  if (!context) {
    throw new Error("useMenuEvents must be used within a MenuEventsProvider")
  }
  return context
}

export function MenuEventsProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { checkForUpdates } = useUpdaterContext()
  const { data: projects = [] } = useProjectsList()
  const { openNewDesign } = useNewDesignFlow({ projects })

  // Store callbacks in refs inside the provider (not module-level globals)
  const chatToggleRef = useRef<(() => void) | null>(null)
  const sidebarToggleRef = useRef<(() => void) | null>(null)

  const toggleSidebar = useCallback(() => {
    sidebarToggleRef.current?.()
  }, [])

  const toggleChat = useCallback(() => {
    chatToggleRef.current?.()
  }, [])

  const checkForUpdatesFromMenu = useCallback(async () => {
    const toastId = toast.loading("Checking for updates…")
    const result = await checkForUpdates(false)

    if (result.status === "available") {
      toast.success(`Dilag ${result.updateInfo.version} is available`, { id: toastId })
      return
    }

    if (result.status === "up-to-date") {
      toast.success("Dilag is up to date", { id: toastId })
      return
    }

    toast.error(result.error, { id: toastId })
  }, [checkForUpdates])

  // Registration functions return cleanup functions
  const registerChatToggle = useCallback((callback: () => void): (() => void) => {
    chatToggleRef.current = callback
    return () => {
      if (chatToggleRef.current === callback) {
        chatToggleRef.current = null
      }
    }
  }, [])

  const registerSidebarToggle = useCallback((callback: () => void): (() => void) => {
    sidebarToggleRef.current = callback
    return () => {
      if (sidebarToggleRef.current === callback) {
        sidebarToggleRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const context = getNativeMenuContext(location.pathname)
    void bridge.menu
      .setState({ context, rendererReady: true })
      .catch((error) => console.error("Failed to update native menu state:", error))
  }, [location.pathname])

  useEffect(() => {
    const unsubscribe = bridge.menu.onEvent((eventId) => {
      switch (eventId) {
        case "settings":
          navigate({ to: "/settings" })
          break
        case "new-design":
        case "new-session":
          openNewDesign()
          break
        case "toggle-sidebar":
          toggleSidebar()
          break
        case "toggle-chat":
          toggleChat()
          break
        case "check-updates":
          void checkForUpdatesFromMenu()
          break
        default:
          console.log("Unknown menu event:", eventId)
      }
    })

    return unsubscribe
  }, [navigate, openNewDesign, toggleSidebar, toggleChat, checkForUpdatesFromMenu])

  const value: MenuEventHandler = {
    toggleSidebar,
    toggleChat,
    registerChatToggle,
    registerSidebarToggle,
  }

  return <MenuEventsContext.Provider value={value}>{children}</MenuEventsContext.Provider>
}
