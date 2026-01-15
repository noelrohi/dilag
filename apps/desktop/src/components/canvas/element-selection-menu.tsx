import { memo } from "react";
import { Button } from "@dilag/ui/button";
import { Sparkles, Copy, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ElementInfo } from "@/context/element-selection-store";
import { toast } from "sonner";

interface ElementSelectionMenuProps {
  /** The selected element info */
  element: ElementInfo;
  /** Scale factor of the iframe */
  scale: number;
  /** Offset from the container */
  offset?: { x: number; y: number };
  /** Callback when "Edit with AI" is clicked */
  onEditWithAI: () => void;
  /** Callback to close/deselect */
  onClose: () => void;
}

/**
 * Floating menu that appears when an element is selected.
 * Positioned above the selected element.
 */
function ElementSelectionMenuComponent({
  element,
  scale,
  offset = { x: 0, y: 0 },
  onEditWithAI,
  onClose,
}: ElementSelectionMenuProps) {
  // Calculate position (above the element)
  const scaledRect = {
    x: element.rect.x * scale + offset.x,
    y: element.rect.y * scale + offset.y,
    width: element.rect.width * scale,
    height: element.rect.height * scale,
  };

  // Position menu above the element, centered horizontally
  const menuStyle = {
    left: scaledRect.x + scaledRect.width / 2,
    top: scaledRect.y - 8, // 8px gap above element
  };

  const handleCopySelector = () => {
    navigator.clipboard.writeText(element.selector);
    toast.success("Selector copied to clipboard");
  };

  return (
    <div
      className={cn(
        "absolute z-30 flex items-center gap-1 p-1",
        "bg-popover/95 backdrop-blur-sm rounded-lg shadow-lg",
        "border border-border",
        "transform -translate-x-1/2 -translate-y-full",
        "animate-in fade-in-0 zoom-in-95 duration-150"
      )}
      style={menuStyle}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Edit with AI - primary action */}
      <Button
        size="sm"
        variant="default"
        className="h-7 px-2.5 gap-1.5 text-xs font-medium"
        onClick={onEditWithAI}
      >
        <Sparkles className="size-3.5" />
        Edit with AI
      </Button>

      {/* Divider */}
      <div className="w-px h-5 bg-border" />

      {/* Copy selector */}
      <Button
        size="sm"
        variant="ghost"
        className="h-7 w-7 p-0"
        onClick={handleCopySelector}
        title="Copy CSS selector"
      >
        <Copy className="size-3.5" />
      </Button>

      {/* Close */}
      <Button
        size="sm"
        variant="ghost"
        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
        onClick={onClose}
        title="Deselect (Esc)"
      >
        <X className="size-3.5" />
      </Button>
    </div>
  );
}

export const ElementSelectionMenu = memo(ElementSelectionMenuComponent);
