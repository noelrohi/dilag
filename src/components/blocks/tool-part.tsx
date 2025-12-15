import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  CheckCircleIcon,
  ChevronRightIcon,
  Loader2Icon,
  XCircleIcon,
} from "lucide-react";
import { getToolConfig, type ToolRenderProps } from "@/lib/tool-registry";
import type { ToolState } from "@/lib/opencode";

interface ToolPartProps {
  tool: string;
  state: ToolState;
}

function StatusIcon({ status }: { status: ToolState["status"] }) {
  switch (status) {
    case "pending":
    case "running":
      return <Loader2Icon className="size-3 animate-spin text-muted-foreground" />;
    case "completed":
      return <CheckCircleIcon className="size-3 text-green-600" />;
    case "error":
      return <XCircleIcon className="size-3 text-red-600" />;
  }
}

export function ToolPart({ tool, state }: ToolPartProps) {
  const config = getToolConfig(tool);
  const Icon = config.icon;

  // Build render props from state
  const props: ToolRenderProps = {
    tool,
    input: state.status === "completed" ? state.input : {},
    output: state.status === "completed" ? state.output : undefined,
    error: state.status === "error" ? state.error : undefined,
    status: state.status,
  };

  const title = config.title(props);
  const subtitle = config.subtitle?.(props);
  const content = config.content?.(props);
  const hasContent = !!content || state.status === "error";

  return (
    <Collapsible defaultOpen={false}>
      <CollapsibleTrigger className="group flex w-full items-center gap-2 py-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        {hasContent && (
          <ChevronRightIcon className="size-3 shrink-0 transition-transform group-data-[state=open]:rotate-90" />
        )}
        {!hasContent && <span className="w-3" />}
        <Icon className="size-4 shrink-0" />
        <span className="font-medium text-foreground">{title}</span>
        {subtitle && (
          <span className="truncate text-muted-foreground">{subtitle}</span>
        )}
        <StatusIcon status={state.status} />
      </CollapsibleTrigger>

      {hasContent && (
        <CollapsibleContent className="pl-5 pt-1 space-y-2">
          {content}
          {state.status === "error" && (
            <p className="text-xs text-destructive">{state.error}</p>
          )}
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}
