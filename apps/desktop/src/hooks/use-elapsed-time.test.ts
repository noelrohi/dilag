import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useElapsedTime } from "./use-elapsed-time"

describe("useElapsedTime", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(10_000)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("updates once per second while no end time is provided", () => {
    const { result } = renderHook(() => useElapsedTime(8_000))

    expect(result.current).toBe("2s")

    act(() => {
      vi.advanceTimersByTime(1_000)
    })

    expect(result.current).toBe("3s")
  })

  it("recomputes immediately when the start time changes", () => {
    const { result, rerender } = renderHook(({ startTime }) => useElapsedTime(startTime), {
      initialProps: { startTime: 8_000 },
    })

    expect(result.current).toBe("2s")

    rerender({ startTime: 5_000 })

    expect(result.current).toBe("5s")
  })

  it("freezes at the completed duration when an end time is provided", () => {
    const { result } = renderHook(() => useElapsedTime(8_000, 12_000))

    expect(result.current).toBe("4s")

    act(() => {
      vi.advanceTimersByTime(5_000)
    })

    expect(result.current).toBe("4s")
  })
})
