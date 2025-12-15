import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Bot } from "lucide-react";
import { CustomToolHeader } from "./tool-header";
import type { ToolRendererProps } from "./types";

export function TaskTool({ state }: ToolRendererProps) {
  const description =
    state.status === "completed"
      ? (state.input.description as string | undefined)
      : undefined;
  const prompt =
    state.status === "completed"
      ? (state.input.prompt as string | undefined)
      : undefined;
  const output = state.status === "completed" ? state.output : undefined;

  return (
    <Collapsible defaultOpen={false}>
      <CustomToolHeader
        icon={Bot}
        title="Task"
        subtitle={description}
        state={state}
      />
      <CollapsibleContent className="pl-5 pt-1 space-y-2">
        {prompt && (
          <p className="text-xs text-muted-foreground">
            {prompt.slice(0, 200)}
            {prompt.length > 200 && "..."}
          </p>
        )}
        {output && (
          <pre className="text-xs text-muted-foreground max-h-40 overflow-auto">
            {output.slice(0, 500)}
            {output.length > 500 && "..."}
          </pre>
        )}
        {state.status === "error" && (
          <p className="text-xs text-destructive">{state.error}</p>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
