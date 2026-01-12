import { useCallback } from "react";
import { X, MessageSquarePlus, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DesignFile } from "@/hooks/use-designs";
import { useProviderAttachments } from "@/components/ai-elements/prompt-input";
import { toast } from "sonner";

interface SelectedScreensBarProps {
  selectedIds: Set<string>;
  designs: DesignFile[];
  onClearSelection: () => void;
  className?: string;
}

export function SelectedScreensBar({
  selectedIds,
  designs,
  onClearSelection,
  className,
}: SelectedScreensBarProps) {
  const attachments = useProviderAttachments();

  const selectedDesigns = designs.filter((d) => selectedIds.has(d.filename));
  const count = selectedDesigns.length;

  const handleAttach = useCallback(() => {
    if (count === 0) return;

    try {
      // Create HTML files from the designs
      const files = selectedDesigns.map((design) => {
        const blob = new Blob([design.html], { type: "text/html" });
        return new File([blob], design.filename, { type: "text/html" });
      });

      // Add files to attachments
      attachments.add(files);
      toast.success(`Added ${files.length} screen${files.length > 1 ? "s" : ""} to chat`);
      onClearSelection();
    } catch (err) {
      console.error("Failed to add screens to chat:", err);
      toast.error("Failed to add screens to chat");
    }
  }, [count, selectedDesigns, attachments, onClearSelection]);

  if (count === 0) return null;

  // Get first few screen names for preview
  const previewNames = selectedDesigns.slice(0, 2).map((d) => d.title);
  const moreCount = count - previewNames.length;

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 bg-muted/50 border border-border rounded-xl",
        className
      )}
    >
      <div className="flex items-center justify-center size-8 rounded-lg bg-primary/10">
        <Layers className="size-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {count} screen{count > 1 ? "s" : ""} selected
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {previewNames.join(", ")}
          {moreCount > 0 && ` +${moreCount} more`}
        </p>
      </div>
      <Button
        variant="default"
        size="sm"
        className="h-8 px-3 text-xs gap-1.5 rounded-lg"
        onClick={handleAttach}
      >
        <MessageSquarePlus className="size-3.5" />
        Add to chat
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-8 text-muted-foreground hover:text-foreground"
        onClick={onClearSelection}
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}
