import { memo } from "react";
import { cn } from "@/lib/utils";
import type { ElementInfo } from "@/context/element-selection-store";

interface ElementHighlightProps {
  /** The element to highlight */
  element: ElementInfo;
  /** Whether this is the selected (not just hovered) element */
  isSelected?: boolean;
  /** Scale factor of the iframe (e.g., 0.663 for mobile) */
  scale: number;
  /** Offset from the iframe container's top-left */
  offset?: { x: number; y: number };
}

/**
 * Renders a highlight overlay for a hovered or selected element.
 * Positioned absolutely within the screen node container.
 */
function ElementHighlightComponent({
  element,
  isSelected = false,
  scale,
  offset = { x: 0, y: 0 },
}: ElementHighlightProps) {
  // Scale the rect coordinates to match the scaled iframe
  const scaledRect = {
    x: element.rect.x * scale + offset.x,
    y: element.rect.y * scale + offset.y,
    width: element.rect.width * scale,
    height: element.rect.height * scale,
  };

  // Format tag name for badge
  const tagDisplay = element.tagName.toLowerCase();

  return (
    <div
      className={cn(
        "absolute pointer-events-none z-20 transition-all duration-100",
        isSelected
          ? "border-2 border-primary bg-primary/5"
          : "border-2 border-dashed border-primary/70 bg-primary/5"
      )}
      style={{
        left: scaledRect.x,
        top: scaledRect.y,
        width: scaledRect.width,
        height: scaledRect.height,
      }}
    >
      {/* Tag name badge */}
      <div
        className={cn(
          "absolute -top-5 left-0 px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap",
          isSelected
            ? "bg-primary text-primary-foreground"
            : "bg-primary/80 text-primary-foreground"
        )}
      >
        {tagDisplay}
      </div>

      {/* Selection indicator dots (only when selected) */}
      {isSelected && (
        <>
          {/* Corner handles */}
          <div className="absolute -top-1 -left-1 w-2 h-2 bg-primary rounded-full" />
          <div className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full" />
          <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-primary rounded-full" />
          <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-primary rounded-full" />
        </>
      )}
    </div>
  );
}

export const ElementHighlight = memo(ElementHighlightComponent);
