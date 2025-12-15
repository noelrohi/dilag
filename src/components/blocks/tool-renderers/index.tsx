import type { ToolRendererComponent } from "./types";
import { ReadTool } from "./read-tool";
import { BashTool } from "./bash-tool";
import { EditTool } from "./edit-tool";
import { WriteTool } from "./write-tool";
import { GlobTool } from "./glob-tool";
import { GrepTool } from "./grep-tool";
import { WebfetchTool } from "./webfetch-tool";
import { GenericTool } from "./generic-tool";

export const TOOL_RENDERERS: Record<string, ToolRendererComponent> = {
  Read: ReadTool,
  Bash: BashTool,
  Edit: EditTool,
  Write: WriteTool,
  Glob: GlobTool,
  Grep: GrepTool,
  WebFetch: WebfetchTool,
  // Fallback is GenericTool for unknown tools
};

export function getToolRenderer(toolName: string): ToolRendererComponent {
  return TOOL_RENDERERS[toolName] ?? GenericTool;
}

export { GenericTool } from "./generic-tool";
export type { ToolRendererProps, ToolRendererComponent } from "./types";
