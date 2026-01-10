import { useMemo } from "react";
import { MultiFileDiff, File, type FileContents } from "@pierre/diffs/react";
import { useFileContent } from "@/hooks/use-project-files";
import { useSessionDiffs, type FileDiff } from "@/context/session-store";
import { inferLanguage } from "@/lib/file-utils";
import { cn } from "@/lib/utils";
import { FileCode, Loader2, AlertCircle, FolderOpen } from "lucide-react";

interface FileViewerProps {
  sessionId: string;
  sessionCwd: string;
  filePath: string | null;
  isDir: boolean;
  className?: string;
}

export function FileViewer({
  sessionId,
  sessionCwd,
  filePath,
  isDir,
  className,
}: FileViewerProps) {
  const diffs = useSessionDiffs(sessionId);

  // Find the diff for this file if it exists
  const fileDiff = useMemo(() => {
    if (!filePath) return null;

    const normalizedCwd = sessionCwd.replace(/\\/g, "/").replace(/\/$/, "");

    for (const diff of diffs) {
      const normalizedFile = diff.file.replace(/\\/g, "/");
      let relativePath = normalizedFile;
      if (normalizedFile.startsWith(normalizedCwd + "/")) {
        relativePath = normalizedFile.slice(normalizedCwd.length + 1);
      }
      if (relativePath === filePath) {
        return diff;
      }
    }
    return null;
  }, [filePath, diffs, sessionCwd]);

  // Fetch file content only if there's no diff (for unchanged files)
  const { data: fileContent, isLoading, error } = useFileContent(
    fileDiff ? null : sessionCwd, // Don't fetch if we have a diff
    fileDiff ? null : filePath
  );

  // Empty state - no file selected
  if (!filePath) {
    return (
      <div className={cn("flex items-center justify-center h-full", className)}>
        <div className="text-center text-muted-foreground">
          <FileCode className="size-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">Select a file to view</p>
        </div>
      </div>
    );
  }

  // Directory selected
  if (isDir) {
    return (
      <div className={cn("flex items-center justify-center h-full", className)}>
        <div className="text-center text-muted-foreground">
          <FolderOpen className="size-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">Folder: {filePath}</p>
          <p className="text-xs mt-1 opacity-70">Select a file to view its contents</p>
        </div>
      </div>
    );
  }

  // Loading state (only for files without diffs)
  if (!fileDiff && isLoading) {
    return (
      <div className={cn("flex items-center justify-center h-full", className)}>
        <div className="text-center text-muted-foreground">
          <Loader2 className="size-8 mx-auto mb-3 animate-spin" />
          <p className="text-sm">Loading file...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (!fileDiff && error) {
    return (
      <div className={cn("flex items-center justify-center h-full", className)}>
        <div className="text-center text-destructive">
          <AlertCircle className="size-8 mx-auto mb-3" />
          <p className="text-sm">Failed to load file</p>
          <p className="text-xs mt-1 opacity-70">
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
        </div>
      </div>
    );
  }

  // File has diff - show unified diff view
  if (fileDiff) {
    return (
      <DiffView
        diff={fileDiff}
        filePath={filePath}
        className={className}
      />
    );
  }

  // File has no diff - show file content
  return (
    <ContentView
      content={fileContent ?? ""}
      filePath={filePath}
      className={className}
    />
  );
}

interface DiffViewProps {
  diff: FileDiff;
  filePath: string;
  className?: string;
}

function DiffView({ diff, filePath, className }: DiffViewProps) {
  const lang = inferLanguage(filePath);

  const oldFile: FileContents = useMemo(
    () => ({
      name: filePath,
      contents: diff.before,
      lang,
    }),
    [filePath, diff.before, lang]
  );

  const newFile: FileContents = useMemo(
    () => ({
      name: filePath,
      contents: diff.after,
      lang,
    }),
    [filePath, diff.after, lang]
  );

  return (
    <div className={cn("h-full min-h-0 flex flex-col", className)}>
      <MultiFileDiff
        oldFile={oldFile}
        newFile={newFile}
        options={{
          diffStyle: "unified",
          diffIndicators: "classic",
          theme: {
            light: "one-light",
            dark: "one-dark-pro",
          },
          overflow: "scroll",
        }}
        style={{ height: "100%" }}
      />
    </div>
  );
}

interface ContentViewProps {
  content: string;
  filePath: string;
  className?: string;
}

function ContentView({ content, filePath, className }: ContentViewProps) {
  const lang = inferLanguage(filePath);

  const file: FileContents = useMemo(
    () => ({
      name: filePath,
      contents: content,
      lang,
    }),
    [filePath, content, lang]
  );

  return (
    <div className={cn("h-full min-h-0 flex flex-col", className)}>
      <File
        file={file}
        options={{
          theme: {
            light: "one-light",
            dark: "one-dark-pro",
          },
          overflow: "scroll",
        }}
        style={{ height: "100%" }}
      />
    </div>
  );
}
