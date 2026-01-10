import { Tree, type NodeRendererProps } from "react-arborist";
import { type FileNodeWithDiff } from "@/hooks/use-project-files";
import { cn } from "@/lib/utils";
import { ChevronRight, File, Folder, FolderOpen, Plus, Minus } from "lucide-react";
import { useCallback, useRef, useEffect } from "react";
import useResizeObserver from "use-resize-observer";

interface FileTreeProps {
  files: FileNodeWithDiff[];
  selectedFileId: string | null;
  onSelectFile: (fileId: string, isDir: boolean) => void;
  className?: string;
}

export function FileTree({
  files,
  selectedFileId,
  onSelectFile,
  className,
}: FileTreeProps) {
  const { ref, width, height } = useResizeObserver<HTMLDivElement>();
  const treeRef = useRef<any>(null);

  // Auto-scroll to selected file when it changes
  useEffect(() => {
    if (selectedFileId && treeRef.current) {
      treeRef.current.scrollTo(selectedFileId);
    }
  }, [selectedFileId]);

  const handleSelect = useCallback(
    (nodes: any[]) => {
      if (nodes.length > 0) {
        const node = nodes[0];
        onSelectFile(node.id, node.data.isDir);
      }
    },
    [onSelectFile]
  );

  return (
    <div ref={ref} className={cn("h-full overflow-hidden", className)}>
      <Tree
        ref={treeRef}
        data={files}
        width={width ?? 256}
        height={height ?? 400}
        indent={16}
        rowHeight={28}
        openByDefault={false}
        selection={selectedFileId ?? undefined}
        onSelect={handleSelect}
        childrenAccessor="children"
        idAccessor="id"
        disableDrag
        disableDrop
        disableEdit
      >
        {FileTreeNode}
      </Tree>
    </div>
  );
}

function FileTreeNode({
  node,
  style,
  dragHandle,
}: NodeRendererProps<FileNodeWithDiff>) {
  const data = node.data;
  const isSelected = node.isSelected;
  const isOpen = node.isOpen;

  return (
    <div
      ref={dragHandle}
      style={style}
      className={cn(
        "flex items-center gap-1 px-2 py-0.5 cursor-pointer select-none",
        "hover:bg-muted/50 rounded-sm transition-colors",
        isSelected && "bg-accent text-accent-foreground"
      )}
      onClick={(e) => {
        e.stopPropagation();
        if (data.isDir) {
          node.toggle();
        }
        node.select();
      }}
    >
      {/* Folder toggle arrow */}
      {data.isDir && (
        <ChevronRight
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform",
            isOpen && "rotate-90"
          )}
        />
      )}

      {/* File/folder icon */}
      {data.isDir ? (
        isOpen ? (
          <FolderOpen className="size-4 shrink-0 text-blue-500" />
        ) : (
          <Folder className="size-4 shrink-0 text-blue-500" />
        )
      ) : (
        <File className="size-4 shrink-0 text-muted-foreground" />
      )}

      {/* File name */}
      <span className="flex-1 truncate text-sm">{data.name}</span>

      {/* Diff indicators */}
      {!data.isDir && data.hasDiff && (
        <div className="flex items-center gap-1 text-xs font-mono shrink-0">
          {(data.additions ?? 0) > 0 && (
            <span className="flex items-center text-green-600 dark:text-green-500">
              <Plus className="size-3" />
              {data.additions}
            </span>
          )}
          {(data.deletions ?? 0) > 0 && (
            <span className="flex items-center text-red-600 dark:text-red-500">
              <Minus className="size-3" />
              {data.deletions}
            </span>
          )}
        </div>
      )}

      {/* Folder diff indicator (dot) */}
      {data.isDir && data.hasDiff && (
        <div className="size-2 rounded-full bg-blue-500 shrink-0" />
      )}
    </div>
  );
}
