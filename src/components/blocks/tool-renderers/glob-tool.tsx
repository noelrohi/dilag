import { Tool, ToolContent, ToolOutput } from "@/components/ai-elements/tool";
import { FolderSearch } from "lucide-react";
import { CustomToolHeader } from "./tool-header";
import type { ToolRendererProps } from "./types";

export function GlobTool({ state }: ToolRendererProps) {
  const pattern =
    state.status === "completed"
      ? (state.input.pattern as string | undefined)
      : undefined;

  return (
    <Tool defaultOpen={false}>
      <CustomToolHeader
        icon={FolderSearch}
        title="Glob"
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
