import { Tool, ToolContent, ToolOutput } from "@/components/ai-elements/tool";
import { Globe } from "lucide-react";
import { CustomToolHeader } from "./tool-header";
import type { ToolRendererProps } from "./types";

export function WebfetchTool({ state }: ToolRendererProps) {
  const url =
    state.status === "completed"
      ? (state.input.url as string | undefined)
      : undefined;

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
    <Tool defaultOpen={false}>
      <CustomToolHeader
        icon={Globe}
        title="WebFetch"
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
