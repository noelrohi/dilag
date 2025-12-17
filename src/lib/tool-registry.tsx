import type { ReactNode } from "react";
import type { ToolState } from "@/context/session-store";
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
  ListChecks,
  CheckSquare,
  Square,
  Paintbrush,
  type LucideIcon,
} from "lucide-react";
import { Streamdown } from "streamdown";
import { cn } from "@/lib/utils";


// Tool props passed to render functions
export interface ToolRenderProps {
  tool: string;
  input: Record<string, unknown>;
  output?: string;
  error?: string;
  status: ToolState["status"];
  metadata?: Record<string, unknown>;
}

// Tool registration config
export interface ToolConfig {
  icon: LucideIcon;
  title: (props: ToolRenderProps) => string;
  chipLabel?: (props: ToolRenderProps) => string | undefined;
  subtitle?: (props: ToolRenderProps) => ReactNode;
  content?: (props: ToolRenderProps) => ReactNode;
}

// Extract common input fields (try multiple possible keys)
const getInput = (props: ToolRenderProps) => ({
  filePath: (props.input.file_path ?? props.input.filePath ?? props.input.path ?? props.input.filename ?? props.input.file) as string | undefined,
  pattern: props.input.pattern as string | undefined,
  command: props.input.command as string | undefined,
  description: props.input.description as string | undefined,
  url: props.input.url as string | undefined,
  prompt: props.input.prompt as string | undefined,
  oldString: (props.input.old_string ?? props.input.oldString ?? props.input.old ?? props.input.before) as string | undefined,
  newString: (props.input.new_string ?? props.input.newString ?? props.input.new ?? props.input.after) as string | undefined,
  content: props.input.content as string | undefined,
});

// Get filename from path
const filename = (path?: string) => path?.split("/").pop() || "";

// Language map for file extensions
const LANG_MAP: Record<string, string> = {
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  py: "python",
  rb: "ruby",
  rs: "rust",
  go: "go",
  java: "java",
  kt: "kotlin",
  swift: "swift",
  c: "c",
  cpp: "cpp",
  h: "c",
  hpp: "cpp",
  cs: "csharp",
  php: "php",
  html: "html",
  css: "css",
  scss: "scss",
  less: "less",
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  md: "markdown",
  sql: "sql",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  fish: "fish",
  ps1: "powershell",
  dockerfile: "dockerfile",
  toml: "toml",
  xml: "xml",
  vue: "vue",
  svelte: "svelte",
};

// Get language from file extension for syntax highlighting
const getLanguage = (path?: string, content?: string): string => {
  // Try to detect from file extension first
  if (path) {
    const ext = path.split(".").pop()?.toLowerCase();
    if (ext && LANG_MAP[ext]) return LANG_MAP[ext];
  }

  // Fallback: detect from content
  if (content) {
    const trimmed = content.trimStart();
    if (trimmed.startsWith("<!DOCTYPE html") || trimmed.startsWith("<html")) return "html";
    if (trimmed.startsWith("<?xml")) return "xml";
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) return "json";
    if (trimmed.startsWith("<!-") && trimmed.includes("<template")) return "vue";
    if (trimmed.startsWith("---")) return "yaml";
    if (trimmed.startsWith("#!") && trimmed.includes("python")) return "python";
    if (trimmed.startsWith("#!") && (trimmed.includes("bash") || trimmed.includes("sh"))) return "bash";
    if (trimmed.startsWith("package ") && trimmed.includes("func ")) return "go";
    if (trimmed.startsWith("use ") || trimmed.includes("fn ")) return "rust";
  }

  return "text";
};

// Todo type
interface Todo {
  content: string;
  status: "pending" | "in_progress" | "completed";
}

// Tool registry - all tool configs in one place
// Note: Tool names from backend are lowercase
export const TOOLS: Record<string, ToolConfig> = {
  read: {
    icon: Glasses,
    title: () => "Read",
    chipLabel: (p) => filename(getInput(p).filePath),
    subtitle: (p) => {
      const file = filename(getInput(p).filePath);
      // Use metadata.preview if available (first 20 lines from backend)
      const preview = p.metadata?.preview as string | undefined;
      const lines = preview?.split("\n").length ?? p.output?.split("\n").length ?? 0;
      if (!file) return undefined;
      return lines > 0 ? `${file} (${lines} lines)` : file;
    },
    content: (p) => {
      const { filePath } = getInput(p);
      // Prefer metadata.preview for display (more concise)
      const content = (p.metadata?.preview as string) ?? p.output;
      if (!content) return null;

      const lang = getLanguage(filePath, content);
      const truncated = content.length > 3000 ? content.slice(0, 3000) + "\n// ... truncated" : content;
      const markdown = "```" + lang + "\n" + truncated + "\n```";

      return (
        <div className="text-xs [&_pre]:!bg-transparent [&_code]:!bg-transparent [&_pre]:!m-0 [&_pre]:!p-0">
          <Streamdown>{markdown}</Streamdown>
        </div>
      );
    },
  },

  edit: {
    icon: Code2,
    title: () => "Edit",
    chipLabel: (p) => filename(getInput(p).filePath),
    subtitle: (p) => {
      const { filePath } = getInput(p);
      const file = filename(filePath);
      const filediff = p.metadata?.filediff as { additions?: number; deletions?: number } | undefined;
      if (!file && !filediff) return undefined;
      return (
        <>
          {file}{" "}
          {filediff && (
            <>
              <span className="text-green-500">+{filediff.additions ?? 0}</span>{" "}
              <span className="text-red-500">-{filediff.deletions ?? 0}</span>
            </>
          )}
        </>
      );
    },
    content: (p) => {
      const diff = p.metadata?.diff as string | undefined;
      if (!diff) return null;

      const markdown = "```diff\n" + diff + "\n```";
      return (
        <div className="text-xs [&_pre]:!bg-transparent [&_code]:!bg-transparent [&_pre]:!m-0 [&_pre]:!p-0">
          <Streamdown>{markdown}</Streamdown>
        </div>
      );
    },
  },

  bash: {
    icon: Terminal,
    title: () => "Shell",
    chipLabel: (p) => {
      // metadata.description is set by backend
      const desc = p.metadata?.description as string | undefined;
      const { description, command } = getInput(p);
      if (desc) return desc.slice(0, 25);
      if (description) return description.slice(0, 25);
      if (command) return command.slice(0, 20);
      return undefined;
    },
    subtitle: (p) => {
      const desc = p.metadata?.description as string | undefined;
      const { description, command } = getInput(p);
      const exit = p.metadata?.exit as number | null | undefined;
      const exitIndicator = exit !== undefined && exit !== null && exit !== 0 
        ? <span className="text-red-500 ml-1">(exit {exit})</span> 
        : null;
      return (
        <>
          {desc || description || command?.slice(0, 50)}
          {exitIndicator}
        </>
      );
    },
    content: (p) => {
      const { command } = getInput(p);
      // metadata.output contains the streamed output
      const output = (p.metadata?.output as string) ?? p.output;
      return (
        <>
          {command && (
            <pre className="text-xs font-mono bg-muted/50 rounded px-2 py-1 overflow-x-auto">
              $ {command}
            </pre>
          )}
          {output && (
            <pre className="text-xs text-muted-foreground max-h-40 overflow-auto">
              {output.slice(0, 2000)}
              {output.length > 2000 && "..."}
            </pre>
          )}
        </>
      );
    },
  },

  write: {
    icon: FilePlus2,
    title: () => "Write",
    chipLabel: (p) => filename(getInput(p).filePath),
    subtitle: (p) => {
      const { filePath, content } = getInput(p);
      const file = filename(filePath);
      const lines = content?.split("\n").length ?? 0;
      if (!file && lines === 0) return undefined;
      return (
        <>
          {file || "file"}{" "}
          <span className="text-green-500">+{lines}</span>
        </>
      );
    },
    content: (p) => {
      const { filePath, content } = getInput(p);
      if (!content) return null;

      const lang = getLanguage(filePath, content);
      const truncated = content.length > 3000 ? content.slice(0, 3000) + "\n// ... truncated" : content;
      const markdown = "```" + lang + "\n" + truncated + "\n```";

      return (
        <div className="text-xs [&_pre]:!bg-transparent [&_code]:!bg-transparent [&_pre]:!m-0 [&_pre]:!p-0">
          <Streamdown>{markdown}</Streamdown>
        </div>
      );
    },
  },

  todowrite: {
    icon: ListChecks,
    title: () => "To-dos",
    subtitle: (p) => {
      const todos = p.input.todos as Todo[] | undefined;
      if (!todos?.length) return undefined;
      const completed = todos.filter((t) => t.status === "completed").length;
      return `${completed}/${todos.length}`;
    },
    content: (p) => {
      const todos = p.input.todos as Todo[] | undefined;
      if (!todos?.length) return null;
      return (
        <div className="space-y-1">
          {todos.map((todo, i) => (
            <div key={i} className="flex items-start gap-2">
              {todo.status === "completed" ? (
                <CheckSquare className="size-4 shrink-0 text-emerald-500 mt-0.5" />
              ) : (
                <Square className="size-4 shrink-0 text-muted-foreground mt-0.5" />
              )}
              <span
                className={
                  todo.status === "completed"
                    ? "text-sm text-muted-foreground line-through"
                    : "text-sm text-foreground"
                }
              >
                {todo.content}
              </span>
            </div>
          ))}
        </div>
      );
    },
  },

  glob: {
    icon: FolderSearch,
    title: () => "Glob",
    chipLabel: (p) => getInput(p).pattern?.slice(0, 20),
    subtitle: (p) => {
      const pattern = getInput(p).pattern;
      const count = p.metadata?.count as number | undefined;
      const truncated = p.metadata?.truncated as boolean | undefined;
      if (count !== undefined) {
        return (
          <>
            {pattern}{" "}
            <span className="text-muted-foreground">
              ({count} files{truncated ? "+" : ""})
            </span>
          </>
        );
      }
      return pattern;
    },
    content: (p) =>
      p.output && (
        <pre className="text-xs text-muted-foreground max-h-40 overflow-auto">
          {p.output.slice(0, 1000)}
          {p.output.length > 1000 && "..."}
        </pre>
      ),
  },

  list: {
    icon: FolderSearch,
    title: () => "List",
    chipLabel: (p) => filename(getInput(p).filePath) || "directory",
    subtitle: (p) => {
      const { filePath } = getInput(p);
      const count = p.metadata?.count as number | undefined;
      const truncated = p.metadata?.truncated as boolean | undefined;
      const path = filePath ? filename(filePath) || filePath : "directory";
      if (count !== undefined) {
        return (
          <>
            {path}{" "}
            <span className="text-muted-foreground">
              ({count} items{truncated ? "+" : ""})
            </span>
          </>
        );
      }
      return path;
    },
    content: (p) =>
      p.output && (
        <pre className="text-xs text-muted-foreground max-h-40 overflow-auto font-mono">
          {p.output.slice(0, 1500)}
          {p.output.length > 1500 && "..."}
        </pre>
      ),
  },

  grep: {
    icon: Search,
    title: () => "Grep",
    chipLabel: (p) => getInput(p).pattern?.slice(0, 20),
    subtitle: (p) => {
      const pattern = getInput(p).pattern;
      const matches = p.metadata?.matches as number | undefined;
      const truncated = p.metadata?.truncated as boolean | undefined;
      if (matches !== undefined) {
        return (
          <>
            {pattern}{" "}
            <span className="text-muted-foreground">
              ({matches} matches{truncated ? "+" : ""})
            </span>
          </>
        );
      }
      return pattern;
    },
    content: (p) =>
      p.output && (
        <pre className="text-xs text-muted-foreground max-h-40 overflow-auto">
          {p.output.slice(0, 1000)}
          {p.output.length > 1000 && "..."}
        </pre>
      ),
  },

  webfetch: {
    icon: Globe,
    title: () => "Fetch",
    chipLabel: (p) => {
      const url = getInput(p).url;
      try {
        return url ? new URL(url).hostname : undefined;
      } catch {
        return url?.slice(0, 20);
      }
    },
    subtitle: (p) => {
      const { url, prompt } = getInput(p);
      // Show hostname and prompt summary
      let hostname = "";
      try {
        hostname = url ? new URL(url).hostname : "";
      } catch {
        hostname = url?.slice(0, 30) ?? "";
      }
      const promptSummary = prompt ? ` - "${prompt.slice(0, 40)}${prompt.length > 40 ? "..." : ""}"` : "";
      return hostname + promptSummary;
    },
    content: (p) => {
      const { url, prompt } = getInput(p);
      return (
        <div className="space-y-2">
          {url && (
            <div className="text-xs">
              <span className="text-muted-foreground/60">URL: </span>
              <span className="text-blue-400/80 break-all">{url}</span>
            </div>
          )}
          {prompt && (
            <div className="text-xs">
              <span className="text-muted-foreground/60">Prompt: </span>
              <span className="text-foreground/80">{prompt}</span>
            </div>
          )}
          {p.output && (
            <div className="mt-2 pt-2 border-t border-border/30">
              <pre className="text-xs text-muted-foreground max-h-48 overflow-auto whitespace-pre-wrap">
                {p.output.slice(0, 2000)}{p.output.length > 2000 && "\n..."}
              </pre>
            </div>
          )}
        </div>
      );
    },
  },

  task: {
    icon: Bot,
    title: () => "Task",
    chipLabel: (p) => getInput(p).description?.slice(0, 25),
    subtitle: (p) => {
      const { description } = getInput(p);
      const summary = p.metadata?.summary as Array<{ tool: string; state: { status: string } }> | undefined;
      if (summary?.length) {
        const completed = summary.filter(s => s.state.status === "completed").length;
        return (
          <>
            {description}{" "}
            <span className="text-muted-foreground">
              ({completed}/{summary.length} tools)
            </span>
          </>
        );
      }
      return description;
    },
    content: (p) => {
      const { prompt } = getInput(p);
      const summary = p.metadata?.summary as Array<{ id: string; tool: string; state: { status: string; title?: string } }> | undefined;
      
      return (
        <div className="space-y-2">
          {prompt && (
            <p className="text-xs text-muted-foreground">
              {prompt.slice(0, 200)}
              {prompt.length > 200 && "..."}
            </p>
          )}
          {summary && summary.length > 0 && (
            <div className="space-y-1 pt-1 border-t border-border/30">
              {summary.map((s) => (
                <div key={s.id} className="flex items-center gap-2 text-xs">
                  <span className={cn(
                    "size-1.5 rounded-full",
                    s.state.status === "completed" ? "bg-green-500" :
                    s.state.status === "error" ? "bg-red-500" :
                    s.state.status === "running" ? "bg-yellow-500" : "bg-muted-foreground"
                  )} />
                  <span className="text-muted-foreground">{s.tool}</span>
                  {s.state.title && (
                    <span className="text-foreground/70 truncate">{s.state.title}</span>
                  )}
                </div>
              ))}
            </div>
          )}
          {p.output && !summary && (
            <pre className="text-xs text-muted-foreground max-h-40 overflow-auto">
              {p.output.slice(0, 500)}
              {p.output.length > 500 && "..."}
            </pre>
          )}
        </div>
      );
    },
  },

  theme: {
    icon: Paintbrush,
    title: () => "Theme",
    chipLabel: (p) => {
      const name = p.input.name as string | undefined;
      return name?.slice(0, 20);
    },
    subtitle: (p) => {
      const name = p.input.name as string | undefined;
      const style = p.input.style as string | undefined;
      return (
        <>
          <Paintbrush className="size-3 inline mr-1 text-primary" />
          <span className="text-primary">{name ?? "Theme"}</span>
          {style && <span className="text-muted-foreground ml-1">({style})</span>}
        </>
      );
    },
    content: (p) => {
      const name = p.input.name as string | undefined;
      const style = p.input.style as string | undefined;

      // Extract color values from flat input
      const colorKeys = ['primary', 'secondary', 'accent', 'background', 'muted', 'card', 'border', 'destructive'];
      const colors = colorKeys
        .map(key => ({ key, value: p.input[key] as string }))
        .filter(c => c.value);

      if (colors.length === 0) {
        return (
          <div className="text-xs text-muted-foreground">
            Creating theme...
          </div>
        );
      }

      return (
        <div className="space-y-3">
          <div className="text-xs text-primary/70">
            {name} - {style} style
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {colors.map(({ key, value }) => (
              <div
                key={key}
                className="aspect-square rounded-md border shadow-sm"
                style={{ backgroundColor: value }}
                title={`${key}: ${value}`}
              />
            ))}
          </div>
        </div>
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
