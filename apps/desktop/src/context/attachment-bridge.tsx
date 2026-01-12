import { createContext, useContext, useRef, useCallback, type ReactNode, type RefObject } from "react";
import type { ScreenReference } from "@/components/ai-elements/prompt-input";

type AddAttachmentFn = (files: File[]) => void;
type AddScreenRefFn = (ref: Omit<ScreenReference, "id">) => void;

interface AttachmentBridgeContextValue {
  /** Register the attachment add function from PromptInputProvider */
  registerAddAttachment: (fn: AddAttachmentFn) => void;
  /** Add files to attachments (calls the registered function) */
  addAttachment: (files: File[]) => void;
  /** Check if the bridge is connected */
  isConnected: () => boolean;
  /** Ref for external access */
  addAttachmentRef: RefObject<AddAttachmentFn | null>;
  /** Register the screen reference add function from PromptInputProvider */
  registerAddScreenRef: (fn: AddScreenRefFn) => void;
  /** Add a screen reference (calls the registered function) */
  addScreenRef: (ref: Omit<ScreenReference, "id">) => void;
  /** Ref for external access */
  addScreenRefRef: RefObject<AddScreenRefFn | null>;
}

const AttachmentBridgeContext = createContext<AttachmentBridgeContextValue | null>(null);

interface AttachmentBridgeProviderProps {
  children: ReactNode;
}

/**
 * Provides a bridge for adding attachments and screen references from outside the PromptInputProvider.
 * 
 * The chat panel should call `registerAddAttachment` and `registerAddScreenRef` with the respective functions.
 * Other panels can then use `addAttachment` or `addScreenRef` to add content.
 */
export function AttachmentBridgeProvider({ children }: AttachmentBridgeProviderProps) {
  const addAttachmentRef = useRef<AddAttachmentFn | null>(null);
  const addScreenRefRef = useRef<AddScreenRefFn | null>(null);

  const registerAddAttachment = useCallback((fn: AddAttachmentFn) => {
    addAttachmentRef.current = fn;
  }, []);

  const addAttachment = useCallback((files: File[]) => {
    if (addAttachmentRef.current) {
      addAttachmentRef.current(files);
    } else {
      console.warn("AttachmentBridge: No attachment handler registered yet");
    }
  }, []);

  const registerAddScreenRef = useCallback((fn: AddScreenRefFn) => {
    addScreenRefRef.current = fn;
  }, []);

  const addScreenRef = useCallback((ref: Omit<ScreenReference, "id">) => {
    if (addScreenRefRef.current) {
      addScreenRefRef.current(ref);
    } else {
      console.warn("AttachmentBridge: No screen ref handler registered yet");
    }
  }, []);

  const isConnected = useCallback(() => {
    return addAttachmentRef.current !== null;
  }, []);

  const value: AttachmentBridgeContextValue = {
    registerAddAttachment,
    addAttachment,
    isConnected,
    addAttachmentRef,
    registerAddScreenRef,
    addScreenRef,
    addScreenRefRef,
  };

  return (
    <AttachmentBridgeContext.Provider value={value}>
      {children}
    </AttachmentBridgeContext.Provider>
  );
}

export function useAttachmentBridge() {
  const context = useContext(AttachmentBridgeContext);
  if (!context) {
    throw new Error("useAttachmentBridge must be used within an AttachmentBridgeProvider");
  }
  return context;
}

export function useOptionalAttachmentBridge() {
  return useContext(AttachmentBridgeContext);
}
