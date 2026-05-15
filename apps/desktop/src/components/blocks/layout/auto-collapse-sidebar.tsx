import { useEffect, useRef } from "react"
import { useLocation } from "@tanstack/react-router"
import { useSidebar } from "@dilag/ui/sidebar"
import { useProjectsList } from "@/hooks/use-projects"

export function AutoCollapseSidebar() {
  const location = useLocation()
  const { open, setOpen, isMobile } = useSidebar()
  const { data: projects = [], isLoading } = useProjectsList()
  const didAutoCollapseRef = useRef(false)

  useEffect(() => {
    if (didAutoCollapseRef.current || isMobile || isLoading) return
    if (location.pathname !== "/" || projects.length > 0 || !open) return

    setOpen(false)
    didAutoCollapseRef.current = true
  }, [isMobile, isLoading, location.pathname, open, projects.length, setOpen])

  return null
}
