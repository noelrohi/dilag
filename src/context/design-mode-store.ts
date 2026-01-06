import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type WebViewport = "desktop" | "tablet" | "mobile";

export const VIEWPORT_SIZES: Record<WebViewport, { width: number; height: number; label: string }> = {
  desktop: { width: 1280, height: 800, label: "Desktop" },
  tablet: { width: 768, height: 1024, label: "Tablet" },
  mobile: { width: 390, height: 844, label: "Mobile" },
};

interface ViewportState {
  webViewport: WebViewport;
  setWebViewport: (viewport: WebViewport) => void;
}

export const useViewportStore = create<ViewportState>()(
  persist(
    (set) => ({
      webViewport: "desktop",
      setWebViewport: (viewport) => set({ webViewport: viewport }),
    }),
    {
      name: "dilag-viewport",
      storage: createJSONStorage(() => localStorage),
    }
  )
);

export const useWebViewport = () => useViewportStore((state) => state.webViewport);
export const useSetWebViewport = () => useViewportStore((state) => state.setWebViewport);
