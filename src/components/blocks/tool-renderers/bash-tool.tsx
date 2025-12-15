import { Tool, ToolContent, ToolOutput } from "@/components/ai-elements/tool";
import { CodeBlock } from "@/components/ai-elements/code-block";
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

  return (
    <Tool defaultOpen={false}>
      <CustomToolHeader
        icon={Terminal}
        title="Shell"
        subtitle={description || command?.slice(0, 50)}
        state={state}
      />
      <ToolContent>
        {command && (
          <div className="p-4">
            <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide mb-2">
              Command
            </h4>
            <CodeBlock code={command} language="bash" />
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
