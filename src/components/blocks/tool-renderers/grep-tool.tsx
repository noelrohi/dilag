import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Search } from "lucide-react";
import { CustomToolHeader } from "./tool-header";
import type { ToolRendererProps } from "./types";

export function GrepTool({ state }: ToolRendererProps) {
  const pattern =
    state.status === "completed"
      ? (state.input.pattern as string | undefined)
      : undefined;
  const output = state.status === "completed" ? state.output : undefined;

  return (
    <Collapsible defaultOpen={false}>
      <CustomToolHeader
        icon={Search}
        title="Grep"
        subtitle={pattern}
        state={state}
      />
      {output && (
        <CollapsibleContent className="pl-5 pt-1">
          <pre className="text-xs text-muted-foreground max-h-40 overflow-auto">
            {output.slice(0, 1000)}
            {output.length > 1000 && "..."}
          </pre>
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}
