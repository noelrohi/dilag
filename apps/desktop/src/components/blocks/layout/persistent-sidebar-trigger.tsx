import { IconDownload, IconSquarePlus as AddSquare } from "@tabler/icons-react"
import { AnimatePresence, motion } from "motion/react"
import { Button } from "@dilag/ui/button"
import { SidebarTrigger, useSidebar } from "@dilag/ui/sidebar"
import { useUpdaterContext } from "@/context/updater-context"
import { useNewDesignFlow } from "@/features/new-design/use-new-design-flow"
import { useProjectsList } from "@/hooks/use-projects"
import { cn } from "@/lib/utils"

const titlebarButtonTransition = {
  type: "spring" as const,
  stiffness: 520,
  damping: 42,
  mass: 0.8,
}

const titlebarIconButtonClass =
  "size-full rounded-md border border-transparent bg-transparent p-0 text-muted-foreground shadow-none transition-[background-color,color,border-color] duration-150 ease-out hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 [&>svg]:size-3.5"

export function PersistentSidebarTrigger() {
  const { state } = useSidebar()
  const { updateAvailable, updateInfo, updateReady, installUpdate } = useUpdaterContext()
  const { data: projects = [] } = useProjectsList()
  const { openNewDesign } = useNewDesignFlow({ projects })
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
      <AnimatePresence initial={false}>
        {isCollapsed && (
          <motion.div
            key="new-design-titlebar-button"
            className="fixed left-(--titlebar-content-left) top-(--titlebar-control-center-y) z-50 size-(--titlebar-control-size) -translate-y-1/2"
            initial={{ opacity: 0, scale: 0.86, x: -6 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.86, x: -6 }}
            transition={titlebarButtonTransition}
          >
            <Button
              variant="ghost"
              size="icon"
              className={titlebarIconButtonClass}
              onClick={openNewDesign}
              aria-label="New design"
              title="New design"
            >
              <AddSquare />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
      {showUpdateButton && (
        <motion.div
          className="fixed top-(--titlebar-control-center-y) z-50 size-(--titlebar-control-size) -translate-y-1/2"
          initial={false}
          animate={{
            left: isCollapsed
              ? "calc(var(--titlebar-content-left) + var(--titlebar-control-size) + 4px)"
              : "calc(var(--titlebar-control-left) + var(--titlebar-control-size) + 4px)",
          }}
          transition={titlebarButtonTransition}
        >
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              titlebarIconButtonClass,
              !isCollapsed &&
                "bg-sidebar/70 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground supports-[backdrop-filter]:bg-sidebar/55",
            )}
            onClick={() => void installUpdate()}
            aria-label="Restart and install update"
            title={
              updateInfo
                ? `Restart and install Dilag ${updateInfo.version}`
                : "Restart and install update"
            }
          >
            <IconDownload />
          </Button>
        </motion.div>
      )}
    </>
  )
}
