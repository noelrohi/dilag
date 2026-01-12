import { useEffect } from "react";
import { useProviderAttachments, useProviderScreenRefs } from "@/components/ai-elements/prompt-input";
import { useOptionalAttachmentBridge } from "@/context/attachment-bridge";

/**
 * Connects the PromptInputProvider's attachment and screen refs systems to the AttachmentBridge.
 * 
 * Place this component inside both PromptInputProvider and AttachmentBridgeProvider
 * to enable adding attachments and screen references from outside the chat panel.
 */
export function AttachmentBridgeConnector() {
  const attachments = useProviderAttachments();
  const screenRefs = useProviderScreenRefs();
  const bridge = useOptionalAttachmentBridge();

  useEffect(() => {
    if (bridge) {
      bridge.registerAddAttachment(attachments.add);
      bridge.registerAddScreenRef(screenRefs.add);
    }
  }, [bridge, attachments.add, screenRefs.add]);

  // This component renders nothing
  return null;
}
