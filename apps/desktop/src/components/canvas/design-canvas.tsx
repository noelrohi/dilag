import { useCallback, useMemo, useEffect, useRef } from "react"
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
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"

import { ScreenNode, type ScreenNodeData } from "./screen-node"
import { GhostScreenNode } from "./ghost-screen-node"
import { CanvasControls } from "./canvas-controls"
import type { DesignFile } from "@/hooks/use-designs"
import type { ElementInfo } from "@/context/element-selection-store"
import {
  getGhostScreenPosition,
  reconcileScreenPositions,
  type ScreenPosition,
} from "@/lib/screen-layout"
import { cn } from "@/lib/utils"

export type { ScreenPosition } from "@/lib/screen-layout"

// Register custom node types
const nodeTypes = {
  screen: ScreenNode,
  "ghost-screen": GhostScreenNode,
}

interface DesignCanvasProps {
  designs: DesignFile[]
  platform: "mobile" | "web"
  positions: ScreenPosition[]
  sessionCwd?: string
  selectedIds?: Set<string>
  isLoading?: boolean
  onPositionsChange: (positions: ScreenPosition[]) => void
  onSelectionChange?: (ids: Set<string>) => void
  onDeleteScreen?: (filename: string) => void
  onCaptureScreen?: (design: DesignFile) => void
  /** Callback when user wants to edit a specific element with AI */
  onEditElementWithAI?: (design: DesignFile, element: ElementInfo) => void
  className?: string
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
  const { getNodes } = useReactFlow()

  // Convert designs and persisted ScreenPosition[] to React Flow nodes. The
  // layout module reconciles missing persisted positions so available HTML
  // screens still render while stored positions hydrate after reopening a session.
  const initialNodes = useMemo((): Node[] => {
    const renderablePositions = reconcileScreenPositions({
      designs,
      persistedPositions: positions,
      platform,
    })
    const designById = new Map(designs.map((design) => [design.filename, design]))

    const screenNodes = renderablePositions
      .map((screenPosition) => {
        const design = designById.get(screenPosition.id)
        if (!design) return null

        return {
          id: screenPosition.id,
          type: "screen",
          position: { x: screenPosition.x, y: screenPosition.y },
          selected: selectedIds?.has(screenPosition.id) ?? false,
          data: {
            design,
            platform,
            sessionCwd,
            onDelete: onDeleteScreen ? () => onDeleteScreen(screenPosition.id) : undefined,
            onAddToComposer: onCaptureScreen ? () => onCaptureScreen(design) : undefined,
            onEditElementWithAI: onEditElementWithAI
              ? (element: ElementInfo) => onEditElementWithAI(design, element)
              : undefined,
          } as ScreenNodeData,
        } as Node
      })
      .filter((node): node is Node => node !== null)

    // Add a ghost placeholder node when the AI is actively generating.
    if (isLoading) {
      screenNodes.push({
        id: "__ghost__",
        type: "ghost-screen",
        position: getGhostScreenPosition({ screenPositions: renderablePositions, platform }),
        selectable: false,
        draggable: false,
        data: { platform },
      })
    }

    return screenNodes
  }, [
    positions,
    designs,
    platform,
    sessionCwd,
    selectedIds,
    isLoading,
    onDeleteScreen,
    onCaptureScreen,
    onEditElementWithAI,
  ])

  const [nodes, setNodes] = useNodesState(initialNodes)

  // Track external sync to prevent feedback loops.
  // When syncing from external state (props), we skip position updates
  // in handleNodesChange to avoid: setNodes → onNodesChange → onPositionsChange → re-render → loop
  const isExternalSyncRef = useRef(false)
  const prevNodeKeyRef = useRef<string>("")

  useEffect(() => {
    // Include positions and modified_at timestamps to detect placement hydration,
    // content changes, and add/remove changes.
    const nodeKey = initialNodes
      .map((n) => {
        const positionKey = `${n.position.x}:${n.position.y}`
        if (n.type === "ghost-screen") return `${n.id}:ghost:${positionKey}`
        return `${n.id}:${positionKey}:${(n.data as ScreenNodeData).design.modified_at}`
      })
      .sort()
      .join(",")

    // Sync when nodes change (add/remove), positions hydrate, or content changes (edit).
    if (nodeKey !== prevNodeKeyRef.current) {
      prevNodeKeyRef.current = nodeKey
      isExternalSyncRef.current = true
      setNodes(initialNodes)
      // Reset flag after React has processed the update
      requestAnimationFrame(() => {
        isExternalSyncRef.current = false
      })
    }
  }, [initialNodes, setNodes])

  // Handle node changes (drag, select, etc.)
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Apply changes to internal state
      setNodes((nds) => applyNodeChanges(changes, nds))

      // Skip position sync if this change originated from external state sync
      // This prevents the feedback loop: setNodes → onNodesChange → onPositionsChange → re-render
      if (isExternalSyncRef.current) {
        return
      }

      // Check for position changes from user interactions (drag) and sync to store
      const positionChanges = changes.filter(
        (change) => change.type === "position" && change.position,
      )

      if (positionChanges.length > 0) {
        const currentNodes = getNodes()
        // Exclude ghost placeholder from persisted positions
        const newPositions: ScreenPosition[] = currentNodes
          .filter((node) => node.id !== "__ghost__")
          .map((node) => ({
            id: node.id,
            x: node.position.x,
            y: node.position.y,
          }))
        onPositionsChange(newPositions)
      }
    },
    [setNodes, getNodes, onPositionsChange],
  )

  // Handle selection changes
  const handleSelectionChange = useCallback(
    (params: OnSelectionChangeParams) => {
      const selectedNodeIds = new Set(params.nodes.map((n) => n.id))
      onSelectionChange?.(selectedNodeIds)
    },
    [onSelectionChange],
  )

  // Handle node double-click - trigger capture and add to composer
  const handleNodeDoubleClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      const nodeData = node.data as ScreenNodeData
      if (nodeData.design && onCaptureScreen) {
        onCaptureScreen(nodeData.design)
      }
    },
    [onCaptureScreen],
  )

  const dotPatternStyle = {
    backgroundImage: "radial-gradient(rgba(240, 240, 245, 0.15) 1px, transparent 1px)",
    backgroundSize: "24px 24px",
  }

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
  )
}

// Wrap with ReactFlowProvider for hook access
export function DesignCanvas(props: DesignCanvasProps) {
  return (
    <ReactFlowProvider>
      <DesignCanvasInner {...props} />
    </ReactFlowProvider>
  )
}

// Export hook for capturing screens from outside the canvas
export { useReactFlow } from "@xyflow/react"
