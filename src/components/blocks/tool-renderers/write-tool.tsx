import { Collapsible } from "@/components/ui/collapsible";
import { FilePlus2 } from "lucide-react";
import { getFilename } from "@/lib/path-utils";
import { CustomToolHeader } from "./tool-header";
import type { ToolRendererProps } from "./types";

export function WriteTool({ state }: ToolRendererProps) {
  const filePath =
    state.status === "completed"
      ? (state.input.file_path as string | undefined)
      : undefined;

  return (
    <Collapsible defaultOpen={false}>
      <CustomToolHeader
        icon={FilePlus2}
        title="Write"
        subtitle={filePath ? getFilename(filePath) : undefined}
        state={state}
      />
    </Collapsible>
  );
}
