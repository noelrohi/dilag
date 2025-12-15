import { Tool, ToolContent, ToolOutput } from "@/components/ai-elements/tool";
import { Search } from "lucide-react";
import { CustomToolHeader } from "./tool-header";
import type { ToolRendererProps } from "./types";

export function GrepTool({ state }: ToolRendererProps) {
  const pattern =
    state.status === "completed"
      ? (state.input.pattern as string | undefined)
      : undefined;

  return (
    <Tool defaultOpen={false}>
      <CustomToolHeader
        icon={Search}
        title="Grep"
        subtitle={pattern}
        state={state}
      />
      <ToolContent>
        <ToolOutput
          output={state.status === "completed" ? state.output : undefined}
          errorText={state.status === "error" ? state.error : undefined}
        />
      </ToolContent>
    </Tool>
  );
}
