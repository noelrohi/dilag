import {
  useCallback,
  useMemo,
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent as ReactMouseEvent,
} from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  ReactFlow,
  SelectionMode,
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
import { CanvasControls } from "./canvas-controls"
import { designKeys, type DesignFile } from "@/hooks/use-designs"
import type { ElementInfo } from "@/context/element-selection-store"
import { useSessionStore } from "@/context/session-store"
import {
  getAutoScreenPositions,
  reconcileScreenPositions,
  type ScreenPosition,
} from "@/lib/screen-layout"
import { resolveDesignPlatform } from "@/lib/design-viewport"
import { bridge } from "@/lib/bridge"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

export type { ScreenPosition } from "@/lib/screen-layout"

// Register custom node types
const nodeTypes = {
  screen: ScreenNode,
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
  onPositionsChange,
  onSelectionChange,
  onDeleteScreen,
  onCaptureScreen,
  onEditElementWithAI,
  className,
}: DesignCanvasProps) {
  const { getNodes } = useReactFlow()
  const queryClient = useQueryClient()
  const [isDragImportActive, setIsDragImportActive] = useState(false)

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
        const designPlatform = resolveDesignPlatform(design, platform)

        return {
          id: screenPosition.id,
          type: "screen",
          position: { x: screenPosition.x, y: screenPosition.y },
          selected: selectedIds?.has(screenPosition.id) ?? false,
          data: {
            design,
            platform: designPlatform,
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

    return screenNodes
  }, [
    positions,
    designs,
    platform,
    sessionCwd,
    selectedIds,
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
    // Include positions, selection, and modified_at timestamps to detect placement
    // hydration, external selection updates, content changes, and add/remove changes.
    const nodeKey = initialNodes
      .map((n) => {
        const positionKey = `${n.position.x}:${n.position.y}`
        const data = n.data as ScreenNodeData
        const selectionKey = n.selected ? "selected" : "idle"
        return `${n.id}:${positionKey}:${selectionKey}:${data.design.modified_at}:${data.design.screen_type}`
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
    },
    [setNodes],
  )

  const persistNodePositions = useCallback(
    (nodesToPersist: Node[] = getNodes()) => {
      if (isExternalSyncRef.current) return

      const newPositions: ScreenPosition[] = nodesToPersist.map((node) => ({
        id: node.id,
        x: node.position.x,
        y: node.position.y,
      }))
      onPositionsChange(newPositions)
    },
    [getNodes, onPositionsChange],
  )

  const handleNodeDragStop = useCallback(
    (_event: ReactMouseEvent, _node: Node, draggedNodes: Node[]) => {
      persistNodePositions(draggedNodes.length > 0 ? getNodes() : undefined)
    },
    [getNodes, persistNodePositions],
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

  const handleAutoPosition = useCallback(() => {
    onPositionsChange(getAutoScreenPositions({ designs, platform }))
  }, [designs, onPositionsChange, platform])

  const handleImportFiles = useCallback(
    async (filePaths: string[]) => {
      if (!sessionCwd || filePaths.length === 0) return

      const result = await bridge.designs.import({ sessionCwd, filePaths })
      if (result.imported > 0) {
        useSessionStore.getState().bumpDesignRefresh()
        await queryClient.invalidateQueries({ queryKey: designKeys.session(sessionCwd) })
        toast.success(
          result.imported === 1 ? "Imported 1 screen" : `Imported ${result.imported} screens`,
        )
      }

      if (result.rejected.length > 0) {
        const description = result.rejected
          .slice(0, 3)
          .map(
            (rejection) =>
              `${rejection.path.split(/[\\/]/).pop() ?? rejection.path}: ${rejection.reason}`,
          )
          .join("\n")
        toast.error(
          result.rejected.length === 1
            ? "Failed to import 1 file"
            : `Failed to import ${result.rejected.length} files`,
          { description },
        )
      }
    },
    [queryClient, sessionCwd],
  )

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (!Array.from(event.dataTransfer.items).some((item) => item.kind === "file")) return
    event.preventDefault()
    event.dataTransfer.dropEffect = "copy"
    setIsDragImportActive(true)
  }, [])

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      const htmlFiles = Array.from(event.dataTransfer.files).filter((file) =>
        /\.html?$/i.test(file.name),
      )
      if (htmlFiles.length === 0) {
        setIsDragImportActive(false)
        return
      }

      event.preventDefault()
      setIsDragImportActive(false)

      const filePaths = htmlFiles
        .map((file) => bridge.dialog.getPathForFile(file))
        .filter((filePath) => filePath.length > 0)

      if (filePaths.length === 0) {
        toast.error("Unable to access dropped file paths")
        return
      }

      void handleImportFiles(filePaths)
    },
    [handleImportFiles],
  )

  const dotPatternStyle = {
    backgroundImage: "radial-gradient(var(--canvas-dot-color) 1px, transparent 1px)",
    backgroundSize: "24px 24px",
  }

  return (
    <div
      className={cn(
        "w-full h-full relative bg-muted/20 [--canvas-dot-color:oklch(0.22_0.015_55_/_0.16)] dark:[--canvas-dot-color:rgba(240,240,245,0.15)]",
        className,
      )}
      style={dotPatternStyle}
      onDragLeave={() => setIsDragImportActive(false)}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <ReactFlow
        nodes={nodes}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onNodeDragStop={handleNodeDragStop}
        onSelectionChange={handleSelectionChange}
        onNodeDoubleClick={handleNodeDoubleClick}
        className="design-canvas-flow"
        // Interactions
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
        panOnDrag={[1]}
        panOnScroll
        zoomOnPinch
        selectNodesOnDrag={false}
        // Zoom settings
        minZoom={0.25}
        maxZoom={2}
        defaultViewport={{ x: 0, y: 0, zoom: 0.75 }}
        // Keyboard shortcuts
        deleteKeyCode={null}
        multiSelectionKeyCode="Shift"
        // Styling
        fitView={false}
        attributionPosition="bottom-left"
        proOptions={{ hideAttribution: true }}
      />

      {/* Controls rendered outside ReactFlow to ensure they're clickable */}
      <CanvasControls
        onAutoPosition={designs.length > 0 ? handleAutoPosition : undefined}
        onImportFiles={sessionCwd ? handleImportFiles : undefined}
      />
      {isDragImportActive && (
        <div className="pointer-events-none absolute inset-4 z-40 flex items-center justify-center rounded-xl border-2 border-dashed border-primary/60 bg-background/70 backdrop-blur-sm">
          <div className="rounded-lg bg-popover px-4 py-2 text-sm font-medium text-foreground shadow-lg">
            Drop HTML files to import
          </div>
        </div>
      )}
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
