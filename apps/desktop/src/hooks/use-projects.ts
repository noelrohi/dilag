import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { Platform, ProjectMeta } from "@dilag/desktop-bridge"
import { bridge } from "@/lib/bridge"
import type { SessionMeta } from "@/context/session-store"
import { sessionKeys } from "@/hooks/use-session-data"

export const projectKeys = {
  all: ["projects"] as const,
  list: () => [...projectKeys.all, "list"] as const,
  legacyNotice: () => [...projectKeys.all, "legacy-notice"] as const,
}

export function useProjectsList() {
  return useQuery({
    queryKey: projectKeys.list(),
    queryFn: () => bridge.projects.list(),
    staleTime: 30_000,
  })
}

export function useLegacySessionsNotice(enabled: boolean) {
  return useQuery({
    queryKey: projectKeys.legacyNotice(),
    queryFn: () => bridge.projects.getLegacyNotice(),
    enabled,
  })
}

export function getDefaultProject(projects: ProjectMeta[]): ProjectMeta | null {
  if (projects.length === 0) return null
  const sorted = [...projects].sort(
    (a, b) => new Date(b.last_opened_at).getTime() - new Date(a.last_opened_at).getTime(),
  )
  return sorted.find((project) => project.pinned) ?? sorted[0] ?? null
}

export function useProjectMutations() {
  const queryClient = useQueryClient()

  const upsertProjectInCache = (project: ProjectMeta) => {
    queryClient.setQueryData<ProjectMeta[]>(projectKeys.list(), (old) => {
      const current = old ?? []
      const exists = current.some((item) => item.id === project.id)
      const next = exists
        ? current.map((item) => (item.id === project.id ? project : item))
        : [project, ...current]
      return [...next].sort(
        (a, b) =>
          Number(b.pinned) - Number(a.pinned) ||
          new Date(b.last_opened_at).getTime() - new Date(a.last_opened_at).getTime(),
      )
    })
  }

  const createProject = useMutation({
    mutationFn: (args: { name: string; platform?: Platform }) => bridge.projects.create(args),
    onSuccess: upsertProjectInCache,
  })

  const addExistingProject = useMutation({
    mutationFn: (args: { path: string; platform?: Platform }) => bridge.projects.addExisting(args),
    onSuccess: upsertProjectInCache,
  })

  const updateProject = useMutation({
    mutationFn: (args: {
      id: string
      updates: Partial<Pick<ProjectMeta, "name" | "platform" | "pinned" | "expanded">>
    }) => bridge.projects.update(args),
    onSuccess: (project) => {
      upsertProjectInCache(project)
      queryClient.setQueryData<SessionMeta[]>(
        sessionKeys.list(),
        (old) =>
          old?.map((session) =>
            session.projectId === project.id
              ? {
                  ...session,
                  cwd: project.path,
                  favorite: project.pinned,
                }
              : session,
          ) ?? [],
      )
    },
  })

  const removeProject = useMutation({
    mutationFn: async (id: string) => {
      await bridge.projects.remove({ id })
      return id
    },
    onSuccess: (id) => {
      queryClient.setQueryData<ProjectMeta[]>(
        projectKeys.list(),
        (old) => old?.filter((project) => project.id !== id) ?? [],
      )
    },
  })

  const touchProject = useMutation({
    mutationFn: (id: string) => bridge.projects.touch({ id }),
    onSuccess: upsertProjectInCache,
  })

  const dismissLegacyNotice = useMutation({
    mutationFn: () => bridge.projects.dismissLegacyNotice(),
    onSuccess: () => {
      queryClient.setQueryData(projectKeys.legacyNotice(), {
        hasLegacySessions: true,
        dismissed: true,
      })
    },
  })

  const importLegacySessions = useMutation({
    mutationFn: () => bridge.projects.importLegacy(),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: projectKeys.list() }),
        queryClient.invalidateQueries({ queryKey: projectKeys.legacyNotice() }),
      ])
    },
  })

  return {
    createProject: createProject.mutateAsync,
    addExistingProject: addExistingProject.mutateAsync,
    updateProject: updateProject.mutateAsync,
    removeProject: removeProject.mutateAsync,
    touchProject: touchProject.mutateAsync,
    importLegacySessions: importLegacySessions.mutateAsync,
    dismissLegacyNotice: dismissLegacyNotice.mutateAsync,
  }
}
