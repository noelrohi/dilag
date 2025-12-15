import { Tool, ToolContent, ToolOutput } from "@/components/ai-elements/tool";
import { Glasses } from "lucide-react";
import { getFilename } from "@/lib/path-utils";
import { CustomToolHeader } from "./tool-header";
import type { ToolRendererProps } from "./types";

export function ReadTool({ state }: ToolRendererProps) {
  const filePath =
    state.status === "completed"
      ? (state.input.file_path as string | undefined)
      : undefined;

  return (
    <Tool defaultOpen={false}>
      <CustomToolHeader
        icon={Glasses}
        title="Read"
        subtitle={filePath ? getFilename(filePath) : undefined}
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
