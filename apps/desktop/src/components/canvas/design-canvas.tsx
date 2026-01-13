import { useCallback, useMemo, useEffect, useRef } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
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
import { CanvasControls } from "./canvas-controls";
import type { DesignFile } from "@/hooks/use-designs";
import { cn } from "@/lib/utils";

// Register custom node types
const nodeTypes = {
  screen: ScreenNode,
};

export interface ScreenPosition {
  id: string;
  x: number;
  y: number;
}

interface DesignCanvasProps {
  designs: DesignFile[];
  platform: "mobile" | "web";
  positions: ScreenPosition[];
  sessionCwd?: string;
  selectedIds?: Set<string>;
  onPositionsChange: (positions: ScreenPosition[]) => void;
  onSelectionChange?: (ids: Set<string>) => void;
  onDeleteScreen?: (filename: string) => void;
  onCaptureScreen?: (design: DesignFile) => void;
  className?: string;
}

function DesignCanvasInner({
  designs,
  platform,
  positions,
  sessionCwd,
  selectedIds,
  onPositionsChange,
  onSelectionChange,
  onDeleteScreen,
  onCaptureScreen,
  className,
}: DesignCanvasProps) {
  const { getNodes } = useReactFlow();

  // Convert ScreenPosition[] to React Flow nodes
  const initialNodes = useMemo((): Node[] => {
    return positions
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
          } as ScreenNodeData,
        } as Node;
      })
      .filter((n): n is Node => n !== null);
  }, [positions, designs, platform, sessionCwd, selectedIds, onDeleteScreen, onCaptureScreen]);

  const [nodes, setNodes] = useNodesState(initialNodes);

  // Track external sync to prevent feedback loops.
  // When syncing from external state (props), we skip position updates
  // in handleNodesChange to avoid: setNodes → onNodesChange → onPositionsChange → re-render → loop
  const isExternalSyncRef = useRef(false);
  const prevNodeKeyRef = useRef<string>('');

  useEffect(() => {
    // Include modified_at timestamps to detect content changes, not just add/remove
    const nodeKey = initialNodes
      .map(n => `${n.id}:${(n.data as ScreenNodeData).design.modified_at}`)
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
        const newPositions: ScreenPosition[] = currentNodes.map((node) => ({
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

  return (
    <div className={cn("w-full h-full relative", className)}>
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
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="hsl(var(--border))"
        />
      </ReactFlow>
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
