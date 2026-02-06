import { useCallback, useMemo, useEffect, useRef } from "react";
import {
  ReactFlow,
  useNodesState,
  useReactFlow,
  ReactFlowProvider,
  type Node,
  type NodeChange,
  type OnSelectionChangeParams,
  type NodeMouseHandler,
  applyNodeChanges,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { ScreenNode, type ScreenNodeData } from "./screen-node";
import { GhostScreenNode } from "./ghost-screen-node";
import { CanvasControls } from "./canvas-controls";
import type { DesignFile } from "@/hooks/use-designs";
import type { ElementInfo } from "@/context/element-selection-store";
import { cn } from "@/lib/utils";

// Register custom node types
const nodeTypes = {
  screen: ScreenNode,
  "ghost-screen": GhostScreenNode,
};

export interface ScreenPosition {
  id: string;
  x: number;
  y: number;
}

// Layout constants for ghost node positioning (must match studio route)
const MOBILE_WIDTH = 280;
const MOBILE_HEIGHT = 584;
const WEB_WIDTH = 640;
const WEB_HEIGHT = 400;
const GAP = 60;
const MOBILE_COLUMNS = 4;
const WEB_COLUMNS = 2;

interface DesignCanvasProps {
  designs: DesignFile[];
  platform: "mobile" | "web";
  positions: ScreenPosition[];
  sessionCwd?: string;
  selectedIds?: Set<string>;
  isLoading?: boolean;
  onPositionsChange: (positions: ScreenPosition[]) => void;
  onSelectionChange?: (ids: Set<string>) => void;
  onDeleteScreen?: (filename: string) => void;
  onCaptureScreen?: (design: DesignFile) => void;
  /** Callback when user wants to edit a specific element with AI */
  onEditElementWithAI?: (design: DesignFile, element: ElementInfo) => void;
  className?: string;
}

function DesignCanvasInner({
  designs,
  platform,
  positions,
  sessionCwd,
  selectedIds,
  isLoading,
  onPositionsChange,
  onSelectionChange,
  onDeleteScreen,
  onCaptureScreen,
  onEditElementWithAI,
  className,
}: DesignCanvasProps) {
  const { getNodes } = useReactFlow();

  // Convert ScreenPosition[] to React Flow nodes
  const initialNodes = useMemo((): Node[] => {
    const screenNodes = positions
      .map((pos) => {
        const design = designs.find((d) => d.filename === pos.id);
        if (!design) return null;

        return {
          id: pos.id,
          type: "screen",
          position: { x: pos.x, y: pos.y },
          selected: selectedIds?.has(pos.id) ?? false,
          data: {
            design,
            platform,
            sessionCwd,
            onDelete: onDeleteScreen
              ? () => onDeleteScreen(pos.id)
              : undefined,
            onAddToComposer: onCaptureScreen
              ? () => onCaptureScreen(design)
              : undefined,
            onEditElementWithAI: onEditElementWithAI
              ? (element: ElementInfo) => onEditElementWithAI(design, element)
              : undefined,
          } as ScreenNodeData,
        } as Node;
      })
      .filter((n): n is Node => n !== null);

    // Add a ghost placeholder node when the AI is actively generating
    if (isLoading) {
      const isMobile = platform === "mobile";
      const width = isMobile ? MOBILE_WIDTH : WEB_WIDTH;
      const height = isMobile ? MOBILE_HEIGHT : WEB_HEIGHT;
      const columns = isMobile ? MOBILE_COLUMNS : WEB_COLUMNS;

      const count = screenNodes.length;
      const col = count % columns;
      const row = Math.floor(count / columns);

      // Find the start position from existing nodes, or use defaults
      const startX = screenNodes.length > 0
        ? Math.min(...screenNodes.map((n) => n.position.x))
        : 100;
      const startY = screenNodes.length > 0
        ? Math.min(...screenNodes.map((n) => n.position.y))
        : 40;

      screenNodes.push({
        id: "__ghost__",
        type: "ghost-screen",
        position: {
          x: startX + col * (width + GAP),
          y: startY + row * (height + GAP),
        },
        selectable: false,
        draggable: false,
        data: { platform },
      });
    }

    return screenNodes;
  }, [positions, designs, platform, sessionCwd, selectedIds, isLoading, onDeleteScreen, onCaptureScreen, onEditElementWithAI]);

  const [nodes, setNodes] = useNodesState(initialNodes);

  // Track external sync to prevent feedback loops.
  // When syncing from external state (props), we skip position updates
  // in handleNodesChange to avoid: setNodes → onNodesChange → onPositionsChange → re-render → loop
  const isExternalSyncRef = useRef(false);
  const prevNodeKeyRef = useRef<string>('');

  useEffect(() => {
    // Include modified_at timestamps to detect content changes, not just add/remove
    const nodeKey = initialNodes
      .map(n => {
        if (n.type === "ghost-screen") return `${n.id}:ghost`;
        return `${n.id}:${(n.data as ScreenNodeData).design.modified_at}`;
      })
      .sort()
      .join(',');

    // Sync when nodes change (add/remove) OR when content changes (edit)
    if (nodeKey !== prevNodeKeyRef.current) {
      prevNodeKeyRef.current = nodeKey;
      isExternalSyncRef.current = true;
      setNodes(initialNodes);
      // Reset flag after React has processed the update
      requestAnimationFrame(() => {
        isExternalSyncRef.current = false;
      });
    }
  }, [initialNodes, setNodes]);

  // Handle node changes (drag, select, etc.)
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Apply changes to internal state
      setNodes((nds) => applyNodeChanges(changes, nds));

      // Skip position sync if this change originated from external state sync
      // This prevents the feedback loop: setNodes → onNodesChange → onPositionsChange → re-render
      if (isExternalSyncRef.current) {
        return;
      }

      // Check for position changes from user interactions (drag) and sync to store
      const positionChanges = changes.filter(
        (change) => change.type === "position" && change.position
      );

      if (positionChanges.length > 0) {
        const currentNodes = getNodes();
        // Exclude ghost placeholder from persisted positions
        const newPositions: ScreenPosition[] = currentNodes
          .filter((node) => node.id !== "__ghost__")
          .map((node) => ({
            id: node.id,
            x: node.position.x,
            y: node.position.y,
          }));
        onPositionsChange(newPositions);
      }
    },
    [setNodes, getNodes, onPositionsChange]
  );

  // Handle selection changes
  const handleSelectionChange = useCallback(
    (params: OnSelectionChangeParams) => {
      const selectedNodeIds = new Set(params.nodes.map((n) => n.id));
      onSelectionChange?.(selectedNodeIds);
    },
    [onSelectionChange]
  );

  // Handle node double-click - trigger capture and add to composer
  const handleNodeDoubleClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      const nodeData = node.data as ScreenNodeData;
      if (nodeData.design && onCaptureScreen) {
        onCaptureScreen(nodeData.design);
      }
    },
    [onCaptureScreen]
  );

  const dotPatternStyle = {
    backgroundImage: 'radial-gradient(rgba(240, 240, 245, 0.15) 1px, transparent 1px)',
    backgroundSize: '24px 24px',
  };

  return (
    <div className={cn("w-full h-full relative", className)} style={dotPatternStyle}>
      <ReactFlow
        nodes={nodes}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onSelectionChange={handleSelectionChange}
        onNodeDoubleClick={handleNodeDoubleClick}
        // Interactions
        selectionOnDrag
        panOnScroll
        zoomOnPinch
        selectNodesOnDrag={false}
        // Zoom settings
        minZoom={0.25}
        maxZoom={2}
        defaultViewport={{ x: 0, y: 0, zoom: 0.75 }}
        // Keyboard shortcuts
        deleteKeyCode={["Backspace", "Delete"]}
        multiSelectionKeyCode="Shift"
        // Styling
        fitView={false}
        attributionPosition="bottom-left"
        proOptions={{ hideAttribution: true }}
      />
      
      {/* Controls rendered outside ReactFlow to ensure they're clickable */}
      <CanvasControls />
    </div>
  );
}

// Wrap with ReactFlowProvider for hook access
export function DesignCanvas(props: DesignCanvasProps) {
  return (
    <ReactFlowProvider>
      <DesignCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

// Export hook for capturing screens from outside the canvas
export { useReactFlow } from "@xyflow/react";
