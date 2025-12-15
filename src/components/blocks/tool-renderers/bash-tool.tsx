import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Terminal } from "lucide-react";
import { CustomToolHeader } from "./tool-header";
import type { ToolRendererProps } from "./types";

export function BashTool({ state }: ToolRendererProps) {
  const command =
    state.status === "completed"
      ? (state.input.command as string | undefined)
      : undefined;
  const description =
    state.status === "completed"
      ? (state.input.description as string | undefined)
      : undefined;
  const output = state.status === "completed" ? state.output : undefined;

  return (
    <Collapsible defaultOpen={false}>
      <CustomToolHeader
        icon={Terminal}
        title="Shell"
        subtitle={description || command?.slice(0, 50)}
        state={state}
      />
      <CollapsibleContent className="pl-5 pt-1 space-y-2">
        {command && (
          <pre className="text-xs font-mono bg-muted/50 rounded px-2 py-1 overflow-x-auto">
            $ {command}
          </pre>
        )}
        {output && (
          <pre className="text-xs text-muted-foreground max-h-40 overflow-auto">
            {output.slice(0, 2000)}
            {output.length > 2000 && "..."}
          </pre>
        )}
        {state.status === "error" && (
          <p className="text-xs text-destructive">{state.error}</p>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
