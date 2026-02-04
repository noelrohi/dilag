import { forwardRef } from "react"
import {
  PanelGroup,
  Panel,
  PanelResizeHandle,
  type PanelGroupProps,
  type PanelProps,
  type PanelResizeHandleProps,
  type ImperativePanelHandle,
} from "react-resizable-panels"

import { cn } from "../lib/utils"

function ResizablePanelGroup({
  className,
  ...props
}: PanelGroupProps) {
  return (
    <PanelGroup
      data-slot="resizable-panel-group"
      className={cn(
        "flex h-full w-full data-[panel-group-direction=vertical]:flex-col",
        className
      )}
      {...props}
    />
  )
}

const ResizablePanel = forwardRef<ImperativePanelHandle, PanelProps>(
  ({ className, ...props }, ref) => {
    return (
      <Panel
        ref={ref}
        data-slot="resizable-panel"
        className={cn("min-w-0 min-h-0", className)}
        {...props}
      />
    )
  }
)

function ResizableHandle({
  className,
  ...props
}: PanelResizeHandleProps) {
  return (
    <PanelResizeHandle
      data-slot="resizable-handle"
      className={cn(
        "bg-border/50 hover:bg-primary/20 focus-visible:ring-ring relative flex w-px items-center justify-center cursor-col-resize transition-colors",
        "after:absolute after:inset-y-0 after:left-1/2 after:w-4 after:-translate-x-1/2",
        "focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:outline-hidden",
        className
      )}
      {...props}
    />
  )
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }
