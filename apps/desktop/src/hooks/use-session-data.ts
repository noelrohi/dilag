import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import type { SessionMeta } from "@/context/session-store";

/**
 * Query key factory for sessions (TkDodo pattern)
 */
export const sessionKeys = {
  all: ["sessions"] as const,
  lists: () => [...sessionKeys.all, "list"] as const,
  list: () => [...sessionKeys.lists()] as const,
  details: () => [...sessionKeys.all, "detail"] as const,
  detail: (id: string) => [...sessionKeys.details(), id] as const,
};

// Tauri commands for local session management
async function loadSessionsMetadata(): Promise<SessionMeta[]> {
  return invoke<SessionMeta[]>("load_sessions_metadata");
}

async function saveSessionMetadata(session: SessionMeta): Promise<void> {
  return invoke<void>("save_session_metadata", { session });
}

async function deleteSessionMetadata(sessionId: string): Promise<void> {
  return invoke<void>("delete_session_metadata", { sessionId });
}

async function toggleSessionFavorite(sessionId: string): Promise<boolean> {
  return invoke<boolean>("toggle_session_favorite", { sessionId });
}

export async function createSessionDir(sessionId: string): Promise<string> {
  return invoke<string>("create_session_dir", { sessionId });
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
  });
}

/**
 * Hook to get the current session from the sessions list
 */
export function useCurrentSession(sessions: SessionMeta[] | undefined, currentSessionId: string | null) {
  return sessions?.find((s) => s.id === currentSessionId) ?? null;
}

/**
 * Hook for session mutations (create, update, delete)
 */
export function useSessionMutations() {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (session: SessionMeta) => {
      await saveSessionMetadata(session);
      return session;
    },
    onSuccess: (newSession) => {
      // Optimistically add to cache
      queryClient.setQueryData<SessionMeta[]>(sessionKeys.list(), (old) => 
        old ? [...old, newSession] : [newSession]
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<SessionMeta> }) => {
      const sessions = queryClient.getQueryData<SessionMeta[]>(sessionKeys.list());
      const session = sessions?.find((s) => s.id === id);
      if (session) {
        const updatedSession = { ...session, ...updates };
        await saveSessionMetadata(updatedSession);
        return updatedSession;
      }
      throw new Error("Session not found");
    },
    onSuccess: (updatedSession) => {
      queryClient.setQueryData<SessionMeta[]>(sessionKeys.list(), (old) =>
        old?.map((s) => (s.id === updatedSession.id ? updatedSession : s)) ?? []
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      await deleteSessionMetadata(sessionId);
      return sessionId;
    },
    onSuccess: (deletedId) => {
      queryClient.setQueryData<SessionMeta[]>(sessionKeys.list(), (old) =>
        old?.filter((s) => s.id !== deletedId) ?? []
      );
    },
  });

  const toggleFavoriteMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const newFavorite = await toggleSessionFavorite(sessionId);
      return { sessionId, favorite: newFavorite };
    },
    onMutate: async (sessionId) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: sessionKeys.list() });
      const previous = queryClient.getQueryData<SessionMeta[]>(sessionKeys.list());
      queryClient.setQueryData<SessionMeta[]>(sessionKeys.list(), (old) =>
        old?.map((s) => (s.id === sessionId ? { ...s, favorite: !s.favorite } : s)) ?? []
      );
      return { previous };
    },
    onError: (_err, _sessionId, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(sessionKeys.list(), context.previous);
      }
    },
    onSuccess: ({ sessionId, favorite }) => {
      // Ensure cache is in sync with server
      queryClient.setQueryData<SessionMeta[]>(sessionKeys.list(), (old) =>
        old?.map((s) => (s.id === sessionId ? { ...s, favorite } : s)) ?? []
      );
    },
  });

  return {
    createSession: createMutation.mutateAsync,
    updateSession: updateMutation.mutateAsync,
    deleteSession: deleteMutation.mutateAsync,
    toggleFavorite: toggleFavoriteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isTogglingFavorite: toggleFavoriteMutation.isPending,
  };
}
