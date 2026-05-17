import { SidebarTrigger, useSidebar } from "@dilag/ui/sidebar"
import { cn } from "@/lib/utils"

export function PersistentSidebarTrigger() {
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"

  return (
    <SidebarTrigger
      className={cn(
        "fixed left-(--titlebar-control-left) top-(--titlebar-control-center-y) z-50 size-(--titlebar-control-size) -translate-y-1/2 rounded-md border border-transparent text-muted-foreground/75 shadow-none transition-[background-color,color,border-color] duration-150 ease-out hover:bg-accent hover:text-foreground [&>svg]:size-3.5",
        "focus-visible:ring-2 focus-visible:ring-ring/50",
        isCollapsed
          ? "bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/55"
          : "bg-sidebar/70 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground supports-[backdrop-filter]:bg-sidebar/55",
      )}
      aria-label="Toggle sidebar"
    />
  )
}
