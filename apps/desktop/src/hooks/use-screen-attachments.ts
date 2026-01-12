import { useEffect, useRef, useCallback } from "react";
import { nanoid } from "nanoid";
import type { DesignFile } from "./use-designs";
import { htmlToImageBlob } from "@/lib/html-to-image";

export type ScreenAttachment = {
  id: string;
  designId: string;
  title: string;
  url: string;
  mediaType: string;
  filename: string;
};

/**
 * Hook to manage screen attachments for the chat composer
 * Converts selected screens to image attachments
 */
export function useScreenAttachments(
  selectedIds: Set<string>,
  designs: DesignFile[],
  platform: "mobile" | "web" = "web",
  onAttachmentsChange?: (attachments: ScreenAttachment[]) => void
) {
  const attachmentsRef = useRef<Map<string, ScreenAttachment>>(new Map());
  const pendingRef = useRef<Set<string>>(new Set());

  // Capture a design as an image
  const captureDesign = useCallback(
    async (design: DesignFile): Promise<ScreenAttachment | null> => {
      try {
        const isMobile = platform === "mobile";
        const blob = await htmlToImageBlob(design.html, {
          width: isMobile ? 393 : 1280,
          height: isMobile ? 852 : 800,
          scale: 0.5,
        });

        const url = URL.createObjectURL(blob);
        return {
          id: nanoid(),
          designId: design.filename,
          title: design.title,
          url,
          mediaType: "image/png",
          filename: `${design.title.toLowerCase().replace(/\s+/g, "-")}.png`,
        };
      } catch (err) {
        console.error("Failed to capture design:", err);
        return null;
      }
    },
    [platform]
  );

  // Sync attachments with selected screens
  useEffect(() => {
    const currentAttachments = attachmentsRef.current;
    const selectedArray = Array.from(selectedIds);

    // Remove attachments for deselected screens
    for (const [designId, attachment] of currentAttachments) {
      if (!selectedIds.has(designId)) {
        URL.revokeObjectURL(attachment.url);
        currentAttachments.delete(designId);
      }
    }

    // Add attachments for newly selected screens
    const newSelections = selectedArray.filter(
      (id) => !currentAttachments.has(id) && !pendingRef.current.has(id)
    );

    if (newSelections.length > 0) {
      // Mark as pending to avoid duplicate processing
      newSelections.forEach((id) => pendingRef.current.add(id));

      Promise.all(
        newSelections.map(async (designId) => {
          const design = designs.find((d) => d.filename === designId);
          if (!design) {
            pendingRef.current.delete(designId);
            return;
          }

          const attachment = await captureDesign(design);
          pendingRef.current.delete(designId);

          if (attachment && selectedIds.has(designId)) {
            currentAttachments.set(designId, attachment);
          }
        })
      ).then(() => {
        // Notify of changes
        onAttachmentsChange?.(Array.from(currentAttachments.values()));
      });
    } else {
      // Notify of changes (for removals)
      onAttachmentsChange?.(Array.from(currentAttachments.values()));
    }
  }, [selectedIds, designs, captureDesign, onAttachmentsChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      for (const attachment of attachmentsRef.current.values()) {
        URL.revokeObjectURL(attachment.url);
      }
      attachmentsRef.current.clear();
    };
  }, []);

  return {
    attachments: Array.from(attachmentsRef.current.values()),
    clear: useCallback(() => {
      for (const attachment of attachmentsRef.current.values()) {
        URL.revokeObjectURL(attachment.url);
      }
      attachmentsRef.current.clear();
      onAttachmentsChange?.([]);
    }, [onAttachmentsChange]),
  };
}
