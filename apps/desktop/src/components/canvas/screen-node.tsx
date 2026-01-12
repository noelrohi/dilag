import { memo, useCallback } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { IPhoneFrame } from "@/components/blocks/iphone-frame";
import type { DesignFile } from "@/hooks/use-designs";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Copy, Code, Download, Trash2, FolderOpen, MessageSquarePlus } from "lucide-react";
import { copyFilePath, copyToClipboard, downloadHtml } from "@/lib/design-export";
import { CodeViewerDialog } from "@/components/blocks/dialog-code-viewer";

// Constants for frame sizes
const WEB_WIDTH = 640;
const WEB_HEIGHT = 400;

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
}

function ScreenNodeComponent({ id, data, selected }: NodeProps) {
  const { design, platform, sessionCwd, onDelete, onAddToComposer } = data as ScreenNodeData;
  const isMobile = platform === "mobile";

  // Prepare HTML with scrollbar styles
  const htmlWithScrollbar = design.html.replace(
    "</head>",
    `${scrollbarStyles}</head>`
  );

  const filePath = sessionCwd
    ? `${sessionCwd}/screens/${design.filename}`
    : undefined;

  const handleCopy = useCallback(() => {
    copyToClipboard(design.html);
  }, [design.html]);

  const handleCopyPath = useCallback(() => {
    if (filePath) copyFilePath(filePath);
  }, [filePath]);

  const handleDownload = useCallback(() => {
    downloadHtml({ html: design.html, title: design.title });
  }, [design.html, design.title]);

  const handleDelete = useCallback(() => {
    onDelete?.();
  }, [onDelete]);

  const handleAddToComposer = useCallback(() => {
    onAddToComposer?.();
  }, [onAddToComposer]);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="flex flex-col group/screen cursor-grab active:cursor-grabbing">
          {/* Title - OUTSIDE selection ring */}
          <div className="flex items-center justify-between mb-2 px-0.5 drag-handle">
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
                {/* Overlay to capture mouse events */}
                <div className="absolute inset-0 z-10" />
                <iframe
                  data-screen-id={id}
                  srcDoc={htmlWithScrollbar}
                  className="w-full h-full border-0 pointer-events-none"
                  sandbox="allow-scripts"
                  title={design.title}
                  style={{
                    width: 393,
                    height: 852,
                    transform: "scale(0.663)",
                    transformOrigin: "top left",
                  }}
                />
              </IPhoneFrame>
            ) : (
              <div
                className="bg-white rounded-lg overflow-hidden shadow-xl ring-1 ring-border relative"
                style={{ width: WEB_WIDTH, height: WEB_HEIGHT }}
              >
                {/* Overlay to capture mouse events */}
                <div className="absolute inset-0 z-10" />
                <iframe
                  data-screen-id={id}
                  srcDoc={htmlWithScrollbar}
                  className="w-full h-full border-0 pointer-events-none"
                  sandbox="allow-scripts"
                  title={design.title}
                  style={{
                    width: 1280,
                    height: 800,
                    transform: `scale(${WEB_WIDTH / 1280})`,
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
          Download
          <ContextMenuShortcut>Cmd+Shift+D</ContextMenuShortcut>
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
