import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Globe } from "lucide-react";
import { CustomToolHeader } from "./tool-header";
import type { ToolRendererProps } from "./types";

export function WebfetchTool({ state }: ToolRendererProps) {
  const url =
    state.status === "completed"
      ? (state.input.url as string | undefined)
      : undefined;
  const output = state.status === "completed" ? state.output : undefined;

  // Extract domain from URL for subtitle
  let subtitle = url;
  try {
    if (url) {
      const urlObj = new URL(url);
      subtitle = urlObj.hostname;
    }
  } catch {
    // Keep full URL if parsing fails
  }

  return (
    <Collapsible defaultOpen={false}>
      <CustomToolHeader
        icon={Globe}
        title="WebFetch"
        subtitle={subtitle}
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
