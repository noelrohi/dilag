import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { IPhoneFrame } from "@/components/blocks/preview/iphone-frame";
import { DilagIcon } from "@/components/blocks/branding/dilag-icon";
import { cn } from "@/lib/utils";

// Matches the dimensions used in screen-node.tsx
const WEB_WIDTH = 640;
const WEB_HEIGHT = 400;

export interface GhostScreenNodeData extends Record<string, unknown> {
  platform: "mobile" | "web";
}

function GhostScreenNodeComponent({ data }: NodeProps) {
  const { platform } = data as GhostScreenNodeData;
  const isMobile = platform === "mobile";

  const ghostContent = (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <div className="relative flex items-center justify-center size-14">
        <div className="absolute inset-0 rounded-2xl bg-primary/15 animate-pulse" />
        <div className="absolute -inset-2 rounded-2xl bg-primary/5 animate-ping [animation-duration:2s]" />
        <DilagIcon animated className="size-8 text-primary" />
      </div>
      <div className="flex flex-col items-center gap-2">
        <span className="text-sm font-medium text-foreground/70 animate-pulse">
          Designing...
        </span>
        <div className="flex gap-1.5">
          <span className="size-1.5 rounded-full bg-primary/50 animate-pulse [animation-delay:0ms]" />
          <span className="size-1.5 rounded-full bg-primary/50 animate-pulse [animation-delay:300ms]" />
          <span className="size-1.5 rounded-full bg-primary/50 animate-pulse [animation-delay:600ms]" />
        </div>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <div className="pointer-events-none select-none">
        <IPhoneFrame
          className="!bg-[#1a1a1a]/80"
          screenClassName="!bg-black/50"
        >
          <div
            className={cn(
              "w-full h-full rounded-[34px] overflow-hidden",
              "bg-muted/40 border-2 border-dashed border-primary/25",
              "animate-pulse [animation-duration:2.5s]",
            )}
          >
            {ghostContent}
          </div>
        </IPhoneFrame>
        <div className="mt-3 text-center">
          <div className="h-4 w-24 mx-auto rounded-md bg-muted-foreground/15 animate-pulse" />
        </div>
      </div>
    );
  }

  // Web platform ghost
  return (
    <div className="pointer-events-none select-none">
      {/* Browser chrome skeleton */}
      <div
        className={cn(
          "rounded-lg overflow-hidden",
          "border-2 border-dashed border-primary/25",
          "bg-muted/30",
          "shadow-sm shadow-primary/5",
        )}
        style={{ width: WEB_WIDTH, height: WEB_HEIGHT }}
      >
        {/* Fake title bar */}
        <div className="flex items-center gap-1.5 px-3 py-2 bg-muted/50 border-b border-primary/10">
          <div className="size-2.5 rounded-full bg-muted-foreground/20" />
          <div className="size-2.5 rounded-full bg-muted-foreground/20" />
          <div className="size-2.5 rounded-full bg-muted-foreground/20" />
          <div className="h-4 w-36 ml-3 rounded-md bg-muted-foreground/15 animate-pulse" />
        </div>
        {/* Content area */}
        <div className="flex-1 h-[calc(100%-36px)]">
          {ghostContent}
        </div>
      </div>
      <div className="mt-3 text-center">
        <div className="h-4 w-28 mx-auto rounded-md bg-muted-foreground/15 animate-pulse" />
      </div>
    </div>
  );
}

export const GhostScreenNode = memo(GhostScreenNodeComponent);
