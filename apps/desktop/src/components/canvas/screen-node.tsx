import { memo, useCallback, useEffect, useRef, useMemo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { IPhoneFrame } from "@/components/blocks/preview/iphone-frame";
import type { DesignFile } from "@/hooks/use-designs";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger, ContextMenuShortcut } from "@dilag/ui/context-menu";
import { Copy, Code, Download, Trash2, FolderOpen, MessageSquarePlus, Image } from "lucide-react";
import { copyFilePath, copyToClipboard, downloadHtml, exportAsPng } from "@/lib/design-export";
import { CodeViewerDialog } from "@/components/blocks/dialogs/dialog-code-viewer";
import { injectInspector, type ElementInspectorMessage } from "@/lib/element-inspector";
import { 
  useElementSelectionStore, 
  useHoveredElement, 
  useSelectedElement,
  type ElementInfo 
} from "@/context/element-selection-store";
import { ElementHighlight } from "./element-highlight";
import { ElementSelectionMenu } from "./element-selection-menu";

// Constants for frame sizes
const WEB_WIDTH = 640;
const WEB_HEIGHT = 400;
const MOBILE_SCALE = 0.663;
const WEB_SCALE = WEB_WIDTH / 1280;

// Scrollbar styles injected into iframes
const scrollbarStyles = `
  <style>
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.2); border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.3); }
  </style>
`;

export interface ScreenNodeData extends Record<string, unknown> {
  design: DesignFile;
  platform: "mobile" | "web";
  sessionCwd?: string;
  onDelete?: () => void;
  onAddToComposer?: () => void;
  /** Callback when user wants to edit a specific element with AI */
  onEditElementWithAI?: (element: ElementInfo) => void;
}

function ScreenNodeComponent({ id, data, selected }: NodeProps) {
  const { design, platform, sessionCwd, onDelete, onAddToComposer, onEditElementWithAI } = data as ScreenNodeData;
  const isMobile = platform === "mobile";
  const scale = isMobile ? MOBILE_SCALE : WEB_SCALE;
  
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Element selection state
  const hoveredElement = useHoveredElement();
  const selectedElement = useSelectedElement();
  const { setHovered, setSelected, clearSelection } = useElementSelectionStore();

  // Prepare HTML with scrollbar styles and inspector script
  const preparedHtml = useMemo(() => {
    const withScrollbar = design.html.replace(
      "</head>",
      `${scrollbarStyles}</head>`
    );
    return injectInspector(withScrollbar);
  }, [design.html]);

  const filePath = sessionCwd
    ? `${sessionCwd}/screens/${design.filename}`
    : undefined;

  // Handle messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent<ElementInspectorMessage>) => {
      // Only process messages from our iframes
      if (!event.data?.type) return;
      
      const messageType = event.data.type;
      
      // Check if message is from this screen's iframe
      const iframe = iframeRef.current;
      if (!iframe || event.source !== iframe.contentWindow) return;

      if (messageType === "element-hover") {
        setHovered({
          screenId: id,
          selector: event.data.selector,
          html: event.data.html,
          tagName: event.data.tagName,
          rect: event.data.rect,
          ancestorPath: event.data.ancestorPath,
        });
      } else if (messageType === "element-click") {
        setSelected({
          screenId: id,
          selector: event.data.selector,
          html: event.data.html,
          tagName: event.data.tagName,
          rect: event.data.rect,
          ancestorPath: event.data.ancestorPath,
        });
      } else if (messageType === "element-leave") {
        // Clear hover for this screen
        setHovered(null);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
      // Clear hover state for this screen on unmount
      const currentHovered = useElementSelectionStore.getState().hoveredElement;
      if (currentHovered?.screenId === id) {
        useElementSelectionStore.getState().setHovered(null);
      }
    };
  }, [id, setHovered, setSelected]);

  // Handle keyboard events for selected element
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle if this screen has the selected element
      if (selectedElement?.screenId !== id) return;

      if (event.key === "Escape") {
        event.preventDefault();
        clearSelection();
      } else if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        // Trigger edit with AI
        onEditElementWithAI?.(selectedElement);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [id, selectedElement, clearSelection, onEditElementWithAI]);

  // Handle double-click on selected element to edit
  const handleDoubleClick = useCallback(() => {
    if (selectedElement?.screenId === id && onEditElementWithAI) {
      onEditElementWithAI(selectedElement);
    }
  }, [id, selectedElement, onEditElementWithAI]);

  // Clear hover when mouse leaves the screen node or enters non-iframe areas
  const handleMouseLeave = useCallback(() => {
    if (hoveredElement?.screenId === id) {
      setHovered(null);
    }
  }, [id, hoveredElement?.screenId, setHovered]);

  // Also clear hover when entering the title/drag handle area (outside iframe)
  const handleTitleMouseEnter = useCallback(() => {
    if (hoveredElement?.screenId === id) {
      setHovered(null);
    }
  }, [id, hoveredElement?.screenId, setHovered]);

  // Clear selection when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectedElement?.screenId === id && containerRef.current) {
        if (!containerRef.current.contains(event.target as Node)) {
          clearSelection();
        }
      }
    };

    // Use capture phase to catch clicks before they're handled
    document.addEventListener("click", handleClickOutside, { capture: true });
    return () => document.removeEventListener("click", handleClickOutside, { capture: true });
  }, [id, selectedElement, clearSelection]);

  const handleCopy = useCallback(() => {
    copyToClipboard(design.html);
  }, [design.html]);

  const handleCopyPath = useCallback(() => {
    if (filePath) copyFilePath(filePath);
  }, [filePath]);

  const handleDownload = useCallback(() => {
    downloadHtml({ html: design.html, title: design.title });
  }, [design.html, design.title]);

  const handleExportPng = useCallback(() => {
    const dimensions = isMobile
      ? { width: 393, height: 852 }
      : { width: 1280, height: 800 };
    exportAsPng({
      html: design.html,
      title: design.title,
      ...dimensions,
      scale: 2,
    });
  }, [design.html, design.title, isMobile]);

  const handleDelete = useCallback(() => {
    // Clear selection if this screen has the selected element
    if (selectedElement?.screenId === id) {
      clearSelection();
    }
    onDelete?.();
  }, [id, selectedElement?.screenId, clearSelection, onDelete]);

  const handleAddToComposer = useCallback(() => {
    onAddToComposer?.();
  }, [onAddToComposer]);

  // Check if this screen has hovered/selected elements
  // Don't show hover highlight when something is already selected
  const showHoveredHighlight = hoveredElement?.screenId === id && !selectedElement;
  const showSelectedHighlight = selectedElement?.screenId === id;

  // Offset for the iframe content within the frame (for future use if needed)
  const iframeOffset = { x: 0, y: 0 };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div 
          ref={containerRef}
          className="flex flex-col group/screen cursor-grab active:cursor-grabbing"
          onDoubleClick={handleDoubleClick}
          onMouseLeave={handleMouseLeave}
        >
          {/* Title - OUTSIDE selection ring */}
          <div 
            className="flex items-center justify-between mb-2 px-0.5 drag-handle"
            onMouseEnter={handleTitleMouseEnter}
          >
            <span className="text-xs text-muted-foreground font-medium truncate max-w-[200px]">
              {design.title}
            </span>
          </div>

          {/* Frame content - selection ring wraps only this */}
          <div className="relative drag-handle">
            {/* Selection ring - only around the frame, not the title */}
            {selected && (
              <div className="absolute -inset-2 border-2 border-primary rounded-lg pointer-events-none z-10" />
            )}

            {isMobile ? (
              <IPhoneFrame>
                {/* Element highlights for mobile */}
                {showHoveredHighlight && hoveredElement && (
                  <ElementHighlight
                    element={hoveredElement}
                    isSelected={false}
                    scale={scale}
                    offset={iframeOffset}
                  />
                )}
                {showSelectedHighlight && selectedElement && (
                  <>
                    <ElementHighlight
                      element={selectedElement}
                      isSelected={true}
                      scale={scale}
                      offset={iframeOffset}
                    />
                    {onEditElementWithAI && (
                      <ElementSelectionMenu
                        element={selectedElement}
                        scale={scale}
                        offset={iframeOffset}
                        onEditWithAI={() => onEditElementWithAI(selectedElement)}
                        onClose={clearSelection}
                      />
                    )}
                  </>
                )}
                <iframe
                  ref={iframeRef}
                  data-screen-id={id}
                  srcDoc={preparedHtml}
                  className="w-full h-full border-0"
                  sandbox="allow-scripts"
                  title={design.title}
                  style={{
                    width: 393,
                    height: 852,
                    transform: `scale(${MOBILE_SCALE})`,
                    transformOrigin: "top left",
                  }}
                />
              </IPhoneFrame>
            ) : (
              <div
                className="bg-card rounded-lg overflow-hidden shadow-xl ring-1 ring-border relative"
                style={{ width: WEB_WIDTH, height: WEB_HEIGHT }}
              >
                {/* Element highlights for web */}
                {showHoveredHighlight && hoveredElement && (
                  <ElementHighlight
                    element={hoveredElement}
                    isSelected={false}
                    scale={scale}
                    offset={iframeOffset}
                  />
                )}
                {showSelectedHighlight && selectedElement && (
                  <>
                    <ElementHighlight
                      element={selectedElement}
                      isSelected={true}
                      scale={scale}
                      offset={iframeOffset}
                    />
                    {onEditElementWithAI && (
                      <ElementSelectionMenu
                        element={selectedElement}
                        scale={scale}
                        offset={iframeOffset}
                        onEditWithAI={() => onEditElementWithAI(selectedElement)}
                        onClose={clearSelection}
                      />
                    )}
                  </>
                )}
                <iframe
                  ref={iframeRef}
                  data-screen-id={id}
                  srcDoc={preparedHtml}
                  className="w-full h-full border-0"
                  sandbox="allow-scripts"
                  title={design.title}
                  style={{
                    width: 1280,
                    height: 800,
                    transform: `scale(${WEB_SCALE})`,
                    transformOrigin: "top left",
                  }}
                />
              </div>
            )}
          </div>

          {/* Invisible handles for potential future connections */}
          <Handle
            type="target"
            position={Position.Left}
            className="!opacity-0 !w-0 !h-0"
          />
          <Handle
            type="source"
            position={Position.Right}
            className="!opacity-0 !w-0 !h-0"
          />
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-48">
        {onAddToComposer && (
          <>
            <ContextMenuItem onClick={handleAddToComposer}>
              <MessageSquarePlus className="size-4 mr-2" />
              Add to chat
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}
        <ContextMenuItem onClick={handleCopy}>
          <Copy className="size-4 mr-2" />
          Copy
          <ContextMenuShortcut>Cmd+C</ContextMenuShortcut>
        </ContextMenuItem>
        {filePath && (
          <ContextMenuItem onClick={handleCopyPath}>
            <FolderOpen className="size-4 mr-2" />
            Copy path
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <CodeViewerDialog code={design.html} title={design.title}>
          <ContextMenuItem onSelect={(e) => e.preventDefault()}>
            <Code className="size-4 mr-2" />
            View Code
          </ContextMenuItem>
        </CodeViewerDialog>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleDownload}>
          <Download className="size-4 mr-2" />
          Download HTML
        </ContextMenuItem>
        <ContextMenuItem onClick={handleExportPng}>
          <Image className="size-4 mr-2" />
          Export as PNG
        </ContextMenuItem>
        {onDelete && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem
              onClick={handleDelete}
              className="text-destructive focus:text-destructive focus:bg-destructive/10"
            >
              <Trash2 className="size-4 mr-2" />
              Delete
              <ContextMenuShortcut>Del</ContextMenuShortcut>
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

// Memoize to prevent unnecessary re-renders
export const ScreenNode = memo(ScreenNodeComponent);
