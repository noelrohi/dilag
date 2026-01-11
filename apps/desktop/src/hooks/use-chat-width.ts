import { useState, useCallback } from "react";

const STORAGE_KEY = "dilag-studio-chat-size";
const DEFAULT_SIZE = 35; // ~400px on typical screen
const MIN_SIZE = 20; // ~280px minimum

export function useChatWidth() {
  const [size, setSize] = useState<number>(() => {
    if (typeof window === "undefined") return DEFAULT_SIZE;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = parseFloat(stored);
      // Only use stored value if it's reasonable (at least MIN_SIZE)
      if (!isNaN(parsed) && parsed >= MIN_SIZE && parsed <= 60) {
        return parsed;
      }
      // Clear invalid stored value
      localStorage.removeItem(STORAGE_KEY);
    }
    return DEFAULT_SIZE;
  });

  const updateSize = useCallback((newSize: number) => {
    if (newSize >= MIN_SIZE) {
      setSize(newSize);
      localStorage.setItem(STORAGE_KEY, String(newSize));
    }
  }, []);

  return { size, updateSize, defaultSize: DEFAULT_SIZE, minSize: MIN_SIZE };
}
