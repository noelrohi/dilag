import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Wrench } from "lucide-react";
import { CustomToolHeader } from "./tool-header";
import type { ToolRendererProps } from "./types";

export function GenericTool({ tool, state }: ToolRendererProps) {
  const input = state.status === "completed" ? state.input : {};
  const output = state.status === "completed" ? state.output : undefined;

  return (
    <Collapsible defaultOpen={false}>
      <CustomToolHeader icon={Wrench} title={tool} state={state} />
      <CollapsibleContent className="pl-5 pt-1 space-y-2">
        {Object.keys(input).length > 0 && (
          <pre className="text-xs text-muted-foreground">
            {JSON.stringify(input, null, 2).slice(0, 500)}
          </pre>
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
