import { invoke } from "@tauri-apps/api/core";
import { useCallback, useState } from "react";
import { htmlToImageFile } from "@/lib/html-to-image";

interface CaptureOptions {
  width: number;
  height: number;
  scale?: number;
}

/**
 * Hook for capturing HTML screens as images.
 * 
 * Uses native Rust capture on macOS (WKWebView) with fallback
 * to html2canvas for other platforms or on failure.
 */
export function useScreenCapture() {
  const [isCapturing, setIsCapturing] = useState<string | null>(null);

  /**
   * Capture HTML content as a File object suitable for attachments.
   * 
   * @param html - The HTML content to capture
   * @param title - The title/filename for the resulting image
   * @param options - Capture dimensions
   * @returns A File object containing the PNG image
   */
  const captureScreen = useCallback(async (
    html: string,
    title: string,
    options: CaptureOptions
  ): Promise<File> => {
    const { width, height, scale = 0.5 } = options;

    try {
      // Try native Rust capture first (macOS only)
      const pngBytes = await invoke<number[]>("capture_html_to_image", {
        html,
        width,
        height,
        scale,
      });

      // Convert number array to Uint8Array
      const uint8Array = new Uint8Array(pngBytes);
      const blob = new Blob([uint8Array], { type: "image/png" });
      return new File([blob], `${title}.png`, { type: "image/png" });
    } catch (err) {
      console.warn("Native capture failed, falling back to html2canvas:", err);
      
      // Fallback to html2canvas
      return htmlToImageFile(html, title, {
        width,
        height,
        scale,
      });
    }
  }, []);

  /**
   * Capture a screen and track loading state by screen ID.
   */
  const captureWithLoading = useCallback(async (
    screenId: string,
    html: string,
    title: string,
    options: CaptureOptions
  ): Promise<File> => {
    setIsCapturing(screenId);
    try {
      return await captureScreen(html, title, options);
    } finally {
      setIsCapturing(null);
    }
  }, [captureScreen]);

  return {
    captureScreen,
    captureWithLoading,
    isCapturing,
    isCapturingScreen: (id: string) => isCapturing === id,
  };
}
