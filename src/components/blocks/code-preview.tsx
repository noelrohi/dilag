import { useState, useCallback } from "react";
import { useProjectFiles } from "@/hooks/use-project-files";
import { FileTree } from "@/components/blocks/file-tree";
import { FileViewer } from "@/components/blocks/file-viewer";
import { cn } from "@/lib/utils";
import { FileCode, Loader2, AlertCircle } from "lucide-react";

interface CodePreviewProps {
  sessionId: string;
  sessionCwd?: string;
  className?: string;
}

export function CodePreview({ sessionId, sessionCwd, className }: CodePreviewProps) {
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [selectedIsDir, setSelectedIsDir] = useState(false);

  const { files, isLoading, error, changedFileCount } = useProjectFiles(
    sessionId,
    sessionCwd ?? null
  );

  const handleSelectFile = useCallback((fileId: string, isDir: boolean) => {
    setSelectedFileId(fileId);
    setSelectedIsDir(isDir);
  }, []);

  // Loading state
  if (isLoading && files.length === 0) {
    return (
      <div className={cn("flex items-center justify-center h-full", className)}>
        <div className="text-center text-muted-foreground">
          <Loader2 className="size-8 mx-auto mb-3 animate-spin" />
          <p className="text-sm">Loading project files...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && files.length === 0) {
    return (
      <div className={cn("flex items-center justify-center h-full", className)}>
        <div className="text-center text-destructive">
          <AlertCircle className="size-8 mx-auto mb-3" />
          <p className="text-sm">Failed to load project files</p>
          <p className="text-xs mt-1 opacity-70">
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
        </div>
      </div>
    );
  }

  // No files state
  if (files.length === 0) {
    return (
      <div className={cn("flex items-center justify-center h-full", className)}>
        <div className="text-center text-muted-foreground">
          <FileCode className="size-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No project files yet</p>
          <p className="text-xs mt-1 opacity-70">
            Files will appear here as they are generated
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex h-full min-h-0", className)}>
      {/* File tree sidebar */}
      <div className="w-64 shrink-0 border-r border-border bg-muted/30">
        <div className="px-3 py-2 border-b border-border flex items-center justify-between">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Files
          </h3>
          {changedFileCount > 0 && (
            <span className="text-xs font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">
              {changedFileCount} changed
            </span>
          )}
        </div>
        <FileTree
          files={files}
          selectedFileId={selectedFileId}
          onSelectFile={handleSelectFile}
          className="h-[calc(100%-37px)]"
        />
      </div>

      {/* File viewer */}
      <div className="flex-1 min-w-0 min-h-0 overflow-hidden">
        {sessionCwd && (
          <FileViewer
            sessionId={sessionId}
            sessionCwd={sessionCwd}
            filePath={selectedFileId}
            isDir={selectedIsDir}
            className="h-full min-h-0"
          />
        )}
      </div>
    </div>
  );
}

// Re-export the hook for use in browser-frame
export { useProjectFiles } from "@/hooks/use-project-files";
