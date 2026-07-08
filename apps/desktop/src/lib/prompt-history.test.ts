import { beforeEach, describe, expect, it, vi } from "vitest"
import { loadPromptHistory, pushPromptHistory } from "./prompt-history"

describe("prompt history", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    const storage = new Map<string, string>()

    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        storage.set(key, value)
      }),
      removeItem: vi.fn((key: string) => {
        storage.delete(key)
      }),
      clear: vi.fn(() => {
        storage.clear()
      }),
      key: vi.fn((index: number) => Array.from(storage.keys())[index] ?? null),
      get length() {
        return storage.size
      },
    })
  })

  it("round-trips pushed prompts for a session", () => {
    pushPromptHistory("session-1", "Build a dashboard")
    pushPromptHistory("session-1", "Make it warmer")

    expect(loadPromptHistory("session-1")).toEqual(["Build a dashboard", "Make it warmer"])
  })

  it("collapses consecutive duplicate prompts", () => {
    pushPromptHistory("session-1", "Build a dashboard")
    pushPromptHistory("session-1", "Build a dashboard")
    pushPromptHistory("session-1", "Make it warmer")

    expect(loadPromptHistory("session-1")).toEqual(["Build a dashboard", "Make it warmer"])
  })

  it("caps history at the newest 50 prompts", () => {
    for (let index = 0; index < 55; index++) {
      pushPromptHistory("session-1", `Prompt ${index}`)
    }

    const history = loadPromptHistory("session-1")
    expect(history).toHaveLength(50)
    expect(history[0]).toBe("Prompt 5")
    expect(history.at(-1)).toBe("Prompt 54")
  })

  it("swallows storage exceptions", () => {
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded")
    })

    expect(() => pushPromptHistory("session-1", "Build a dashboard")).not.toThrow()
    expect(loadPromptHistory("session-1")).toEqual([])
  })
})
