import { useEffect, useState, useSyncExternalStore } from "react"
import dayjs from "dayjs"
import duration from "dayjs/plugin/duration"

dayjs.extend(duration)

function formatDuration(ms: number): string {
  const d = dayjs.duration(ms)
  const seconds = Math.floor(d.asSeconds())

  if (seconds < 60) {
    return `${seconds}s`
  }

  const minutes = Math.floor(d.asMinutes())
  const remainingSeconds = seconds % 60
  return `${minutes}m ${remainingSeconds}s`
}

let currentNow = Date.now()
let interval: ReturnType<typeof setInterval> | null = null
const listeners = new Set<() => void>()

function subscribeToElapsedTicker(listener: () => void) {
  listeners.add(listener)

  if (!interval) {
    currentNow = Date.now()
    interval = setInterval(() => {
      currentNow = Date.now()
      listeners.forEach((notify) => notify())
    }, 1000)
  }

  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && interval) {
      clearInterval(interval)
      interval = null
    }
  }
}

function getElapsedSnapshot() {
  return currentNow
}

export function useElapsedTime(startTime: number, endTime?: number): string {
  const now = useSyncExternalStore(subscribeToElapsedTicker, getElapsedSnapshot, getElapsedSnapshot)
  const end = endTime ?? now
  const [elapsed, setElapsed] = useState(() => formatDuration(end - startTime))

  useEffect(() => {
    setElapsed(formatDuration(end - startTime))
  }, [startTime, end])

  return elapsed
}
