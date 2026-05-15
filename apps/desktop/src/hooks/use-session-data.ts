import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { Platform, SessionMeta } from "@/context/session-store"
import { bridge } from "@/lib/bridge"

/**
 * Query key factory for sessions (TkDodo pattern)
 */
export const sessionKeys = {
  all: ["sessions"] as const,
  lists: () => [...sessionKeys.all, "list"] as const,
  list: () => [...sessionKeys.lists()] as const,
  details: () => [...sessionKeys.all, "detail"] as const,
  detail: (id: string) => [...sessionKeys.details(), id] as const,
}

function displayNameFromAgentSession(name: string | undefined, firstMessage: string | undefined) {
  const source = name || firstMessage || "New chat"
  const skillMatch = source.match(/<\/skill>\s*([\s\S]*)$/)
  const cleaned = (skillMatch?.[1] || source).trim()
  return cleaned || "New chat"
}

// Desktop bridge calls for local session management.
async function loadSessionsMetadata(): Promise<SessionMeta[]> {
  const projects = await bridge.projects.list()
  const projectSessions = await Promise.all(
    projects.map(async (project) => {
      const sessions = await bridge.agent.listSessions({ directory: project.path }).catch(() => [])
      return sessions.map((session): SessionMeta => {
        const name = displayNameFromAgentSession(session.name, session.first_message)
        return {
          id: session.id,
          name,
          created_at: session.created_at,
          updated_at: session.updated_at,
          cwd: project.path,
          platform: project.platform as Platform,
          favorite: project.pinned,
          projectId: project.id,
        }
      })
    }),
  )
  return projectSessions.flat().sort((a, b) => {
    return (
      new Date(a.updated_at ?? a.created_at).getTime() -
      new Date(b.updated_at ?? b.created_at).getTime()
    )
  })
}

async function saveSessionMetadata(session: SessionMeta): Promise<void> {
  return bridge.sessions.saveMeta({ session })
}

async function deleteSessionMetadata(sessionId: string): Promise<void> {
  return bridge.sessions.deleteMeta({ sessionId })
}

async function toggleSessionFavorite(sessionId: string): Promise<boolean> {
  return bridge.sessions.toggleFavorite({ sessionId })
}

export async function createSessionDir(sessionId: string): Promise<string> {
  return bridge.sessions.createDir({ sessionId })
}

/**
 * Hook to fetch the sessions list
 * Uses React Query for caching and automatic refetching
 */
export function useSessionsList(enabled: boolean = true) {
  return useQuery({
    queryKey: sessionKeys.list(),
    queryFn: loadSessionsMetadata,
    enabled,
    staleTime: 1000 * 60, // 1 minute
  })
}

/**
 * Hook to get the current session from the sessions list
 */
export function useCurrentSession(
  sessions: SessionMeta[] | undefined,
  currentSessionId: string | null,
) {
  return sessions?.find((s) => s.id === currentSessionId) ?? null
}

/**
 * Hook for session mutations (create, update, delete)
 */
export function useSessionMutations() {
  const queryClient = useQueryClient()

  const createMutation = useMutation({
    mutationFn: async (session: SessionMeta) => {
      await saveSessionMetadata(session)
      return session
    },
    onSuccess: (newSession) => {
      // Optimistically add to cache
      queryClient.setQueryData<SessionMeta[]>(sessionKeys.list(), (old) =>
        old ? [...old, newSession] : [newSession],
      )
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<SessionMeta> }) => {
      const sessions = queryClient.getQueryData<SessionMeta[]>(sessionKeys.list())
      const session = sessions?.find((s) => s.id === id)
      if (session) {
        const updatedSession = { ...session, ...updates }
        await saveSessionMetadata(updatedSession)
        return updatedSession
      }
      throw new Error("Session not found")
    },
    onSuccess: (updatedSession) => {
      queryClient.setQueryData<SessionMeta[]>(
        sessionKeys.list(),
        (old) => old?.map((s) => (s.id === updatedSession.id ? updatedSession : s)) ?? [],
      )
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      await deleteSessionMetadata(sessionId)
      return sessionId
    },
    onSuccess: (deletedId) => {
      queryClient.setQueryData<SessionMeta[]>(
        sessionKeys.list(),
        (old) => old?.filter((s) => s.id !== deletedId) ?? [],
      )
    },
  })

  const toggleFavoriteMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const newFavorite = await toggleSessionFavorite(sessionId)
      return { sessionId, favorite: newFavorite }
    },
    onMutate: async (sessionId) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: sessionKeys.list() })
      const previous = queryClient.getQueryData<SessionMeta[]>(sessionKeys.list())
      queryClient.setQueryData<SessionMeta[]>(
        sessionKeys.list(),
        (old) => old?.map((s) => (s.id === sessionId ? { ...s, favorite: !s.favorite } : s)) ?? [],
      )
      return { previous }
    },
    onError: (_err, _sessionId, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(sessionKeys.list(), context.previous)
      }
    },
    onSuccess: ({ sessionId, favorite }) => {
      // Ensure cache is in sync with server
      queryClient.setQueryData<SessionMeta[]>(
        sessionKeys.list(),
        (old) => old?.map((s) => (s.id === sessionId ? { ...s, favorite } : s)) ?? [],
      )
    },
  })

  return {
    createSession: createMutation.mutateAsync,
    updateSession: updateMutation.mutateAsync,
    deleteSession: deleteMutation.mutateAsync,
    toggleFavorite: toggleFavoriteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isTogglingFavorite: toggleFavoriteMutation.isPending,
  }
}
