import { Tool, ToolContent, ToolOutput } from "@/components/ai-elements/tool";
import { FilePlus2 } from "lucide-react";
import { getFilename, getDirectory } from "@/lib/path-utils";
import { CustomToolHeader } from "./tool-header";
import type { ToolRendererProps } from "./types";

export function WriteTool({ state }: ToolRendererProps) {
  const filePath =
    state.status === "completed"
      ? (state.input.file_path as string | undefined)
      : undefined;

  const subtitle = filePath
    ? `${getDirectory(filePath)}${getFilename(filePath)}`
    : undefined;

  return (
    <Tool defaultOpen={false}>
      <CustomToolHeader
        icon={FilePlus2}
        title="Write"
        subtitle={subtitle}
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
