import type { ToolUIPart } from "ai";
import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import type { ToolRendererProps } from "./types";

// Map OpenCode tool state to AI SDK ToolUIPart state
function mapState(state: ToolRendererProps["state"]): ToolUIPart["state"] {
  switch (state.status) {
    case "pending":
      return "input-streaming";
    case "running":
      return "input-available";
    case "completed":
      return "output-available";
    case "error":
      return "output-error";
  }
}

export function GenericTool({ tool, state }: ToolRendererProps) {
  const mappedState = mapState(state);
  const input = state.status === "completed" ? state.input : {};
  const output = state.status === "completed" ? state.output : undefined;
  const errorText = state.status === "error" ? state.error : undefined;

  return (
    <Tool defaultOpen={false}>
      <ToolHeader title={tool} type="tool-call" state={mappedState} />
      <ToolContent>
        <ToolInput input={input} />
        <ToolOutput output={output} errorText={errorText} />
      </ToolContent>
    </Tool>
  );
}
