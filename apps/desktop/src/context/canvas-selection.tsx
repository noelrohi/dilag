import { createContext, useContext, type ReactNode } from "react";
import type { DesignFile } from "@/hooks/use-designs";

interface CanvasSelectionContextValue {
  selectedIds: Set<string>;
  designs: DesignFile[];
  platform: "mobile" | "web";
  clearSelection: () => void;
}

const CanvasSelectionContext = createContext<CanvasSelectionContextValue | null>(null);

export function CanvasSelectionProvider({
  selectedIds,
  designs,
  platform,
  clearSelection,
  children,
}: CanvasSelectionContextValue & { children: ReactNode }) {
  return (
    <CanvasSelectionContext.Provider
      value={{ selectedIds, designs, platform, clearSelection }}
    >
      {children}
    </CanvasSelectionContext.Provider>
  );
}

export function useCanvasSelection() {
  const context = useContext(CanvasSelectionContext);
  if (!context) {
    throw new Error("useCanvasSelection must be used within CanvasSelectionProvider");
  }
  return context;
}

export function useOptionalCanvasSelection() {
  return useContext(CanvasSelectionContext);
}
