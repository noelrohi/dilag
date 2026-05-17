import { describe, expect, it, vi } from "vitest"
import type { ProjectMeta } from "@dilag/desktop-bridge"
import type { FileUIPart } from "ai"
import {
  createNewDesignFlow,
  NEW_DESIGN_STORAGE_KEYS,
  type NewDesignNavigation,
  type NewDesignStorage,
} from "./use-new-design-flow"

function project(overrides: Partial<ProjectMeta>): ProjectMeta {
  return {
    id: "project-1",
    name: "Checkout",
    path: "/projects/checkout",
    platform: "web",
    pinned: false,
    expanded: true,
    created_at: "2026-05-15T00:00:00.000Z",
    last_opened_at: "2026-05-15T00:00:00.000Z",
    ...overrides,
  }
}

function createStorage(): NewDesignStorage & { values: Map<string, string> } {
  const values = new Map<string, string>()
  return {
    values,
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value)
    }),
    removeItem: vi.fn((key: string) => {
      values.delete(key)
    }),
  }
}

function createNavigation(): NewDesignNavigation {
  return {
    openHome: vi.fn(),
    openProjectComposer: vi.fn(),
    openProjectStudio: vi.fn(),
  }
}

describe("new design flow", () => {
  it("opens New design at the default project composer without creating a Pi session", () => {
    const storage = createStorage()
    const navigation = createNavigation()
    const touchProject = vi.fn()
    const createSessionInProject = vi.fn()
    const projects = [
      project({ id: "recent", pinned: false, last_opened_at: "2026-05-16T00:00:00.000Z" }),
      project({ id: "pinned", pinned: true, last_opened_at: "2026-05-15T00:00:00.000Z" }),
    ]

    const flow = createNewDesignFlow({
      projects,
      navigation,
      storage,
      touchProject,
      createSessionInProject,
    })

    flow.openNewDesign()

    expect(navigation.openProjectComposer).toHaveBeenCalledWith("pinned")
    expect(storage.values.get(NEW_DESIGN_STORAGE_KEYS.lastProjectId)).toBe("pinned")
    expect(touchProject).not.toHaveBeenCalled()
    expect(createSessionInProject).not.toHaveBeenCalled()
  })

  it("opens New design at Home when no project exists", () => {
    const navigation = createNavigation()
    const flow = createNewDesignFlow({
      projects: [],
      navigation,
      storage: createStorage(),
      touchProject: vi.fn(),
      createSessionInProject: vi.fn(),
    })

    flow.openNewDesign()

    expect(navigation.openHome).toHaveBeenCalled()
    expect(navigation.openProjectComposer).not.toHaveBeenCalled()
  })

  it("opens a project composer without creating a Pi session", () => {
    const storage = createStorage()
    const navigation = createNavigation()
    const touchProject = vi.fn()
    const createSessionInProject = vi.fn()
    const flow = createNewDesignFlow({
      projects: [],
      navigation,
      storage,
      touchProject,
      createSessionInProject,
    })

    flow.openProjectComposer("project-42")

    expect(navigation.openProjectComposer).toHaveBeenCalledWith("project-42")
    expect(storage.values.get(NEW_DESIGN_STORAGE_KEYS.lastProjectId)).toBe("project-42")
    expect(touchProject).not.toHaveBeenCalled()
    expect(createSessionInProject).not.toHaveBeenCalled()
  })

  it("creates and opens a Pi session only when the composer prompt is submitted", async () => {
    const checkoutProject = project({ id: "checkout", platform: "mobile", pinned: true })
    const files: FileUIPart[] = [
      {
        type: "file",
        mediaType: "image/png",
        filename: "reference.png",
        url: "data:image/png;base64,abc",
      },
    ]
    const storage = createStorage()
    const navigation = createNavigation()
    const touchProject = vi.fn().mockResolvedValue(checkoutProject)
    const createSessionInProject = vi.fn().mockResolvedValue("session-1")
    const flow = createNewDesignFlow({
      projects: [checkoutProject],
      navigation,
      storage,
      touchProject,
      createSessionInProject,
    })

    await expect(
      flow.submitProjectComposer(checkoutProject, "mobile", "Build checkout", files),
    ).resolves.toBe("session-1")

    expect(storage.values.get(NEW_DESIGN_STORAGE_KEYS.initialPrompt)).toBe("Build checkout")
    expect(storage.values.get(NEW_DESIGN_STORAGE_KEYS.initialPlatform)).toBe("mobile")
    expect(storage.values.get(NEW_DESIGN_STORAGE_KEYS.initialFiles)).toBe(JSON.stringify(files))
    expect(touchProject).toHaveBeenCalledWith("checkout")
    expect(createSessionInProject).toHaveBeenCalledWith(checkoutProject, "mobile")
    expect(navigation.openProjectStudio).toHaveBeenCalledWith("checkout", "session-1")
  })

  it("ignores empty composer submissions", async () => {
    const checkoutProject = project({ id: "checkout" })
    const navigation = createNavigation()
    const touchProject = vi.fn()
    const createSessionInProject = vi.fn()
    const flow = createNewDesignFlow({
      projects: [checkoutProject],
      navigation,
      storage: createStorage(),
      touchProject,
      createSessionInProject,
    })

    await expect(flow.submitProjectComposer(checkoutProject, "web", "   ")).resolves.toBeNull()

    expect(touchProject).not.toHaveBeenCalled()
    expect(createSessionInProject).not.toHaveBeenCalled()
    expect(navigation.openProjectStudio).not.toHaveBeenCalled()
  })
})
