import { useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

const STORAGE_KEY = "dilag-zoom-level";
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.0;

export function useZoom() {
  // Restore zoom level on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const level = parseFloat(stored);
      if (!isNaN(level) && level >= MIN_ZOOM && level <= MAX_ZOOM) {
        invoke("set_zoom_level", { level }).catch(console.error);
      }
    }
  }, []);

  // Listen for zoom changes from menu events and persist
  useEffect(() => {
    const unlisten = listen<number>("zoom-changed", (event) => {
      localStorage.setItem(STORAGE_KEY, String(event.payload));
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const zoomIn = useCallback(async () => {
    try {
      const level = await invoke<number>("zoom_in");
      localStorage.setItem(STORAGE_KEY, String(level));
      return level;
    } catch (error) {
      console.error("Failed to zoom in:", error);
    }
  }, []);

  const zoomOut = useCallback(async () => {
    try {
      const level = await invoke<number>("zoom_out");
      localStorage.setItem(STORAGE_KEY, String(level));
      return level;
    } catch (error) {
      console.error("Failed to zoom out:", error);
    }
  }, []);

  const resetZoom = useCallback(async () => {
    try {
      const level = await invoke<number>("zoom_reset");
      localStorage.setItem(STORAGE_KEY, String(level));
      return level;
    } catch (error) {
      console.error("Failed to reset zoom:", error);
    }
  }, []);

  const setZoom = useCallback(async (level: number) => {
    try {
      const actualLevel = await invoke<number>("set_zoom_level", { level });
      localStorage.setItem(STORAGE_KEY, String(actualLevel));
      return actualLevel;
    } catch (error) {
      console.error("Failed to set zoom:", error);
    }
  }, []);

  return { zoomIn, zoomOut, resetZoom, setZoom };
}
