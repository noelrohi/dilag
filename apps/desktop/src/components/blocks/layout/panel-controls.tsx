import { Button } from "@dilag/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@dilag/ui/tooltip"
import { cn } from "@/lib/utils"
import {
  IconArrowsDiagonal as ArrowsExpand,
  IconArrowsDiagonalMinimize2 as ArrowsCollapse,
  IconLayoutSidebarRight as SidebarRight,
} from "@tabler/icons-react"

interface PanelControlsProps {
  chatCollapsed?: boolean
  canvasOpen?: boolean
  onToggleExpandCanvas?: () => void
  onToggleCanvas?: () => void
}

/* Panel controls - pinned to the app's top-right corner */
export function PanelControls({
  chatCollapsed = false,
  canvasOpen = false,
  onToggleExpandCanvas,
  onToggleCanvas,
}: PanelControlsProps) {
  return (
    <div className="absolute top-0 right-3 z-40 flex h-[44px] items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn(
              "size-7 text-muted-foreground hover:text-foreground",
              chatCollapsed && "bg-muted text-foreground",
            )}
            onClick={onToggleExpandCanvas}
            aria-label={chatCollapsed ? "Restore chat" : "Expand canvas"}
            aria-pressed={chatCollapsed}
          >
            {chatCollapsed ? <ArrowsCollapse size={14} /> : <ArrowsExpand size={14} />}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {chatCollapsed ? "Restore chat" : "Expand canvas"}
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn(
              "size-7 text-muted-foreground hover:text-foreground",
              canvasOpen && "bg-muted text-foreground",
            )}
            onClick={onToggleCanvas}
            aria-label={canvasOpen ? "Hide canvas" : "Show canvas"}
            aria-pressed={canvasOpen}
          >
            <SidebarRight size={14} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{canvasOpen ? "Hide canvas" : "Show canvas"}</TooltipContent>
      </Tooltip>
    </div>
  )
}
