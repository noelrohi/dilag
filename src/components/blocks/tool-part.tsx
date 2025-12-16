import { useState, useEffect } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronRightIcon } from "lucide-react";
import { getToolConfig, type ToolRenderProps } from "@/lib/tool-registry";
import type { ToolState } from "@/context/session-store";
import { cn } from "@/lib/utils";
import { Shimmer } from "@/components/ai-elements/shimmer";

interface ToolPartProps {
  tool: string;
  state: ToolState;
}

// Tools that should be expanded by default
const DEFAULT_OPEN_TOOLS = ["todowrite"];

export function ToolPart({ tool, state }: ToolPartProps) {
  const [elapsed, setElapsed] = useState(0);
  const config = getToolConfig(tool);
  const Icon = config.icon;
  const defaultOpen = DEFAULT_OPEN_TOOLS.includes(tool);

  // Timer for running tools
  useEffect(() => {
    if (state.status !== "running") {
      setElapsed(0);
      return;
    }
    const start = Date.now();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [state.status]);

  // Build render props from state
  const props: ToolRenderProps = {
    tool,
    input: state.input ?? {},
    output: state.status === "completed" ? state.output : undefined,
    error: state.status === "error" ? state.error : undefined,
    status: state.status,
  };

  const title = config.title(props);
  const subtitle = config.subtitle?.(props);
  const content = config.content?.(props);
  const hasContent = !!content || state.status === "error";

  return (
    <Collapsible defaultOpen={defaultOpen}>
      <CollapsibleTrigger
        className={cn(
          "group flex w-full items-center justify-between gap-2",
          "h-8 px-3 py-1.5 rounded-md",
          "bg-muted/30 border border-border/50",
          "text-sm select-none cursor-default",
          "hover:bg-muted/50 transition-colors"
        )}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Icon className="size-4 shrink-0 text-muted-foreground" />
          <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
            {state.status === "pending" ? (
              <Shimmer className="font-medium whitespace-nowrap" duration={1.5}>
                {title}
              </Shimmer>
            ) : (
              <span className="font-medium text-foreground whitespace-nowrap">
                {title}
              </span>
            )}
            {subtitle && (
              <span className="text-muted-foreground truncate">{subtitle}</span>
            )}
          </div>
          {state.status === "running" && elapsed > 0 && (
            <span className="text-xs tabular-nums text-muted-foreground shrink-0">
              {elapsed}s
            </span>
          )}
        </div>
        {hasContent && (
          <ChevronRightIcon
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform duration-150",
              "group-data-[state=open]:rotate-90"
            )}
          />
        )}
      </CollapsibleTrigger>

      {hasContent && (
        <CollapsibleContent className="px-3 py-2 max-h-60 overflow-y-auto border-t border-border/30 mt-px rounded-b-md bg-muted/20">
          {content}
          {state.status === "error" && state.error && (
            <p className="text-xs text-destructive mt-2">{state.error}</p>
          )}
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}
