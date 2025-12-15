import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Glasses } from "lucide-react";
import { getFilename } from "@/lib/path-utils";
import { CustomToolHeader } from "./tool-header";
import type { ToolRendererProps } from "./types";

export function ReadTool({ state }: ToolRendererProps) {
  const filePath =
    state.status === "completed"
      ? (state.input.file_path as string | undefined)
      : undefined;
  const output = state.status === "completed" ? state.output : undefined;

  return (
    <Collapsible defaultOpen={false}>
      <CustomToolHeader
        icon={Glasses}
        title="Read"
        subtitle={filePath ? getFilename(filePath) : undefined}
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
