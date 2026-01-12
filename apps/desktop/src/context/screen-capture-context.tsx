import { createContext, useContext, useCallback, useState, type ReactNode } from "react";
import type { DesignFile } from "@/hooks/use-designs";
import { useAttachmentBridge } from "@/context/attachment-bridge";
import { toast } from "sonner";

interface ScreenCaptureContextValue {
  /**
   * Add a screen reference to the chat composer.
   * Returns true if added successfully, false if screen was already referenced.
   */
  captureAndAttach: (design: DesignFile) => Promise<boolean>;
  
  /**
   * Check if a specific screen is currently being captured.
   */
  isCapturing: (screenId: string) => boolean;
  
  /**
   * Check if a screen is already referenced (by filename).
   */
  isAttached: (screenId: string) => boolean;
  
  /**
   * Platform type for determining capture dimensions.
   */
  platform: "mobile" | "web";
}

const ScreenCaptureContext = createContext<ScreenCaptureContextValue | null>(null);

interface ScreenCaptureProviderProps {
  children: ReactNode;
  platform: "mobile" | "web";
}

export function ScreenCaptureProvider({ children, platform }: ScreenCaptureProviderProps) {
  const { addScreenRef } = useAttachmentBridge();
  
  // Track referenced screen IDs locally (filenames without extension)
  const [referencedScreens, setReferencedScreens] = useState<Set<string>>(new Set());

  const isAttached = useCallback((screenId: string) => {
    const id = screenId.replace(".html", "");
    return referencedScreens.has(id);
  }, [referencedScreens]);

  // No longer doing async capture, so always returns false
  const isCapturing = useCallback((_screenId: string) => {
    return false;
  }, []);

  const captureAndAttach = useCallback(async (design: DesignFile): Promise<boolean> => {
    const screenId = design.filename.replace(".html", "");
    
    // Check if already referenced
    if (referencedScreens.has(screenId)) {
      toast.info(`"${design.title}" is already in chat`);
      return false;
    }

    try {
      // Add as a screen reference instead of file attachment
      addScreenRef({
        filename: design.filename,
        title: design.title,
        html: design.html,
      });
      setReferencedScreens(prev => new Set([...prev, screenId]));
      toast.success(`"${design.title}" added to chat`);
      return true;
    } catch (err) {
      console.error("Failed to add screen to chat:", err);
      toast.error(`Failed to add "${design.title}"`);
      return false;
    }
  }, [addScreenRef, referencedScreens]);

  const value: ScreenCaptureContextValue = {
    captureAndAttach,
    isCapturing,
    isAttached,
    platform,
  };

  return (
    <ScreenCaptureContext.Provider value={value}>
      {children}
    </ScreenCaptureContext.Provider>
  );
}

export function useScreenCaptureContext() {
  const context = useContext(ScreenCaptureContext);
  if (!context) {
    throw new Error("useScreenCaptureContext must be used within a ScreenCaptureProvider");
  }
  return context;
}

/**
 * Optional version that returns null if not within provider.
 * Useful for components that may be used outside the capture context.
 */
export function useOptionalScreenCaptureContext() {
  return useContext(ScreenCaptureContext);
}
