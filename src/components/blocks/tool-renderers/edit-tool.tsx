import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Code2 } from "lucide-react";
import { getFilename } from "@/lib/path-utils";
import { CustomToolHeader } from "./tool-header";
import type { ToolRendererProps } from "./types";

export function EditTool({ state }: ToolRendererProps) {
  const filePath =
    state.status === "completed"
      ? (state.input.file_path as string | undefined)
      : undefined;
  const oldString =
    state.status === "completed"
      ? (state.input.old_string as string | undefined)
      : undefined;
  const newString =
    state.status === "completed"
      ? (state.input.new_string as string | undefined)
      : undefined;

  return (
    <Collapsible defaultOpen={false}>
      <CustomToolHeader
        icon={Code2}
        title="Edit"
        subtitle={filePath ? getFilename(filePath) : undefined}
        state={state}
      />
      <CollapsibleContent className="pl-5 pt-1 space-y-2">
        {oldString && (
          <div>
            <span className="text-xs text-red-500 font-medium">- </span>
            <pre className="inline text-xs text-muted-foreground">
              {oldString.slice(0, 200)}
              {oldString.length > 200 && "..."}
            </pre>
          </div>
        )}
        {newString && (
          <div>
            <span className="text-xs text-green-500 font-medium">+ </span>
            <pre className="inline text-xs text-muted-foreground">
              {newString.slice(0, 200)}
              {newString.length > 200 && "..."}
            </pre>
          </div>
        )}
        {state.status === "error" && (
          <p className="text-xs text-destructive">{state.error}</p>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
