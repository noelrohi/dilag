import {
  Task,
  TaskTrigger,
  TaskContent,
  TaskItem,
} from "@/components/ai-elements/task";
import type { ToolRendererProps } from "./types";

export function TaskTool({ state }: ToolRendererProps) {
  const description =
    state.status === "completed"
      ? (state.input.description as string | undefined)
      : undefined;
  const prompt =
    state.status === "completed"
      ? (state.input.prompt as string | undefined)
      : undefined;
  const output = state.status === "completed" ? state.output : undefined;

  return (
    <Task defaultOpen={false}>
      <TaskTrigger title={description || "Running task..."} />
      <TaskContent>
        {prompt && (
          <TaskItem>
            <span className="font-medium">Prompt:</span> {prompt.slice(0, 200)}
            {prompt.length > 200 && "..."}
          </TaskItem>
        )}
        {output && (
          <TaskItem>
            <span className="font-medium">Output:</span> {output.slice(0, 500)}
            {output.length > 500 && "..."}
          </TaskItem>
        )}
        {state.status === "error" && (
          <TaskItem className="text-destructive">
            <span className="font-medium">Error:</span> {state.error}
          </TaskItem>
        )}
      </TaskContent>
    </Task>
  );
}
