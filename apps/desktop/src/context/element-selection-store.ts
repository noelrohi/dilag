import { create } from "zustand";

/**
 * Represents a selected or hovered element within an iframe preview
 */
export interface ElementInfo {
  /** The screen node ID (from React Flow) */
  screenId: string;
  /** CSS selector path to uniquely identify the element */
  selector: string;
  /** The element's outer HTML */
  html: string;
  /** Tag name (lowercase), e.g., "button", "div", "h1" */
  tagName: string;
  /** Bounding rect relative to the iframe content (before scaling) */
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Ancestor path from parent to root (e.g., ["div.container", "section", "main"]) */
  ancestorPath?: string[];
}

interface ElementSelectionState {
  /** Currently hovered element (for visual highlight) */
  hoveredElement: ElementInfo | null;
  /** Currently selected element (for editing) */
  selectedElement: ElementInfo | null;

  /** Set the hovered element */
  setHovered: (element: ElementInfo | null) => void;
  /** Set the selected element */
  setSelected: (element: ElementInfo | null) => void;
  /** Clear both hover and selection */
  clearAll: () => void;
  /** Clear selection only (keep hover) */
  clearSelection: () => void;
}

export const useElementSelectionStore = create<ElementSelectionState>((set) => ({
  hoveredElement: null,
  selectedElement: null,

  setHovered: (element) => set({ hoveredElement: element }),
  
  setSelected: (element) => set({ selectedElement: element }),
  
  clearAll: () => set({ hoveredElement: null, selectedElement: null }),
  
  clearSelection: () => set({ selectedElement: null }),
}));

// Selector hooks for optimized re-renders
export const useHoveredElement = () => 
  useElementSelectionStore((state) => state.hoveredElement);

export const useSelectedElement = () => 
  useElementSelectionStore((state) => state.selectedElement);

export const useIsElementSelected = (screenId: string, selector: string) =>
  useElementSelectionStore(
    (state) =>
      state.selectedElement?.screenId === screenId &&
      state.selectedElement?.selector === selector
  );

// Actions
export const useSetHoveredElement = () =>
  useElementSelectionStore((state) => state.setHovered);

export const useSetSelectedElement = () =>
  useElementSelectionStore((state) => state.setSelected);

export const useClearElementSelection = () =>
  useElementSelectionStore((state) => state.clearSelection);

export const useClearAllElementState = () =>
  useElementSelectionStore((state) => state.clearAll);
