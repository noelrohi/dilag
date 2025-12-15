import { Tool, ToolContent, ToolOutput } from "@/components/ai-elements/tool";
import { CodeBlock } from "@/components/ai-elements/code-block";
import { Code2 } from "lucide-react";
import { getFilename, getDirectory } from "@/lib/path-utils";
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

  const subtitle = filePath
    ? `${getDirectory(filePath)}${getFilename(filePath)}`
    : undefined;

  return (
    <Tool defaultOpen={false}>
      <CustomToolHeader
        icon={Code2}
        title="Edit"
        subtitle={subtitle}
        state={state}
      />
      <ToolContent>
        {(oldString || newString) && (
          <div className="p-4 space-y-4">
            {oldString && (
              <div>
                <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide mb-2">
                  Old
                </h4>
                <div className="rounded-md bg-red-500/10">
                  <CodeBlock code={oldString} language="diff" />
                </div>
              </div>
            )}
            {newString && (
              <div>
                <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide mb-2">
                  New
                </h4>
                <div className="rounded-md bg-green-500/10">
                  <CodeBlock code={newString} language="diff" />
                </div>
              </div>
            )}
          </div>
        )}
        <ToolOutput
          output={state.status === "completed" ? state.output : undefined}
          errorText={state.status === "error" ? state.error : undefined}
        />
      </ToolContent>
    </Tool>
  );
}
