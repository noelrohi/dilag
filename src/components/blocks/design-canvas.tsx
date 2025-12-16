import {
  DndContext,
  DragEndEvent,
  DragMoveEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useCallback, useRef, useState, useEffect, createContext, useContext } from "react";
import { cn } from "@/lib/utils";

// Grid configuration for visual display
const GRID_SIZE = 20;

export interface ScreenPosition {
  id: string;
  x: number;
  y: number;
}

// Context to share zoom level with draggable children
const CanvasContext = createContext<{ zoom: number }>({ zoom: 1 });
export const useCanvasContext = () => useContext(CanvasContext);

interface DesignCanvasProps {
  children: React.ReactNode;
  screenPositions: ScreenPosition[];
  onPositionsChange: (positions: ScreenPosition[]) => void;
  onReset?: () => void;
  className?: string;
}

export function DesignCanvas({
  children,
  screenPositions,
  onPositionsChange,
  onReset,
  className,
}: DesignCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [viewOffset, setViewOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(0.75);
  const [, setActiveId] = useState<string | null>(null);
  const [, setDragOffset] = useState({ x: 0, y: 0 });

  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: {
      distance: 8,
    },
  });

  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      delay: 200,
      tolerance: 8,
    },
  });

  const sensors = useSensors(mouseSensor, touchSensor);

  const handleDragStart = useCallback((event: { active: { id: string | number } }) => {
    setActiveId(event.active.id as string);
    setDragOffset({ x: 0, y: 0 });
  }, []);

  const handleDragMove = useCallback(
    (event: DragMoveEvent) => {
      const { delta } = event;
      // Scale the delta by inverse of zoom so the element follows the cursor
      setDragOffset({
        x: delta.x / zoom,
        y: delta.y / zoom,
      });
    },
    [zoom]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, delta } = event;
      const id = active.id as string;

      setActiveId(null);
      setDragOffset({ x: 0, y: 0 });

      if (delta.x === 0 && delta.y === 0) return;

      const currentPos = screenPositions.find((p) => p.id === id);
      if (!currentPos) return;

      // Calculate new position considering zoom
      const scaledDeltaX = delta.x / zoom;
      const scaledDeltaY = delta.y / zoom;

      const newX = currentPos.x + scaledDeltaX;
      const newY = currentPos.y + scaledDeltaY;

      onPositionsChange(
        screenPositions.map((p) =>
          p.id === id ? { ...p, x: newX, y: newY } : p
        )
      );
    },
    [screenPositions, onPositionsChange, zoom]
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setDragOffset({ x: 0, y: 0 });
  }, []);

  // Pan handling
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only pan if clicking on canvas background (has data-canvas attribute)
      const target = e.target as HTMLElement;
      if (!target.hasAttribute("data-canvas")) return;

      // Pan with left click (default), middle mouse
      if (e.button === 0 || e.button === 1) {
        e.preventDefault();
        setIsPanning(true);
        setPanStart({ x: e.clientX - viewOffset.x, y: e.clientY - viewOffset.y });
      }
    },
    [viewOffset]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        setViewOffset({
          x: e.clientX - panStart.x,
          y: e.clientY - panStart.y,
        });
      }
    },
    [isPanning, panStart]
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Zoom handling
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom((prev) => Math.min(Math.max(prev + delta, 0.25), 2));
    } else {
      // Pan with scroll
      setViewOffset((prev) => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY,
      }));
    }
  }, []);

  // Reset view and positions
  const handleResetView = useCallback(() => {
    setViewOffset({ x: 0, y: 0 });
    setZoom(0.75);
    onReset?.();
  }, [onReset]);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + 0.1, 2));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev - 0.1, 0.25));
  }, []);

  // Prevent default wheel behavior for zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const preventZoom = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    };

    container.addEventListener("wheel", preventZoom, { passive: false });
    return () => container.removeEventListener("wheel", preventZoom);
  }, []);

  return (
    <div className={cn("relative w-full h-full overflow-hidden", className)}>
      <CanvasContext.Provider value={{ zoom }}>
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div
            ref={containerRef}
            className="w-full h-full"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
          >
            {/* Grid background - this is the pannable area */}
            <div
              data-canvas
              className={cn(
                "absolute inset-0",
                isPanning ? "cursor-grabbing" : "cursor-grab"
              )}
              style={{
                backgroundImage: `
                  radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)
                `,
                backgroundSize: `${GRID_SIZE * zoom}px ${GRID_SIZE * zoom}px`,
                backgroundPosition: `${viewOffset.x}px ${viewOffset.y}px`,
              }}
            />

            {/* Canvas content */}
            <div
              className="absolute pointer-events-none"
              style={{
                transform: `translate(${viewOffset.x}px, ${viewOffset.y}px) scale(${zoom})`,
                transformOrigin: "0 0",
              }}
            >
              <div className="pointer-events-auto">
                {children}
              </div>
            </div>
          </div>

        </DndContext>
      </CanvasContext.Provider>

      {/* Canvas Controls */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-2 rounded-full bg-popover/90 backdrop-blur-sm border border-border shadow-xl">
        <button
          onClick={handleResetView}
          className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
          title="Reset view"
        >
          <svg
            className="w-4 h-4 text-foreground"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
          </svg>
        </button>
        <button
          onClick={handleResetView}
          className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
          title="Fit to screen"
        >
          <svg
            className="w-4 h-4 text-foreground"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
        <div className="w-px h-5 bg-border mx-1" />
        <button
          onClick={handleZoomOut}
          className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-foreground text-xs font-medium"
        >
          -
        </button>
        <span className="text-foreground text-xs font-medium px-2 min-w-[3rem] text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={handleZoomIn}
          className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-foreground text-xs font-medium"
        >
          +
        </button>
      </div>

      {/* Pan hint */}
      <div className="absolute bottom-6 right-6 text-xs text-muted-foreground bg-popover/90 backdrop-blur-sm px-2 py-1 rounded border border-border">
        Drag to pan | Scroll to pan | Ctrl+scroll to zoom
      </div>
    </div>
  );
}
