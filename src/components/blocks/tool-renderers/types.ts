import type { ToolState } from "@/lib/opencode";

export interface ToolRendererProps {
  tool: string;
  state: ToolState;
}

export type ToolRendererComponent = React.ComponentType<ToolRendererProps>;
