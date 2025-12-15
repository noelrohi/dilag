import type { ReactNode } from "react";
import type { ToolState } from "./opencode";
import {
  Glasses,
  Terminal,
  Code2,
  FilePlus2,
  FolderSearch,
  Search,
  Globe,
  Bot,
  Wrench,
  type LucideIcon,
} from "lucide-react";

// Tool props passed to render functions
export interface ToolRenderProps {
  tool: string;
  input: Record<string, unknown>;
  output?: string;
  error?: string;
  status: ToolState["status"];
}

// Tool registration config
export interface ToolConfig {
  icon: LucideIcon;
  title: (props: ToolRenderProps) => string;
  subtitle?: (props: ToolRenderProps) => string | undefined;
  content?: (props: ToolRenderProps) => ReactNode;
}

// Extract common input fields
const getInput = (props: ToolRenderProps) => ({
  filePath: props.input.file_path as string | undefined,
  pattern: props.input.pattern as string | undefined,
  command: props.input.command as string | undefined,
  description: props.input.description as string | undefined,
  url: props.input.url as string | undefined,
  prompt: props.input.prompt as string | undefined,
  oldString: props.input.old_string as string | undefined,
  newString: props.input.new_string as string | undefined,
});

// Get filename from path
const filename = (path?: string) => path?.split("/").pop() || "";

// Tool registry - all tool configs in one place
export const TOOLS: Record<string, ToolConfig> = {
  Read: {
    icon: Glasses,
    title: () => "Read",
    subtitle: (p) => filename(getInput(p).filePath),
    content: (p) =>
      p.output && (
        <pre className="text-xs text-muted-foreground max-h-40 overflow-auto">
          {p.output.slice(0, 1000)}
          {p.output.length > 1000 && "..."}
        </pre>
      ),
  },

  Bash: {
    icon: Terminal,
    title: () => "Shell",
    subtitle: (p) => {
      const { description, command } = getInput(p);
      return description || command?.slice(0, 50);
    },
    content: (p) => {
      const { command } = getInput(p);
      return (
        <>
          {command && (
            <pre className="text-xs font-mono bg-muted/50 rounded px-2 py-1 overflow-x-auto">
              $ {command}
            </pre>
          )}
          {p.output && (
            <pre className="text-xs text-muted-foreground max-h-40 overflow-auto">
              {p.output.slice(0, 2000)}
              {p.output.length > 2000 && "..."}
            </pre>
          )}
        </>
      );
    },
  },

  Edit: {
    icon: Code2,
    title: () => "Edit",
    subtitle: (p) => filename(getInput(p).filePath),
    content: (p) => {
      const { oldString, newString } = getInput(p);
      return (
        <>
          {oldString && (
            <div>
              <span className="text-xs text-red-500 font-medium">- </span>
              <pre className="inline text-xs text-muted-foreground">
                {oldString.slice(0, 200)}
                {oldString.length > 200 && "..."}
              </pre>
            </div>
          )}
          {newString && (
            <div>
              <span className="text-xs text-green-500 font-medium">+ </span>
              <pre className="inline text-xs text-muted-foreground">
                {newString.slice(0, 200)}
                {newString.length > 200 && "..."}
              </pre>
            </div>
          )}
        </>
      );
    },
  },

  Write: {
    icon: FilePlus2,
    title: () => "Write",
    subtitle: (p) => filename(getInput(p).filePath),
  },

  Glob: {
    icon: FolderSearch,
    title: () => "Glob",
    subtitle: (p) => getInput(p).pattern,
    content: (p) =>
      p.output && (
        <pre className="text-xs text-muted-foreground max-h-40 overflow-auto">
          {p.output.slice(0, 1000)}
          {p.output.length > 1000 && "..."}
        </pre>
      ),
  },

  Grep: {
    icon: Search,
    title: () => "Grep",
    subtitle: (p) => getInput(p).pattern,
    content: (p) =>
      p.output && (
        <pre className="text-xs text-muted-foreground max-h-40 overflow-auto">
          {p.output.slice(0, 1000)}
          {p.output.length > 1000 && "..."}
        </pre>
      ),
  },

  WebFetch: {
    icon: Globe,
    title: () => "WebFetch",
    subtitle: (p) => {
      const url = getInput(p).url;
      try {
        return url ? new URL(url).hostname : undefined;
      } catch {
        return url;
      }
    },
    content: (p) =>
      p.output && (
        <pre className="text-xs text-muted-foreground max-h-40 overflow-auto">
          {p.output.slice(0, 1000)}
          {p.output.length > 1000 && "..."}
        </pre>
      ),
  },

  Task: {
    icon: Bot,
    title: () => "Task",
    subtitle: (p) => getInput(p).description,
    content: (p) => {
      const { prompt } = getInput(p);
      return (
        <>
          {prompt && (
            <p className="text-xs text-muted-foreground">
              {prompt.slice(0, 200)}
              {prompt.length > 200 && "..."}
            </p>
          )}
          {p.output && (
            <pre className="text-xs text-muted-foreground max-h-40 overflow-auto">
              {p.output.slice(0, 500)}
              {p.output.length > 500 && "..."}
            </pre>
          )}
        </>
      );
    },
  },
};

// Default config for unknown tools
export const DEFAULT_TOOL: ToolConfig = {
  icon: Wrench,
  title: (p) => p.tool,
  content: (p) => {
    const hasInput = Object.keys(p.input).length > 0;
    return (
      <>
        {hasInput && (
          <pre className="text-xs text-muted-foreground">
            {JSON.stringify(p.input, null, 2).slice(0, 500)}
          </pre>
        )}
        {p.output && (
          <pre className="text-xs text-muted-foreground max-h-40 overflow-auto">
            {p.output.slice(0, 500)}
            {p.output.length > 500 && "..."}
          </pre>
        )}
      </>
    );
  },
};

// Get tool config
export function getToolConfig(name: string): ToolConfig {
  return TOOLS[name] ?? DEFAULT_TOOL;
}
