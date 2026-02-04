import { cn } from "@/lib/utils";
import { MenuDots, TrashBinMinimalistic, Copy, Code, Download, FolderOpen } from "@solar-icons/react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuShortcut } from "@dilag/ui/dropdown-menu";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger, ContextMenuShortcut } from "@dilag/ui/context-menu";
import { copyFilePath, copyToClipboard, downloadHtml } from "@/lib/design-export";
import { CodeViewerDialog } from "@/components/blocks/dialogs/dialog-code-viewer";

interface ScreenFrameProps {
  title: string;
  children: React.ReactNode;
  filePath?: string;
  html?: string;
  onDelete?: () => void;
  className?: string;
}

export function ScreenFrame({
  title,
  children,
  filePath,
  html,
  onDelete,
  className,
}: ScreenFrameProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className={cn("flex flex-col group/screen", className)}>
          {/* Figma-style title above frame */}
          <div className="flex items-center justify-between mb-2 px-0.5">
            <span className="text-xs text-muted-foreground font-medium truncate max-w-[200px]">
              {title}
            </span>
          </div>

          {/* Frame content with centered hover menu */}
          <div className="relative">
            {children}
            
            {/* Centered menu trigger on hover */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/screen:opacity-100 transition-opacity duration-150 pointer-events-none">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="pointer-events-auto p-2.5 rounded-xl bg-popover/95 backdrop-blur-md border border-border/50 shadow-xl hover:bg-popover transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MenuDots size={16} className="text-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-48">
                  {html && (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(html);
                      }}
                    >
                      <Copy size={16} className="mr-2" />
                      Copy
                      <DropdownMenuShortcut>⌘C</DropdownMenuShortcut>
                    </DropdownMenuItem>
                  )}
                  {filePath && (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        copyFilePath(filePath);
                      }}
                    >
                      <FolderOpen size={16} className="mr-2" />
                      Copy path
                    </DropdownMenuItem>
                  )}
                  {html && (
                    <>
                      <DropdownMenuSeparator />
                      <CodeViewerDialog code={html} title={title}>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <Code size={16} className="mr-2" />
                        View Code
                        </DropdownMenuItem>
                      </CodeViewerDialog>
                    </>
                  )}
                  {html && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadHtml({ html, title });
                        }}
                      >
                        <Download size={16} className="mr-2" />
                        Download
                        <DropdownMenuShortcut>⌘⇧D</DropdownMenuShortcut>
                      </DropdownMenuItem>
                    </>
                  )}
                  {onDelete && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete();
                        }}
                        className="text-destructive focus:text-destructive focus:bg-destructive/10"
                      >
                        <TrashBinMinimalistic size={16} className="mr-2" />
                        Delete
                        <DropdownMenuShortcut>⌫</DropdownMenuShortcut>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        {html && (
          <ContextMenuItem onClick={() => copyToClipboard(html)}>
            <Copy size={16} className="mr-2" />
            Copy
            <ContextMenuShortcut>⌘C</ContextMenuShortcut>
          </ContextMenuItem>
        )}
        {filePath && (
          <ContextMenuItem onClick={() => copyFilePath(filePath)}>
            <FolderOpen size={16} className="mr-2" />
            Copy path
          </ContextMenuItem>
        )}
        {html && (
          <>
            <ContextMenuSeparator />
            <CodeViewerDialog code={html} title={title}>
              <ContextMenuItem onSelect={(e) => e.preventDefault()}>
                <Code size={16} className="mr-2" />
                View Code
              </ContextMenuItem>
            </CodeViewerDialog>
          </>
        )}
        {html && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => downloadHtml({ html, title })}>
              <Download size={16} className="mr-2" />
              Download
              <ContextMenuShortcut>⌘⇧D</ContextMenuShortcut>
            </ContextMenuItem>
          </>
        )}
        {onDelete && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem
              onClick={onDelete}
              className="text-destructive focus:text-destructive focus:bg-destructive/10"
            >
              <TrashBinMinimalistic size={16} className="mr-2" />
              Delete
              <ContextMenuShortcut>⌫</ContextMenuShortcut>
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
