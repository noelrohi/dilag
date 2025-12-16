import { useDraggable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { useCanvasContext } from "./design-canvas";

interface DraggableScreenProps {
  id: string;
  x: number;
  y: number;
  children: React.ReactNode;
  className?: string;
}

export function DraggableScreen({
  id,
  x,
  y,
  children,
  className,
}: DraggableScreenProps) {
  const { zoom } = useCanvasContext();
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id,
    });

  // Scale the transform by inverse of zoom so the element follows the cursor correctly
  const adjustedTransform = transform
    ? {
        x: transform.x / zoom,
        y: transform.y / zoom,
      }
    : null;

  const style: React.CSSProperties = {
    position: "absolute",
    left: x,
    top: y,
    transform: adjustedTransform
      ? `translate(${adjustedTransform.x}px, ${adjustedTransform.y}px)`
      : undefined,
    zIndex: isDragging ? 1000 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "touch-none select-none",
        isDragging ? "cursor-grabbing" : "cursor-grab",
        className
      )}
      {...listeners}
      {...attributes}
    >
      {children}
    </div>
  );
}
