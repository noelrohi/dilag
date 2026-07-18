import { describe, expect, it, vi } from "vitest"

// pi.ts transitively imports electron (via paths.ts). The eviction helper under
// test is pure, so stub electron just enough for the module to load.
vi.mock("electron", () => ({
  app: {
    getAppPath: () => "/tmp/dilag-test",
    getPath: () => "/tmp/dilag-test",
  },
}))

import { assistantErrorMessage, selectSessionsToEvict } from "../../electron/ipc/pi.js"

type Candidate = Parameters<typeof selectSessionsToEvict>[0][number]

function candidate(overrides: Partial<Candidate> & Pick<Candidate, "id">): Candidate {
  return {
    isStreaming: false,
    hasPendingQuestion: false,
    lastUsedAt: 0,
    ...overrides,
  }
}

describe("assistantErrorMessage", () => {
  it("surfaces provider errors from terminal assistant messages", () => {
    expect(
      assistantErrorMessage({
        role: "assistant",
        stopReason: "error",
        errorMessage: '401: {"type":"AuthError","message":"Invalid API key."}',
      }),
    ).toContain("Invalid API key")
  })

  it("ignores successful and non-assistant messages", () => {
    expect(assistantErrorMessage({ role: "assistant", stopReason: "stop" })).toBeUndefined()
    expect(
      assistantErrorMessage({ role: "user", stopReason: "error", errorMessage: "ignored" }),
    ).toBeUndefined()
  })
})

describe("selectSessionsToEvict", () => {
  it("evicts idle sessions beyond the most-recently-used keepN", () => {
    const candidates = [
      candidate({ id: "a", lastUsedAt: 40 }),
      candidate({ id: "b", lastUsedAt: 30 }),
      candidate({ id: "c", lastUsedAt: 20 }),
      candidate({ id: "d", lastUsedAt: 10 }),
    ]
    expect(selectSessionsToEvict(candidates, 3)).toEqual(["d"])
  })

  it("keeps everything when at or under keepN", () => {
    const candidates = [
      candidate({ id: "a", lastUsedAt: 30 }),
      candidate({ id: "b", lastUsedAt: 20 }),
      candidate({ id: "c", lastUsedAt: 10 }),
    ]
    expect(selectSessionsToEvict(candidates, 3)).toEqual([])
  })

  it("never evicts a streaming session even when it is the least recently used", () => {
    const candidates = [
      candidate({ id: "a", lastUsedAt: 40 }),
      candidate({ id: "b", lastUsedAt: 30 }),
      candidate({ id: "c", lastUsedAt: 20 }),
      candidate({ id: "streaming", lastUsedAt: 1, isStreaming: true }),
    ]
    expect(selectSessionsToEvict(candidates, 3)).not.toContain("streaming")
    expect(selectSessionsToEvict(candidates, 3)).toEqual([])
  })

  it("never evicts a session parked on a pending question", () => {
    const candidates = [
      candidate({ id: "a", lastUsedAt: 40 }),
      candidate({ id: "b", lastUsedAt: 30 }),
      candidate({ id: "c", lastUsedAt: 20 }),
      candidate({ id: "asking", lastUsedAt: 1, hasPendingQuestion: true }),
    ]
    expect(selectSessionsToEvict(candidates, 3)).toEqual([])
  })

  it("protects the keepN most recently used regardless of order in the input", () => {
    const candidates = [
      candidate({ id: "old", lastUsedAt: 5 }),
      candidate({ id: "newest", lastUsedAt: 100 }),
      candidate({ id: "mid", lastUsedAt: 50 }),
      candidate({ id: "older", lastUsedAt: 1 }),
    ]
    expect(selectSessionsToEvict(candidates, 2)).toEqual(["old", "older"])
  })
})
