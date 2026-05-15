import { useEffect, useCallback } from "react"
import { bridge } from "@/lib/bridge"

const STORAGE_KEY = "dilag-zoom-level"
const MIN_ZOOM = 0.5
const MAX_ZOOM = 2.0

export function useZoom() {
  // Restore zoom level on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const level = parseFloat(stored)
      if (!isNaN(level) && level >= MIN_ZOOM && level <= MAX_ZOOM) {
        bridge.zoom.set({ level }).catch(console.error)
      }
    }
  }, [])

  // Listen for zoom changes from menu events and persist
  useEffect(() => {
    const unsubscribe = bridge.zoom.onChange((level) => {
      localStorage.setItem(STORAGE_KEY, String(level))
    })
    return unsubscribe
  }, [])

  const zoomIn = useCallback(async () => {
    try {
      const level = await bridge.zoom.in()
      localStorage.setItem(STORAGE_KEY, String(level))
      return level
    } catch (error) {
      console.error("Failed to zoom in:", error)
    }
  }, [])

  const zoomOut = useCallback(async () => {
    try {
      const level = await bridge.zoom.out()
      localStorage.setItem(STORAGE_KEY, String(level))
      return level
    } catch (error) {
      console.error("Failed to zoom out:", error)
    }
  }, [])

  const resetZoom = useCallback(async () => {
    try {
      const level = await bridge.zoom.reset()
      localStorage.setItem(STORAGE_KEY, String(level))
      return level
    } catch (error) {
      console.error("Failed to reset zoom:", error)
    }
  }, [])

  const setZoom = useCallback(async (level: number) => {
    try {
      const actualLevel = await bridge.zoom.set({ level })
      localStorage.setItem(STORAGE_KEY, String(actualLevel))
      return actualLevel
    } catch (error) {
      console.error("Failed to set zoom:", error)
    }
  }, [])

  return { zoomIn, zoomOut, resetZoom, setZoom }
}
