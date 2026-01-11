import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";

export interface DesignFile {
  filename: string;
  title: string;
  screen_type: string;
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
 * Hook to fetch designs for a session
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
