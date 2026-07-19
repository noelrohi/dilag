import { memo, useState } from "react"
import { Button } from "@dilag/ui/button"
import { IconCopy as Copy, IconX as X, IconArrowUp as ArrowUp } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import type { ElementInfo } from "@/context/element-selection-store"
import { toast } from "sonner"

interface ElementSelectionMenuProps {
  /** The selected element info */
  element: ElementInfo
  /** Scale factor of the iframe */
  scale: number
  /** Offset from the container */
  offset?: { x: number; y: number }
  /**
   * Edit the element with AI. With a prompt, the edit is sent to the agent
   * immediately; without one, the element is attached to the composer.
   */
  onEditWithAI: (prompt?: string) => void
  /** Callback to close/deselect */
  onClose: () => void
}

/**
 * Inline prompt that appears when an element is selected: describe the change
 * right where you clicked and it's sent straight to the agent.
 */
function ElementSelectionMenuComponent({
  element,
  scale,
  offset = { x: 0, y: 0 },
  onEditWithAI,
  onClose,
}: ElementSelectionMenuProps) {
  const [prompt, setPrompt] = useState("")

  const scaledRect = {
    x: element.rect.x * scale + offset.x,
    y: element.rect.y * scale + offset.y,
    width: element.rect.width * scale,
    height: element.rect.height * scale,
  }

  // Below the element, centered horizontally
  const menuStyle = {
    left: scaledRect.x + scaledRect.width / 2,
    top: scaledRect.y + scaledRect.height + 8,
  }

  const handleCopySelector = () => {
    navigator.clipboard.writeText(element.selector)
    toast.success("Selector copied to clipboard")
  }

  const handleSubmit = () => {
    const trimmed = prompt.trim()
    onEditWithAI(trimmed || undefined)
    // A typed prompt is on its way to the agent — the selection has served
    // its purpose. An empty submit attaches to the composer instead, where
    // the selection chip provides the context, so close in both cases.
    onClose()
  }

  return (
    <div
      className={cn(
        "nodrag absolute z-30 w-[236px] p-1.5",
        "bg-popover/95 backdrop-blur-sm rounded-xl shadow-lg",
        "border border-border",
        "transform -translate-x-1/2",
        "animate-in fade-in-0 zoom-in-95 duration-150",
      )}
      style={menuStyle}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <div className="mb-1 flex items-center gap-1.5 px-0.5">
        <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-primary">
          {`<${element.tagName}>`}
        </span>
        <span className="text-[10px] tabular-nums text-muted-foreground">
          {Math.round(element.rect.width)}×{Math.round(element.rect.height)}
        </span>
        <div className="ml-auto flex items-center">
          <button
            type="button"
            className="rounded p-0.5 text-muted-foreground hover:text-foreground"
            onClick={handleCopySelector}
            title="Copy CSS selector"
            aria-label="Copy CSS selector"
          >
            <Copy size={12} />
          </button>
          <button
            type="button"
            className="rounded p-0.5 text-muted-foreground hover:text-foreground"
            onClick={onClose}
            title="Close"
            aria-label="Close element menu"
          >
            <X size={12} />
          </button>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <input
          autoFocus
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={`Change this ${element.tagName}…`}
          className="h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === "Enter") handleSubmit()
            if (e.key === "Escape") onClose()
          }}
        />
        <Button
          size="sm"
          className="h-7 w-7 shrink-0 p-0"
          onClick={handleSubmit}
          title={prompt.trim() ? "Send edit to agent" : "Add element to chat"}
          aria-label={prompt.trim() ? "Send edit to agent" : "Add element to chat"}
        >
          <ArrowUp size={13} />
        </Button>
      </div>
    </div>
  )
}

export const ElementSelectionMenu = memo(ElementSelectionMenuComponent)
