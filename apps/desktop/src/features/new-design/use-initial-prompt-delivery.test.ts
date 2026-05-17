import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { FileUIPart } from "ai"
import {
  NEW_DESIGN_STORAGE_KEYS,
  type NewDesignStorage,
} from "@/features/new-design/use-new-design-flow"
import {
  useInitialPromptDelivery,
  type InitialPromptStorage,
  type UseInitialPromptDeliveryArgs,
} from "./use-initial-prompt-delivery"

function createStorage(
  initialValues: Record<string, string>,
): InitialPromptStorage & NewDesignStorage & { values: Map<string, string> } {
  const values = new Map(Object.entries(initialValues))
  return {
    values,
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value)
    }),
    removeItem: vi.fn((key: string) => {
      values.delete(key)
    }),
  }
}

function renderInitialPromptHook(
  args: Partial<UseInitialPromptDeliveryArgs> & {
    storage: InitialPromptStorage
    sendMessage: UseInitialPromptDeliveryArgs["sendMessage"]
  },
) {
  const defaultArgs: UseInitialPromptDeliveryArgs = {
    isServerReady: true,
    routeSessionId: "new-session",
    selectedSessionId: "new-session",
    hasRouteSession: true,
    sendMessage: args.sendMessage,
    storage: args.storage,
  }

  return renderHook((props: UseInitialPromptDeliveryArgs) => useInitialPromptDelivery(props), {
    initialProps: { ...defaultArgs, ...args },
  })
}

describe("useInitialPromptDelivery", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("waits until the selected session matches the route session before sending", async () => {
    const files: FileUIPart[] = [
      {
        type: "file",
        mediaType: "image/png",
        filename: "reference.png",
        url: "data:image/png;base64,abc",
      },
    ]
    const storage = createStorage({
      [NEW_DESIGN_STORAGE_KEYS.initialPrompt]: "Build a notes app",
      [NEW_DESIGN_STORAGE_KEYS.initialPlatform]: "mobile",
      [NEW_DESIGN_STORAGE_KEYS.initialFiles]: JSON.stringify(files),
    })
    const sendMessage = vi.fn()

    const { rerender } = renderInitialPromptHook({
      storage,
      sendMessage,
      routeSessionId: "new-session",
      selectedSessionId: "pinned-session",
    })

    expect(sendMessage).not.toHaveBeenCalled()
    expect(storage.values.get(NEW_DESIGN_STORAGE_KEYS.initialPrompt)).toBe("Build a notes app")

    rerender({
      isServerReady: true,
      routeSessionId: "new-session",
      selectedSessionId: "new-session",
      hasRouteSession: true,
      sendMessage,
      storage,
    })

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith("Build a notes app", files)
    })
    expect(storage.values.has(NEW_DESIGN_STORAGE_KEYS.initialPrompt)).toBe(false)
    expect(storage.values.has(NEW_DESIGN_STORAGE_KEYS.initialPlatform)).toBe(false)
    expect(storage.values.has(NEW_DESIGN_STORAGE_KEYS.initialFiles)).toBe(false)
  })

  it("does not consume the initial prompt before the route session metadata is loaded", () => {
    const storage = createStorage({
      [NEW_DESIGN_STORAGE_KEYS.initialPrompt]: "Build a checkout flow",
    })
    const sendMessage = vi.fn()

    renderInitialPromptHook({
      storage,
      sendMessage,
      routeSessionId: "new-session",
      selectedSessionId: "new-session",
      hasRouteSession: false,
    })

    expect(sendMessage).not.toHaveBeenCalled()
    expect(storage.values.get(NEW_DESIGN_STORAGE_KEYS.initialPrompt)).toBe("Build a checkout flow")
  })
})
