import { IconDownload, IconSquarePlus as AddSquare } from "@tabler/icons-react"
import { AnimatePresence, motion } from "motion/react"
import { Button } from "@dilag/ui/button"
import { SidebarTrigger, useSidebar } from "@dilag/ui/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@dilag/ui/tooltip"
import { useUpdaterContext, type UpdaterPhase } from "@/context/updater-context"
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

// Matches --titlebar-control-size (24px) so the ring hugs the button edge.
const updateRingSize = 24
const updateRingStroke = 1.5
const updateRingRadius = (updateRingSize - updateRingStroke) / 2
const updateRingCircumference = 2 * Math.PI * updateRingRadius

export function PersistentSidebarTrigger() {
  const { state } = useSidebar()
  const { updateAvailable, updateInfo, phase, downloadProgress, installUpdate } =
    useUpdaterContext()
  const { data: projects = [] } = useProjectsList()
  const { openNewDesign } = useNewDesignFlow({ projects })
  const isCollapsed = state === "collapsed"
  const showUpdateButton = updateAvailable
  const downloading = phase === "downloading"
  const updateLabel = updateInfo ? `Dilag ${updateInfo.version}` : "the update"
  const tooltipByPhase: Record<UpdaterPhase, string> = {
    idle: `Download ${updateLabel}`,
    checking: `Download ${updateLabel}`,
    downloading: `Downloading ${updateLabel}… ${downloadProgress}%`,
    ready: `Restart and install ${updateLabel}`,
  }
  const updateTooltip = tooltipByPhase[phase]

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <SidebarTrigger
            className={cn(
              "fixed left-(--titlebar-control-left) top-(--titlebar-control-center-y) z-50 size-(--titlebar-control-size) -translate-y-1/2 rounded-md border border-transparent text-muted-foreground/75 shadow-none transition-[background-color,color,border-color] duration-150 ease-out hover:bg-accent hover:text-foreground [&>svg]:size-3.5",
              "focus-visible:ring-2 focus-visible:ring-ring/50",
              isCollapsed
                ? "bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/55"
                : "bg-sidebar/70 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground supports-[backdrop-filter]:bg-sidebar/55",
            )}
            aria-label={isCollapsed ? "Open sidebar" : "Close sidebar"}
          />
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {isCollapsed ? "Open sidebar" : "Close sidebar"}
        </TooltipContent>
      </Tooltip>
      <AnimatePresence initial={false}>
        {isCollapsed && (
          <motion.div
            key="new-design-titlebar-button"
            className="fixed left-(--titlebar-content-left) top-(--titlebar-control-center-y) z-50 size-(--titlebar-control-size) -translate-y-1/2 after:pointer-events-none after:absolute after:-right-2 after:top-1/2 after:h-3.5 after:w-px after:-translate-y-1/2 after:bg-border"
            initial={{ opacity: 0, scale: 0.86, x: -6 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.86, x: -6 }}
            transition={titlebarButtonTransition}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={titlebarIconButtonClass}
                  onClick={openNewDesign}
                  aria-label="New design"
                >
                  <AddSquare />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">New design</TooltipContent>
            </Tooltip>
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
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  titlebarIconButtonClass,
                  !isCollapsed &&
                    "bg-sidebar/70 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground supports-[backdrop-filter]:bg-sidebar/55",
                  phase === "ready" && "text-foreground",
                )}
                onClick={() => {
                  if (downloading) return
                  void installUpdate()
                }}
                aria-label={updateTooltip}
              >
                <IconDownload className={cn(downloading && "animate-pulse")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{updateTooltip}</TooltipContent>
          </Tooltip>
          <svg
            className="pointer-events-none absolute inset-0 -rotate-90"
            width={updateRingSize}
            height={updateRingSize}
            viewBox={`0 0 ${updateRingSize} ${updateRingSize}`}
          >
            <circle
              cx={updateRingSize / 2}
              cy={updateRingSize / 2}
              r={updateRingRadius}
              fill="none"
              stroke="currentColor"
              strokeWidth={updateRingStroke}
              className="text-border"
              opacity={downloading ? 1 : 0}
            />
            <circle
              cx={updateRingSize / 2}
              cy={updateRingSize / 2}
              r={updateRingRadius}
              fill="none"
              stroke="currentColor"
              strokeWidth={updateRingStroke}
              strokeLinecap="round"
              className={cn(
                "text-primary transition-[stroke-dashoffset,opacity] duration-300 ease-out",
                !downloading && "opacity-0",
              )}
              strokeDasharray={updateRingCircumference}
              strokeDashoffset={
                updateRingCircumference -
                (updateRingCircumference *
                  (downloading ? downloadProgress : phase === "ready" ? 100 : 0)) /
                  100
              }
            />
          </svg>
        </motion.div>
      )}
    </>
  )
}
