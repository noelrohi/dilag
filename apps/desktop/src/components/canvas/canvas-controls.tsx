import { useReactFlow, useViewport } from "@xyflow/react"
import { useCallback } from "react"
import {
  IconMaximize as Maximize,
  IconRefresh as Restart,
  IconCircleMinus as MinusCircle,
  IconCirclePlus as AddCircle,
  IconLayoutGrid as LayoutGrid,
  IconUpload as Upload,
} from "@tabler/icons-react"
import { bridge } from "@/lib/bridge"

interface CanvasControlsProps {
  onAutoPosition?: () => void
  onImportFiles?: (filePaths: string[]) => Promise<void>
}

export function CanvasControls({ onAutoPosition, onImportFiles }: CanvasControlsProps) {
  const { setViewport, fitView, getViewport } = useReactFlow()
  const { zoom } = useViewport()

  const handleResetView = useCallback(() => {
    setViewport({ x: 0, y: 0, zoom: 0.75 }, { duration: 300 })
  }, [setViewport])

  const handleFitView = useCallback(() => {
    fitView({ padding: 0.2, duration: 300 })
  }, [fitView])

  const handleAutoPosition = useCallback(() => {
    onAutoPosition?.()
    window.setTimeout(() => {
      fitView({ padding: 0.2, duration: 300 })
    }, 50)
  }, [fitView, onAutoPosition])

  const handleZoomIn = useCallback(() => {
    const viewport = getViewport()
    const newZoom = Math.min(viewport.zoom + 0.1, 2)
    setViewport({ ...viewport, zoom: newZoom }, { duration: 150 })
  }, [getViewport, setViewport])

  const handleZoomOut = useCallback(() => {
    const viewport = getViewport()
    const newZoom = Math.max(viewport.zoom - 0.1, 0.25)
    setViewport({ ...viewport, zoom: newZoom }, { duration: 150 })
  }, [getViewport, setViewport])

  const handleImport = useCallback(async () => {
    if (!onImportFiles) return
    const filePaths = await bridge.dialog.openFiles({
      title: "Import HTML files",
      filters: [{ name: "HTML files", extensions: ["html", "htm"] }],
    })
    if (!filePaths || filePaths.length === 0) return
    await onImportFiles(filePaths)
  }, [onImportFiles])

  return (
    <>
      {/* Zoom controls */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-2 rounded-full bg-popover/90 backdrop-blur-sm border border-border shadow-xl z-50">
        {onImportFiles && (
          <>
            <button
              onClick={() => void handleImport()}
              className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
              title="Import HTML"
            >
              <Upload size={16} className="text-foreground" />
            </button>
            <div className="w-px h-5 bg-border mx-1" />
          </>
        )}
        <button
          onClick={handleResetView}
          className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
          title="Reset view"
        >
          <Restart size={16} className="text-foreground" />
        </button>
        <button
          onClick={handleFitView}
          className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
          title="Fit to screen"
        >
          <Maximize size={16} className="text-foreground" />
        </button>
        {onAutoPosition && (
          <button
            onClick={handleAutoPosition}
            className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
            title="Auto position screens"
          >
            <LayoutGrid size={16} className="text-foreground" />
          </button>
        )}
        <div className="w-px h-5 bg-border mx-1" />
        <button
          onClick={handleZoomOut}
          className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-foreground text-sm font-medium w-6 h-6 flex items-center justify-center"
          title="Zoom out"
        >
          <MinusCircle size={14} />
        </button>
        <span className="text-foreground text-xs font-medium px-2 min-w-[3rem] text-center tabular-nums">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={handleZoomIn}
          className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-foreground text-sm font-medium w-6 h-6 flex items-center justify-center"
          title="Zoom in"
        >
          <AddCircle size={14} />
        </button>
      </div>
    </>
  )
}
