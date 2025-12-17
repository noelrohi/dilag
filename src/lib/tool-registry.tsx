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
  Palette,
  Paintbrush,
  type LucideIcon,
} from "lucide-react";
import { Streamdown } from "streamdown";
import { createPatch } from "diff";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { AnimatePresence, motion } from "motion/react";

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

// Design skeleton for generating state
function DesignSkeleton() {
  return (
    <div className="space-y-2">
      <div className="h-32 rounded-lg border border-primary/20 overflow-hidden bg-muted/30 animate-pulse">
        <div className="p-3 space-y-2">
          {/* Header skeleton */}
          <div className="flex gap-2">
            <div className="w-8 h-8 rounded bg-primary/10" />
            <div className="flex-1 space-y-1">
              <div className="h-3 w-24 rounded bg-primary/10" />
              <div className="h-2 w-16 rounded bg-muted" />
            </div>
          </div>
          {/* Content skeleton */}
          <div className="space-y-1.5 mt-3">
            <div className="h-2 w-full rounded bg-muted" />
            <div className="h-2 w-3/4 rounded bg-muted" />
            <div className="h-2 w-1/2 rounded bg-muted" />
          </div>
        </div>
      </div>
    </div>
  );
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
      const lines = p.output?.split("\n").length ?? 0;
      if (!file) return undefined;
      return lines > 0 ? `${file} (${lines} lines)` : file;
    },
    content: (p) => {
      const { filePath } = getInput(p);
      if (!p.output) return null;

      const lang = getLanguage(filePath, p.output);
      const truncated = p.output.length > 3000 ? p.output.slice(0, 3000) + "\n// ... truncated" : p.output;
      const markdown = "```" + lang + "\n" + truncated + "\n```";

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
      const { description, command } = getInput(p);
      if (description) return description.slice(0, 25);
      if (command) return command.slice(0, 20);
      return undefined;
    },
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

  edit: {
    icon: Code2,
    title: () => "Edit",
    chipLabel: (p) => filename(getInput(p).filePath),
    subtitle: (p) => {
      const { filePath, oldString, newString } = getInput(p);
      const file = filename(filePath);
      const oldLines = oldString?.split("\n").length ?? 0;
      const newLines = newString?.split("\n").length ?? 0;
      if (!file && oldLines === 0 && newLines === 0) return undefined;
      return (
        <>
          {file}{" "}
          <span className="text-green-500">+{newLines}</span>{" "}
          <span className="text-red-500">-{oldLines}</span>
        </>
      );
    },
    content: (p) => {
      const { filePath, oldString, newString } = getInput(p);

      // If we have old/new strings, generate a diff
      if (oldString || newString) {
        const patch = createPatch(
          filename(filePath) || "file",
          oldString || "",
          newString || "",
          "",
          "",
          { context: 3 }
        );

        // Remove the first 4 lines (header) and format as diff code block
        const diffLines = patch.split("\n").slice(4).join("\n");
        if (diffLines.trim()) {
          const markdown = "```diff\n" + diffLines + "\n```";
          return (
            <div className="text-xs [&_pre]:!bg-transparent [&_code]:!bg-transparent [&_pre]:!m-0 [&_pre]:!p-0">
              <Streamdown>{markdown}</Streamdown>
            </div>
          );
        }
      }

      // Fallback: show raw input if available
      const hasInput = Object.keys(p.input).length > 0;
      if (!hasInput) return null;

      return (
        <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
          {JSON.stringify(p.input, null, 2).slice(0, 1000)}
        </pre>
      );
    },
  },

  write: {
    icon: FilePlus2,
    title: (p) => {
      const { filePath } = getInput(p);
      // Show "Design" for HTML files (design outputs)
      if (filePath?.endsWith(".html")) return "Design";
      return "Write";
    },
    chipLabel: (p) => {
      const { filePath, content } = getInput(p);
      // For HTML files, try to get title from data-title attribute
      if (filePath?.endsWith(".html") && content) {
        const titleMatch = content.match(/data-title=["']([^"']+)["']/);
        if (titleMatch) return titleMatch[1].slice(0, 25);
      }
      return filename(filePath);
    },
    subtitle: (p) => {
      const { filePath, content } = getInput(p);
      const file = filename(filePath);

      // For HTML files (design outputs)
      if (filePath?.endsWith(".html")) {
        // Extract title from data-title attribute or filename
        const titleMatch = content?.match(/data-title=["']([^"']+)["']/);
        const title = titleMatch?.[1] ?? file?.replace(".html", "");

        // Design generation state - show "Generating {title}..."
        if (p.status === "pending" || p.status === "running") {
          const shimmerText = title ? `Generating ${title}...` : "Generating design...";
          return (
            <Shimmer className="text-primary" duration={1.5}>
              {shimmerText}
            </Shimmer>
          );
        }

        // Completed state - show title with icon
        return (
          <>
            <Palette className="size-3 inline mr-1 text-primary" />
            <span className="text-primary">{title}</span>
          </>
        );
      }

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

      // For HTML files (design outputs)
      if (filePath?.endsWith(".html")) {
        const isGenerating = !content || p.status === "pending" || p.status === "running";

        // Progressive reveal: show partial content during streaming
        if (content && p.status === "running") {
          return (
            <div className="space-y-2">
              <div className="h-32 rounded-lg border border-primary/30 overflow-hidden bg-white relative">
                <iframe
                  srcDoc={content}
                  sandbox="allow-scripts"
                  className="w-full h-full scale-50 origin-top-left pointer-events-none"
                  style={{ width: "200%", height: "200%" }}
                  title="Design preview"
                />
                {/* Overlay shimmer to indicate still loading */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent animate-pulse" />
              </div>
            </div>
          );
        }

        return (
          <AnimatePresence mode="wait">
            {isGenerating ? (
              <motion.div
                key="skeleton"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <DesignSkeleton />
              </motion.div>
            ) : (
              <motion.div
                key="preview"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <div className="space-y-2">
                  <div className="text-xs text-primary/70">
                    Design output - view in preview panel
                  </div>
                  <div className="h-32 rounded-lg border overflow-hidden bg-white">
                    <iframe
                      srcDoc={content}
                      sandbox="allow-scripts"
                      className="w-full h-full scale-50 origin-top-left pointer-events-none"
                      style={{ width: "200%", height: "200%" }}
                      title="Design preview"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        );
      }

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
    subtitle: (p) => getInput(p).pattern,
    content: (p) =>
      p.output && (
        <pre className="text-xs text-muted-foreground max-h-40 overflow-auto">
          {p.output.slice(0, 1000)}
          {p.output.length > 1000 && "..."}
        </pre>
      ),
  },

  grep: {
    icon: Search,
    title: () => "Grep",
    chipLabel: (p) => getInput(p).pattern?.slice(0, 20),
    subtitle: (p) => getInput(p).pattern,
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

  design: {
    icon: Palette,
    title: () => "Design",
    chipLabel: (p) => {
      const title = p.input.title as string | undefined;
      return title?.slice(0, 25);
    },
    subtitle: (p) => {
      const title = p.input.title as string | undefined;
      const type = p.input.type as string | undefined;
      return (
        <>
          <Palette className="size-3 inline mr-1 text-primary" />
          <span className="text-primary">{title ?? "Design"}</span>
          {type && <span className="text-muted-foreground ml-1">({type})</span>}
        </>
      );
    },
    content: (p) => {
      const html = p.input.html as string | undefined;
      const title = p.input.title as string | undefined;

      if (!html) {
        return (
          <div className="text-xs text-muted-foreground">
            Creating design...
          </div>
        );
      }

      return (
        <div className="space-y-2">
          <div className="text-xs text-primary/70">
            {title ?? "Design"} - view in preview panel
          </div>
          <div className="h-32 rounded-lg border overflow-hidden bg-white">
            <iframe
              srcDoc={html}
              sandbox="allow-scripts"
              className="w-full h-full scale-50 origin-top-left pointer-events-none"
              style={{ width: "200%", height: "200%" }}
              title="Design preview"
            />
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
