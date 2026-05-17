import { useMemo } from "react"
import { useNavigate } from "@tanstack/react-router"
import type { Platform, ProjectMeta } from "@dilag/desktop-bridge"
import type { FileUIPart } from "ai"
import { getDefaultProject } from "@/hooks/use-projects"

export const NEW_DESIGN_STORAGE_KEYS = {
  lastProjectId: "dilag-last-project-id",
  initialPrompt: "dilag-initial-prompt",
  initialPlatform: "dilag-initial-platform",
  initialFiles: "dilag-initial-files",
} as const

export interface NewDesignStorage {
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface NewDesignNavigation {
  openHome(): void
  openProjectComposer(projectId: string): void
  openProjectStudio(projectId: string, sessionId: string): void
}

export interface NewDesignFlowDependencies {
  projects: ProjectMeta[]
  navigation: NewDesignNavigation
  storage: NewDesignStorage
  touchProject: (projectId: string) => Promise<unknown>
  createSessionInProject: (project: ProjectMeta, platform?: Platform) => Promise<string | null>
}

export interface NewDesignFlow {
  openNewDesign(): void
  openProjectComposer(projectId: string): void
  rememberProject(projectId: string): void
  submitProjectComposer(
    project: ProjectMeta,
    platform: Platform,
    prompt: string,
    files?: FileUIPart[],
  ): Promise<string | null>
}

export function createNewDesignFlow({
  projects,
  navigation,
  storage,
  touchProject,
  createSessionInProject,
}: NewDesignFlowDependencies): NewDesignFlow {
  const rememberProject = (projectId: string) => {
    storage.setItem(NEW_DESIGN_STORAGE_KEYS.lastProjectId, projectId)
  }

  const openProjectComposer = (projectId: string) => {
    rememberProject(projectId)
    navigation.openProjectComposer(projectId)
  }

  const openNewDesign = () => {
    const project = getDefaultProject(projects)
    if (!project) {
      navigation.openHome()
      return
    }

    openProjectComposer(project.id)
  }

  const submitProjectComposer = async (
    project: ProjectMeta,
    platform: Platform,
    prompt: string,
    files?: FileUIPart[],
  ): Promise<string | null> => {
    if (!prompt.trim() && (!files || files.length === 0)) return null

    storage.setItem(NEW_DESIGN_STORAGE_KEYS.initialPrompt, prompt)
    storage.setItem(NEW_DESIGN_STORAGE_KEYS.initialPlatform, platform)
    if (files && files.length > 0) {
      storage.setItem(NEW_DESIGN_STORAGE_KEYS.initialFiles, JSON.stringify(files))
    } else {
      storage.removeItem(NEW_DESIGN_STORAGE_KEYS.initialFiles)
    }

    rememberProject(project.id)
    await touchProject(project.id)

    const sessionId = await createSessionInProject(project, platform)
    if (!sessionId) return null

    navigation.openProjectStudio(project.id, sessionId)
    return sessionId
  }

  return {
    openNewDesign,
    openProjectComposer,
    rememberProject,
    submitProjectComposer,
  }
}

export interface UseNewDesignFlowDependencies {
  projects: ProjectMeta[]
  touchProject?: NewDesignFlowDependencies["touchProject"]
  createSessionInProject?: NewDesignFlowDependencies["createSessionInProject"]
}

export function useNewDesignFlow({
  projects,
  touchProject,
  createSessionInProject,
}: UseNewDesignFlowDependencies): NewDesignFlow {
  const navigate = useNavigate()

  return useMemo(
    () =>
      createNewDesignFlow({
        projects,
        touchProject:
          touchProject ??
          (async () => {
            throw new Error("Cannot submit a project composer without a project mutation adapter")
          }),
        createSessionInProject:
          createSessionInProject ??
          (async () => {
            throw new Error("Cannot submit a project composer without a session adapter")
          }),
        storage: window.localStorage,
        navigation: {
          openHome: () => navigate({ to: "/" }),
          openProjectComposer: (projectId) =>
            navigate({ to: "/project/$projectId", params: { projectId } }),
          openProjectStudio: (projectId, sessionId) =>
            navigate({
              to: "/project/$projectId/session/$sessionId",
              params: { projectId, sessionId },
            }),
        },
      }),
    [projects, touchProject, createSessionInProject, navigate],
  )
}
