import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useCurrentSession } from "@/context/session-store";

export interface DesignFile {
  filename: string;
  title: string;
  screen_type: "mobile" | "web";
  html: string;
  modified_at: number;
}

async function loadSessionDesigns(sessionCwd: string): Promise<DesignFile[]> {
  return invoke<DesignFile[]>("load_session_designs", { sessionCwd });
}

export function useDesigns() {
  const session = useCurrentSession();
  const [designs, setDesigns] = useState<DesignFile[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"preview" | "code">("preview");

  const refresh = useCallback(async () => {
    if (!session?.cwd) {
      setDesigns([]);
      return;
    }

    setIsLoading(true);
    try {
      const files = await loadSessionDesigns(session.cwd);
      setDesigns(files);
      // Reset active index if out of bounds
      if (activeIndex >= files.length && files.length > 0) {
        setActiveIndex(files.length - 1);
      }
    } catch (err) {
      console.error("Failed to load designs:", err);
      setDesigns([]);
    } finally {
      setIsLoading(false);
    }
  }, [session?.cwd, activeIndex]);

  // Load designs when session changes
  useEffect(() => {
    refresh();
  }, [session?.cwd]);

  // Poll for new designs while session is active
  useEffect(() => {
    if (!session?.cwd) return;

    const interval = setInterval(refresh, 2000); // Poll every 2 seconds
    return () => clearInterval(interval);
  }, [session?.cwd, refresh]);

  const activeDesign = designs[activeIndex] ?? null;

  return {
    designs,
    activeDesign,
    activeIndex,
    setActiveIndex,
    viewMode,
    setViewMode,
    isLoading,
    refresh,
  };
}
