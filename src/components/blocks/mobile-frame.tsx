import { GripVertical, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type FrameStatus = "generating" | "streaming" | "success" | "error";

interface MobileFrameProps {
  children: React.ReactNode;
  title: string;
  status?: FrameStatus;
  className?: string;
}

export function MobileFrame({ children, title, status, className }: MobileFrameProps) {
  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex items-center gap-2 mb-3 px-1">
        <GripVertical className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
        {(status === "generating" || status === "streaming") && (
          <Loader2 className="w-3.5 h-3.5 text-chart-1 animate-spin ml-auto" />
        )}
        {status === "success" && (
          <CheckCircle2 className="w-3.5 h-3.5 text-chart-2 ml-auto" />
        )}
        {status === "error" && (
          <AlertCircle className="w-3.5 h-3.5 text-destructive ml-auto" />
        )}
      </div>
      <IPhone14Frame status={status}>
        {status === "generating" ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-chart-1/10 to-card">
            <div className="w-12 h-12 rounded-full bg-chart-1/20 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-chart-1 animate-spin" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Generating...</p>
            <p className="text-xs text-muted-foreground/70">Creating {title} screen</p>
          </div>
        ) : status === "streaming" ? (
          <div className="relative h-full">
            {children}
            {/* Streaming overlay indicator */}
            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/60 to-transparent flex items-end justify-center pb-3">
              <div className="flex items-center gap-2 text-white/80 text-xs">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Streaming...</span>
              </div>
            </div>
          </div>
        ) : (
          children
        )}
      </IPhone14Frame>
    </div>
  );
}

interface IPhone14FrameProps {
  children: React.ReactNode;
  status?: FrameStatus;
  className?: string;
}

function IPhone14Frame({ children, status, className }: IPhone14FrameProps) {
  return (
    <div
      className={cn(
        "relative w-[280px] h-[572px] bg-[#1a1a1a] rounded-[44px] p-[10px] shadow-xl transition-all",
        // Outer highlight for realism
        "ring-1 ring-[#333] ring-inset",
        (status === "generating" || status === "streaming") && "ring-2 ring-chart-1/30",
        className
      )}
    >
      {/* Side button - right */}
      <div className="absolute -right-[2px] top-[120px] w-[3px] h-[32px] bg-[#1a1a1a] rounded-r-sm" />
      <div className="absolute -right-[2px] top-[170px] w-[3px] h-[60px] bg-[#1a1a1a] rounded-r-sm" />

      {/* Side buttons - left */}
      <div className="absolute -left-[2px] top-[100px] w-[3px] h-[28px] bg-[#1a1a1a] rounded-l-sm" />
      <div className="absolute -left-[2px] top-[145px] w-[3px] h-[50px] bg-[#1a1a1a] rounded-l-sm" />
      <div className="absolute -left-[2px] top-[205px] w-[3px] h-[50px] bg-[#1a1a1a] rounded-l-sm" />

      {/* Screen - exactly 260x552px content area */}
      <div className="relative w-[260px] h-[552px] bg-black rounded-[34px] overflow-hidden">
        {children}
      </div>
    </div>
  );
}
