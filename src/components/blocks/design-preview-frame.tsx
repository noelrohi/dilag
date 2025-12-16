import { useState } from "react";
import { Monitor, Tablet, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DesignScreen } from "@/context/session-store";

type Viewport = "desktop" | "tablet" | "mobile";

interface DesignPreviewFrameProps {
  design: DesignScreen | null;
}

export function DesignPreviewFrame({ design }: DesignPreviewFrameProps) {
  const [viewport, setViewport] = useState<Viewport>("desktop");

  if (!design) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        No design selected
      </div>
    );
  }

  // Set default viewport based on design type
  const effectiveViewport = design.type === "mobile" && viewport === "desktop" ? "mobile" : viewport;

  const viewportConfig = {
    desktop: { width: "100%", maxWidth: "none", label: "Desktop" },
    tablet: { width: "768px", maxWidth: "768px", label: "Tablet" },
    mobile: { width: "375px", maxWidth: "375px", label: "Mobile" },
  };

  const config = viewportConfig[effectiveViewport];

  return (
    <div className="flex flex-col h-full">
      {/* Viewport controls */}
      <div className="flex items-center justify-center gap-1 py-2 border-b bg-muted/30">
        <Button
          variant={effectiveViewport === "desktop" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setViewport("desktop")}
          className="h-7 w-7 p-0"
          title="Desktop view"
        >
          <Monitor className="size-4" />
        </Button>
        <Button
          variant={effectiveViewport === "tablet" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setViewport("tablet")}
          className="h-7 w-7 p-0"
          title="Tablet view"
        >
          <Tablet className="size-4" />
        </Button>
        <Button
          variant={effectiveViewport === "mobile" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setViewport("mobile")}
          className="h-7 w-7 p-0"
          title="Mobile view"
        >
          <Smartphone className="size-4" />
        </Button>
        <span className="ml-2 text-xs text-muted-foreground">{config.label}</span>
      </div>

      {/* Preview iframe */}
      <div className="flex-1 overflow-auto bg-muted/10 p-4">
        <div
          className={cn(
            "mx-auto bg-white rounded-lg shadow-lg overflow-hidden transition-all duration-300",
            effectiveViewport === "mobile" && "rounded-[2rem] border-[8px] border-zinc-800"
          )}
          style={{
            width: config.width,
            maxWidth: config.maxWidth,
            minHeight: effectiveViewport === "mobile" ? "667px" : "600px",
          }}
        >
          {/* Mobile notch */}
          {effectiveViewport === "mobile" && (
            <div className="h-6 bg-zinc-800 flex items-center justify-center">
              <div className="w-20 h-4 bg-black rounded-full" />
            </div>
          )}

          <iframe
            srcDoc={design.html}
            sandbox="allow-scripts allow-same-origin"
            className="w-full border-0"
            style={{
              height: effectiveViewport === "mobile" ? "calc(100% - 24px)" : "100%",
              minHeight: effectiveViewport === "mobile" ? "643px" : "600px",
            }}
            title={design.title}
          />
        </div>
      </div>
    </div>
  );
}
