import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { useSessions } from "@/hooks/use-sessions";

export interface DesignFile {
  filename: string;
  title: string;
  screen_type: "mobile" | "web";
  html: string;
  modified_at: number;
}

async function loadSessionDesigns(sessionCwd: string): Promise<DesignFile[]> {
  return invoke<DesignFile[]>("load_session_designs", { sessionCwd });
}

/**
 * Query key factory for designs
 * Following TkDodo's query key factory pattern
 */
export const designKeys = {
  all: ["designs"] as const,
  session: (sessionCwd: string | undefined) =>
    [...designKeys.all, "session", sessionCwd] as const,
};

/**
 * Hook to fetch designs for the current session
 * Uses React Query for data fetching with polling
 */
export function useSessionDesigns(sessionCwd: string | undefined) {
  return useQuery({
    queryKey: designKeys.session(sessionCwd),
    queryFn: () => {
      if (!sessionCwd) throw new Error("No session cwd");
      return loadSessionDesigns(sessionCwd);
    },
    enabled: !!sessionCwd,
    refetchInterval: 2000, // Poll every 2 seconds
    staleTime: 1000, // Consider data stale after 1 second
  });
}

/**
 * Convenience hook that combines data fetching with UI state
 * This is a composite hook for backward compatibility with existing components
 */
export function useDesigns() {
  const { currentSession } = useSessions();
  const [activeIndex, setActiveIndex] = useState(0);
  const [viewMode, setViewMode] = useState<"preview" | "code">("preview");

  const {
    data: designs = [],
    isLoading,
    refetch,
  } = useSessionDesigns(currentSession?.cwd);

  // Ensure activeIndex stays in bounds
  const boundedActiveIndex =
    designs.length > 0
      ? Math.min(activeIndex, designs.length - 1)
      : 0;

  const activeDesign = designs[boundedActiveIndex] ?? null;

  // Wrap refetch to be compatible with event handlers
  const refresh = () => {
    refetch();
  };

  return {
    designs,
    activeDesign,
    activeIndex: boundedActiveIndex,
    setActiveIndex,
    viewMode,
    setViewMode,
    isLoading,
    refresh,
  };
}
