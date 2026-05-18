import { useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { bridge } from "@/lib/bridge"
import { useSessionStore } from "@/context/session-store"
import { isGeneratedScreenFile } from "@dilag/desktop-bridge"

export type ViolationRule =
  | "keyframes"
  | "initial_opacity_zero"
  | "real_url"
  | "emoji_as_icon"
  | "animation_css"
  | "decorative_animation"

export interface Violation {
  rule: ViolationRule
  snippet: string
}

export interface DesignFile {
  filename: string
  file_path: string
  title: string
  screen_type: string
  html: string
  modified_at: number
  violations: Violation[]
}

async function loadSessionDesigns(sessionCwd: string): Promise<DesignFile[]> {
  return bridge.designs.loadForSession({ sessionCwd })
}

export function isSessionDesignFileChange(file: string, sessionCwd: string): boolean {
  return isGeneratedScreenFile(file, sessionCwd)
}

/**
 * Query key factory for designs
 * Following TkDodo's query key factory pattern
 */
export const designKeys = {
  all: ["designs"] as const,
  session: (sessionCwd: string | undefined) => [...designKeys.all, "session", sessionCwd] as const,
}

/**
 * Hook to fetch designs for a session
 * Uses React Query for data fetching with polling
 */
export function useSessionDesigns(sessionCwd: string | undefined) {
  const queryClient = useQueryClient()
  const latestDesignChange = useSessionStore((state) => {
    if (!sessionCwd) return null

    for (let index = state.recentFileChanges.length - 1; index >= 0; index -= 1) {
      const change = state.recentFileChanges[index]
      if (isSessionDesignFileChange(change.file, sessionCwd)) {
        return `${change.file}:${change.event}:${change.timestamp}:${state.designRefreshTick}`
      }
    }

    return state.designRefreshTick > 0 ? `refresh:${state.designRefreshTick}` : null
  })

  useEffect(() => {
    if (!sessionCwd || !latestDesignChange) return
    queryClient.invalidateQueries({ queryKey: designKeys.session(sessionCwd) })
  }, [latestDesignChange, queryClient, sessionCwd])

  return useQuery({
    queryKey: designKeys.session(sessionCwd),
    queryFn: () => {
      if (!sessionCwd) throw new Error("No session cwd")
      return loadSessionDesigns(sessionCwd)
    },
    enabled: !!sessionCwd,
    refetchInterval: 10000, // File watcher invalidates immediately; polling is only a fallback.
    refetchIntervalInBackground: false,
    staleTime: 5000,
  })
}
