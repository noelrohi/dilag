import { useCallback, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from "@dilag/ui/dialog";
import { Button } from "@dilag/ui/button";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { DesignFile } from "@/hooks/use-designs";
import { cn } from "@/lib/utils";
import { IPhoneFrame } from "./iphone-frame";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";

interface PreviewCarouselProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  designs: DesignFile[];
  initialIndex?: number;
  platform?: "mobile" | "web";
}

export function PreviewCarousel({
  open,
  onOpenChange,
  designs,
  initialIndex = 0,
  platform = "web",
}: PreviewCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  // Reset index when designs change or dialog opens
  useEffect(() => {
    if (open) {
      setCurrentIndex(Math.min(initialIndex, designs.length - 1));
    }
  }, [open, initialIndex, designs.length]);

  const currentDesign = designs[currentIndex];

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % designs.length);
  }, [designs.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + designs.length) % designs.length);
  }, [designs.length]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        goPrev();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, goNext, goPrev]);

  if (!currentDesign) return null;

  const isMobile = platform === "mobile";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(e) => e.stopPropagation()}
        className={cn(
          "p-0 gap-0 border-border/50 overflow-hidden",
          "bg-zinc-950/98 backdrop-blur-xl",
          // Full-width for immersive preview - override default max-w
          "!max-w-[96vw] w-[96vw] max-h-[94vh] h-[94vh]",
          // Custom animation
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:scale-95 data-[state=open]:scale-100",
          "duration-200"
        )}
      >
        {/* Accessibility - hidden title for screen readers */}
        <VisuallyHidden.Root>
          <DialogTitle>Preview: {currentDesign.title}</DialogTitle>
          <DialogDescription>
            Previewing design {currentIndex + 1} of {designs.length}
          </DialogDescription>
        </VisuallyHidden.Root>

        {/* Main preview area */}
        <div className="flex flex-col h-full">
          {/* Header bar */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
            <div className="flex items-center gap-3">
              {/* Page indicator dots */}
              {designs.length > 1 && (
                <div className="flex items-center gap-1.5">
                  {designs.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentIndex(index)}
                      className={cn(
                        "size-2 rounded-full transition-all duration-200",
                        index === currentIndex
                          ? "bg-white w-5"
                          : "bg-white/25 hover:bg-white/40"
                      )}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Screen title */}
            <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
              <span className="text-sm font-medium text-white/90 tracking-tight">
                {currentDesign.title}
              </span>
              {designs.length > 1 && (
                <span className="text-xs text-white/40 tabular-nums">
                  {currentIndex + 1} / {designs.length}
                </span>
              )}
            </div>

            {/* Close button */}
            <DialogClose asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-white/60 hover:text-white hover:bg-white/10"
              >
                <X className="size-4" />
                <span className="sr-only">Close</span>
              </Button>
            </DialogClose>
          </div>

          {/* Preview viewport */}
          <div className="flex-1 flex items-center justify-center relative p-6 min-h-0">
            {/* Navigation buttons */}
            {designs.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "absolute left-4 z-10",
                    "size-10 rounded-full",
                    "bg-white/5 hover:bg-white/10 border border-white/10",
                    "text-white/60 hover:text-white",
                    "transition-all duration-200",
                    "backdrop-blur-sm"
                  )}
                  onClick={goPrev}
                >
                  <ChevronLeft className="size-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "absolute right-4 z-10",
                    "size-10 rounded-full",
                    "bg-white/5 hover:bg-white/10 border border-white/10",
                    "text-white/60 hover:text-white",
                    "transition-all duration-200",
                    "backdrop-blur-sm"
                  )}
                  onClick={goNext}
                >
                  <ChevronRight className="size-5" />
                </Button>
              </>
            )}

            {/* Device frame */}
            <div
              className={cn(
                "relative transition-all duration-300 ease-out",
                "flex items-center justify-center"
              )}
            >
              {isMobile ? (
                // Mobile device frame - same as canvas, no extra scaling
                <div className="transform-gpu">
                  <IPhoneFrame>
                    <iframe
                      srcDoc={currentDesign.html}
                      className="w-full h-full border-0"
                      sandbox="allow-scripts"
                      title={currentDesign.title}
                      style={{
                        width: 393,
                        height: 852,
                        transform: "scale(0.663)",
                        transformOrigin: "top left",
                      }}
                    />
                  </IPhoneFrame>
                </div>
              ) : (
                // Desktop frame - 1500:865 native, scaled to fit
                <div
                  className={cn(
                    "relative bg-card rounded-lg overflow-hidden",
                    "shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_25px_50px_-12px_rgba(0,0,0,0.8)]"
                  )}
                  style={{
                    width: 1000,
                    height: 577, // 1000 * 865 / 1500
                  }}
                >
                  <iframe
                    srcDoc={currentDesign.html}
                    className="border-0"
                    sandbox="allow-scripts"
                    title={currentDesign.title}
                    style={{
                      width: 1500,
                      height: 865,
                      transform: `scale(${1000 / 1500})`,
                      transformOrigin: "top left",
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Screen selector strip */}
          {designs.length > 1 && (
            <div className="px-5 py-3 border-t border-white/[0.06]">
              <div className="flex items-center justify-center gap-2 overflow-x-auto">
                {designs.map((design, index) => (
                  <button
                    key={design.filename}
                    onClick={() => setCurrentIndex(index)}
                    className={cn(
                      "flex-shrink-0 px-3 py-1.5 rounded-md transition-all duration-200",
                      "text-xs font-medium truncate max-w-[120px]",
                      index === currentIndex
                        ? "bg-white/15 text-white"
                        : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70"
                    )}
                  >
                    {design.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
