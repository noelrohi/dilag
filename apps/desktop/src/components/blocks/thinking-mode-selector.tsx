import { Button } from "@/components/ui/button";
import { useModels } from "@/hooks/use-models";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Colors for different thinking levels
const variantColors: Record<string, string> = {
  low: "bg-blue-400",
  high: "bg-amber-400",
  max: "bg-rose-400",
};

interface ThinkingModeSelectorProps {
  className?: string;
}

export function ThinkingModeSelector({ className }: ThinkingModeSelectorProps) {
  const { variantList, currentVariant, cycleVariant } = useModels();

  // Don't show if no variants available
  if (variantList.length === 0) {
    return null;
  }

  const displayLabel = currentVariant ?? "Default";
  const dotColor = currentVariant ? variantColors[currentVariant] ?? "bg-primary" : "bg-muted-foreground/50";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          onClick={cycleVariant}
          className={cn("h-8 gap-2 px-2.5 text-xs", className)}
        >
          <div className={cn("size-2 rounded-full", dotColor)} />
          <span className="capitalize font-medium">{displayLabel}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p>Thinking effort (click to cycle)</p>
      </TooltipContent>
    </Tooltip>
  );
}
