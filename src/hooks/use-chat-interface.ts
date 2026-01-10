import { create } from "zustand";

/**
 * Store for cross-component chat communication.
 * Allows components like the error overlay to send messages to the chat input.
 */
interface ChatInterfaceState {
  pendingMessage: string | null;
  setPendingMessage: (message: string | null) => void;
}

export const useChatInterfaceStore = create<ChatInterfaceState>((set) => ({
  pendingMessage: null,
  setPendingMessage: (message) => set({ pendingMessage: message }),
}));

/**
 * Hook to send error messages to the chat.
 * Formats the error with a code block and request for help.
 */
export function useSendToChat() {
  const setPendingMessage = useChatInterfaceStore(
    (state) => state.setPendingMessage
  );

  return (
    errorText: string,
    prefix = "I'm getting the following server error:\n\n"
  ) => {
    const message = `${prefix}\`\`\`\n${errorText}\n\`\`\`\n\nPlease help me fix this error.`;
    setPendingMessage(message);
  };
}

/**
 * Hook to consume pending messages.
 * Used by the chat input component.
 */
export function usePendingMessage() {
  const pendingMessage = useChatInterfaceStore((state) => state.pendingMessage);
  const clearPendingMessage = useChatInterfaceStore(
    (state) => state.setPendingMessage
  );

  return {
    pendingMessage,
    clearPendingMessage: () => clearPendingMessage(null),
  };
}
