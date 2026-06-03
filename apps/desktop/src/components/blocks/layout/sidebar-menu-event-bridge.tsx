import { useEffect } from "react"
import { useSidebar } from "@dilag/ui/sidebar"
import { useMenuEvents } from "@/context/menu-events"

/**
 * Connects native application-menu sidebar commands to the active SidebarProvider.
 *
 * Desktop disables the shared SidebarProvider keyboard listener so the native
 * menu owns both Cmd+B and explicit View > Toggle Sidebar clicks.
 */
export function SidebarMenuEventBridge() {
  const { toggleSidebar } = useSidebar()
  const { registerSidebarToggle } = useMenuEvents()

  useEffect(() => registerSidebarToggle(toggleSidebar), [registerSidebarToggle, toggleSidebar])

  return null
}
