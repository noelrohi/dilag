import { useQuery, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useMemo } from "react";
import { useSessionDiffs, type FileDiff } from "@/context/session-store";
import { useGlobalEvents } from "@/context/global-events";
import { isEventFileWatcherUpdated } from "@/lib/event-guards";

/**
 * File node from the Tauri backend
 */
export interface FileNode {
  id: string; // relative path
  name: string;
  isDir: boolean;
  children?: FileNode[];
}

/**
 * File node with diff information merged
 */
export interface FileNodeWithDiff extends FileNode {
  additions?: number;
  deletions?: number;
  hasDiff: boolean;
  children?: FileNodeWithDiff[];
}

/**
 * Fetch project files from the Tauri backend
 */
async function fetchProjectFiles(sessionCwd: string): Promise<FileNode[]> {
  return invoke<FileNode[]>("list_project_files", { sessionCwd });
}

/**
 * Read a file's content from the project
 */
export async function readProjectFile(
  sessionCwd: string,
  filePath: string
): Promise<string> {
  return invoke<string>("read_project_file", { sessionCwd, filePath });
}

/**
 * Build a map of file paths to their diffs for quick lookup
 */
function buildDiffMap(
  diffs: FileDiff[],
  sessionCwd: string
): Map<string, FileDiff> {
  const map = new Map<string, FileDiff>();
  const normalizedCwd = sessionCwd.replace(/\\/g, "/").replace(/\/$/, "");

  for (const diff of diffs) {
    const normalizedFile = diff.file.replace(/\\/g, "/");
    // Extract relative path
    let relativePath = normalizedFile;
    if (normalizedFile.startsWith(normalizedCwd + "/")) {
      relativePath = normalizedFile.slice(normalizedCwd.length + 1);
    }
    map.set(relativePath, diff);
  }

  return map;
}

/**
 * Recursively merge file tree with diff information
 */
function mergeWithDiffs(
  nodes: FileNode[],
  diffMap: Map<string, FileDiff>
): FileNodeWithDiff[] {
  return nodes.map((node): FileNodeWithDiff => {
    const diff = diffMap.get(node.id);
    const hasDiff = !!diff;

    if (node.isDir && node.children) {
      const children = mergeWithDiffs(node.children, diffMap);
      // A directory "has diff" if any of its children have diffs
      const dirHasDiff = children.some(
        (child) => child.hasDiff || (child.additions ?? 0) > 0 || (child.deletions ?? 0) > 0
      );

      return {
        id: node.id,
        name: node.name,
        isDir: node.isDir,
        hasDiff: dirHasDiff,
        children,
      };
    }

    return {
      id: node.id,
      name: node.name,
      isDir: node.isDir,
      hasDiff,
      additions: diff?.additions,
      deletions: diff?.deletions,
    };
  });
}

/**
 * Count total files with diffs in the tree
 */
export function countFilesWithDiffs(nodes: FileNodeWithDiff[]): number {
  let count = 0;
  for (const node of nodes) {
    if (!node.isDir && node.hasDiff) {
      count++;
    }
    if (node.children) {
      count += countFilesWithDiffs(node.children);
    }
  }
  return count;
}

/**
 * Hook to fetch and manage project files with diff indicators
 */
export function useProjectFiles(sessionId: string, sessionCwd: string | null) {
  const queryClient = useQueryClient();
  const { subscribe } = useGlobalEvents();
  const diffs = useSessionDiffs(sessionId);

  // Fetch file tree from filesystem
  const {
    data: fileTree,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["projectFiles", sessionCwd],
    queryFn: () => fetchProjectFiles(sessionCwd!),
    enabled: !!sessionCwd,
    staleTime: 30000, // Consider fresh for 30 seconds
    refetchOnWindowFocus: false,
  });

  // Subscribe to file watcher events to refresh the tree
  useEffect(() => {
    if (!sessionCwd) return;

    const normalizedCwd = sessionCwd.replace(/\\/g, "/").replace(/\/$/, "");

    const unsubscribe = subscribe((event) => {
      if (!isEventFileWatcherUpdated(event)) return;

      const { file } = event.properties;
      const normalizedFile = file.replace(/\\/g, "/");

      // Only refresh if the file is within this session's directory
      if (normalizedFile.startsWith(normalizedCwd + "/")) {
        // Debounce: invalidate the query which will trigger a refetch
        queryClient.invalidateQueries({ queryKey: ["projectFiles", sessionCwd] });
      }
    });

    return () => unsubscribe();
  }, [sessionCwd, subscribe, queryClient]);

  // Merge file tree with diffs
  const filesWithDiffs = useMemo(() => {
    if (!fileTree || !sessionCwd) return [];

    const diffMap = buildDiffMap(diffs, sessionCwd);
    return mergeWithDiffs(fileTree, diffMap);
  }, [fileTree, diffs, sessionCwd]);

  // Count files with changes
  const changedFileCount = useMemo(() => {
    return countFilesWithDiffs(filesWithDiffs);
  }, [filesWithDiffs]);

  return {
    files: filesWithDiffs,
    isLoading,
    error,
    refetch,
    changedFileCount,
  };
}

/**
 * Hook to read a single file's content
 */
export function useFileContent(sessionCwd: string | null, filePath: string | null) {
  return useQuery({
    queryKey: ["fileContent", sessionCwd, filePath],
    queryFn: () => readProjectFile(sessionCwd!, filePath!),
    enabled: !!sessionCwd && !!filePath,
    staleTime: 10000, // Consider fresh for 10 seconds
    refetchOnWindowFocus: false,
  });
}
