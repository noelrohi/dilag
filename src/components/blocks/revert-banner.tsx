import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface RevertBannerProps {
  onUnrevert: () => void;
  className?: string;
}

export function RevertBanner({ onUnrevert, className }: RevertBannerProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-3 px-4 py-1.5",
        "bg-amber-500/8 border-b border-amber-500/15",
        className
      )}
    >
      <span className="text-xs text-amber-400/70">
        Session reverted
      </span>
      <button
        onClick={onUnrevert}
        className="flex items-center gap-1.5 text-xs text-amber-400/90 hover:text-amber-300 transition-colors"
      >
        <RotateCcw className="size-3" />
        Undo
      </button>
    </div>
  );
}
