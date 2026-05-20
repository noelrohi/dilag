import { IconDownload } from "@tabler/icons-react"
import { Button } from "@dilag/ui/button"
import { SidebarTrigger, useSidebar } from "@dilag/ui/sidebar"
import { useUpdaterContext } from "@/context/updater-context"
import { cn } from "@/lib/utils"

export function PersistentSidebarTrigger() {
  const { state } = useSidebar()
  const { updateAvailable, updateInfo, updateReady, installUpdate } = useUpdaterContext()
  const isCollapsed = state === "collapsed"
  const showUpdateButton = updateAvailable && updateReady

  return (
    <>
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
      {showUpdateButton && (
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "fixed top-(--titlebar-control-center-y) z-50 h-(--titlebar-control-size) -translate-y-1/2 gap-1 rounded-md border border-transparent px-2 text-[11px] font-medium shadow-none transition-[background-color,color,border-color] duration-150 ease-out [&>svg]:size-3.5",
            "focus-visible:ring-2 focus-visible:ring-ring/50",
            isCollapsed
              ? "bg-background/70 text-muted-foreground/85 backdrop-blur hover:bg-accent hover:text-foreground supports-[backdrop-filter]:bg-background/55"
              : "bg-sidebar/70 text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground supports-[backdrop-filter]:bg-sidebar/55",
          )}
          style={{
            left: "calc(var(--titlebar-control-left) + var(--titlebar-control-size) + var(--titlebar-control-gap))",
          }}
          onClick={() => void installUpdate()}
          aria-label="Restart and install update"
          title={
            updateInfo
              ? `Restart and install Dilag ${updateInfo.version}`
              : "Restart and install update"
          }
        >
          <IconDownload />
          <span>Update</span>
        </Button>
      )}
    </>
  )
}
