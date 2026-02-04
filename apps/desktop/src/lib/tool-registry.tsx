import type { ReactNode, FC } from "react";
import type { ToolState } from "@/context/session-store";
import {
  Monitor,
  Magnifer,
  Global,
  Glasses,
  Code,
  AddSquare,
  FolderPathConnect,
  Bolt,
  Settings,
  ClipboardList,
  CheckSquare,
  Record,
  Pallete2,
  MagicStick,
  QuestionCircle,
} from "@solar-icons/react";
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

// Structured subtitle with truncatable and fixed parts
export interface StructuredSubtitle {
  text: ReactNode;      // Truncatable part (filename, description)
  suffix?: ReactNode;   // Fixed part (line counts, stats) - never truncated
}

// Icon type that works with both Lucide and Solar icons
type IconComponent = FC<{ size?: number; className?: string }>;

// Tool registration config
export interface ToolConfig {
  icon: IconComponent;
  title: (props: ToolRenderProps) => string;
  chipLabel?: (props: ToolRenderProps) => string | undefined;
  subtitle?: (props: ToolRenderProps) => ReactNode | StructuredSubtitle;
  content?: (props: ToolRenderProps) => ReactNode;
}

// Type guard for structured subtitle
export function isStructuredSubtitle(value: unknown): value is StructuredSubtitle {
  return typeof value === "object" && value !== null && "text" in value;
}

// Extract common input fields (try multiple possible keys)
const getInput = (props: ToolRenderProps) => ({
  filePath: (props.input.file_path ??
    props.input.filePath ??
    props.input.path ??
    props.input.filename ??
    props.input.file) as string | undefined,
  pattern: props.input.pattern as string | undefined,
  command: props.input.command as string | undefined,
  description: props.input.description as string | undefined,
  url: props.input.url as string | undefined,
  prompt: props.input.prompt as string | undefined,
  oldString: (props.input.old_string ??
    props.input.oldString ??
    props.input.old ??
    props.input.before) as string | undefined,
  newString: (props.input.new_string ??
    props.input.newString ??
    props.input.new ??
    props.input.after) as string | undefined,
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
    if (trimmed.startsWith("<!DOCTYPE html") || trimmed.startsWith("<html"))
      return "html";
    if (trimmed.startsWith("<?xml")) return "xml";
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) return "json";
    if (trimmed.startsWith("<!-") && trimmed.includes("<template"))
      return "vue";
    if (trimmed.startsWith("---")) return "yaml";
    if (trimmed.startsWith("#!") && trimmed.includes("python")) return "python";
    if (
      trimmed.startsWith("#!") &&
      (trimmed.includes("bash") || trimmed.includes("sh"))
    )
      return "bash";
    if (trimmed.startsWith("package ") && trimmed.includes("func "))
      return "go";
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
      const lines =
        preview?.split("\n").length ?? p.output?.split("\n").length ?? 0;
      if (!file) return undefined;
      return {
        text: file,
        suffix: lines > 0 ? <span className="text-muted-foreground/70">({lines} lines)</span> : undefined,
      };
    },
    content: (p) => {
      const { filePath } = getInput(p);
      // Prefer metadata.preview for display (more concise)
      const content = (p.metadata?.preview as string) ?? p.output;
      if (!content) return null;

      const lang = getLanguage(filePath, content);
      const truncated =
        content.length > 3000
          ? content.slice(0, 3000) + "\n// ... truncated"
          : content;
      const markdown = "```" + lang + "\n" + truncated + "\n```";

      return (
        <div className="text-xs">
          <Streamdown>{markdown}</Streamdown>
        </div>
      );
    },
  },

  edit: {
    icon: Code,
    title: () => "Edit",
    chipLabel: (p) => filename(getInput(p).filePath),
    subtitle: (p) => {
      const { filePath } = getInput(p);
      const file = filename(filePath);
      const filediff = p.metadata?.filediff as
        | { additions?: number; deletions?: number }
        | undefined;
      if (!file && !filediff) return undefined;
      return {
        text: file,
        suffix: filediff && (
          <>
            <span className="text-green-500">+{filediff.additions ?? 0}</span>{" "}
            <span className="text-red-500">-{filediff.deletions ?? 0}</span>
          </>
        ),
      };
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
    icon: Monitor,
    title: () => "Shell",
    chipLabel: (p) => {
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
      const exitIndicator =
        exit !== undefined && exit !== null && exit !== 0 ? (
          <span className="text-red-500">(exit {exit})</span>
        ) : null;
      return {
        text: desc || description || command?.slice(0, 50),
        suffix: exitIndicator,
      };
    },
    content: (p) => {
      const { command } = getInput(p);
      const output = (p.metadata?.output as string) ?? p.output;
      const exit = p.metadata?.exit as number | null | undefined;
      const hasError = exit !== undefined && exit !== null && exit !== 0;

      if (!command && !output) return null;

      return (
        <div className="space-y-2">
          {command && (
            <div className="flex items-start gap-2 font-mono text-xs">
              <span className="text-muted-foreground/50 select-none shrink-0">$</span>
              <code className="text-foreground/90 break-all whitespace-pre-wrap">{command}</code>
            </div>
          )}
          {output && (
            <pre className={cn(
              "text-xs font-mono leading-relaxed max-h-40 overflow-auto",
              "whitespace-pre-wrap break-words",
              hasError ? "text-red-400/80" : "text-muted-foreground"
            )}>
              {output.length > 2000 ? output.slice(0, 2000) + "\n..." : output}
            </pre>
          )}
        </div>
      );
    },
  },

  write: {
    icon: AddSquare,
    title: () => "Write",
    chipLabel: (p) => filename(getInput(p).filePath),
    subtitle: (p) => {
      const { filePath, content } = getInput(p);
      const file = filename(filePath);
      const lines = content?.split("\n").length ?? 0;
      if (!file && lines === 0) return undefined;
      return {
        text: file || "file",
        suffix: <span className="text-green-500">+{lines}</span>,
      };
    },
    content: (p) => {
      const { filePath, content } = getInput(p);
      if (!content) return null;

      const lang = getLanguage(filePath, content);
      const truncated =
        content.length > 3000
          ? content.slice(0, 3000) + "\n// ... truncated"
          : content;
      const markdown = "```" + lang + "\n" + truncated + "\n```";

      return (
        <div className="text-xs [&_pre]:!bg-transparent [&_code]:!bg-transparent [&_pre]:!m-0 [&_pre]:!p-0">
          <Streamdown>{markdown}</Streamdown>
        </div>
      );
    },
  },

  todowrite: {
    icon: ClipboardList,
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
                <CheckSquare size={16} className="shrink-0 text-emerald-500 mt-0.5" />
              ) : (
                <Record size={16} className="shrink-0 text-muted-foreground mt-0.5" />
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
    icon: FolderPathConnect,
    title: () => "Glob",
    chipLabel: (p) => getInput(p).pattern?.slice(0, 20),
    subtitle: (p) => {
      const pattern = getInput(p).pattern;
      const count = p.metadata?.count as number | undefined;
      const truncated = p.metadata?.truncated as boolean | undefined;
      if (count !== undefined) {
        return {
          text: pattern,
          suffix: <span className="text-muted-foreground/70">({count} files{truncated ? "+" : ""})</span>,
        };
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
    icon: FolderPathConnect,
    title: () => "List",
    chipLabel: (p) => filename(getInput(p).filePath) || "directory",
    subtitle: (p) => {
      const { filePath } = getInput(p);
      const count = p.metadata?.count as number | undefined;
      const truncated = p.metadata?.truncated as boolean | undefined;
      const path = filePath ? filename(filePath) || filePath : "directory";
      if (count !== undefined) {
        return {
          text: path,
          suffix: <span className="text-muted-foreground/70">({count} items{truncated ? "+" : ""})</span>,
        };
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
    icon: Magnifer,
    title: () => "Grep",
    chipLabel: (p) => getInput(p).pattern?.slice(0, 20),
    subtitle: (p) => {
      const pattern = getInput(p).pattern;
      const matches = p.metadata?.matches as number | undefined;
      const truncated = p.metadata?.truncated as boolean | undefined;
      if (matches !== undefined) {
        return {
          text: pattern,
          suffix: <span className="text-muted-foreground/70">({matches} matches{truncated ? "+" : ""})</span>,
        };
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
    icon: Global,
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
      const promptSummary = prompt
        ? ` - "${prompt.slice(0, 40)}${prompt.length > 40 ? "..." : ""}"`
        : "";
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
                {p.output.slice(0, 2000)}
                {p.output.length > 2000 && "\n..."}
              </pre>
            </div>
          )}
        </div>
      );
    },
  },

  task: {
    icon: Bolt,
    title: () => "Task",
    chipLabel: (p) => getInput(p).description?.slice(0, 25),
    subtitle: (p) => {
      const { description } = getInput(p);
      const summary = p.metadata?.summary as
        | Array<{ tool: string; state: { status: string } }>
        | undefined;
      if (summary?.length) {
        const completed = summary.filter(
          (s) => s.state.status === "completed",
        ).length;
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
      const summary = p.metadata?.summary as
        | Array<{
            id: string;
            tool: string;
            state: { status: string; title?: string };
          }>
        | undefined;

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
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      s.state.status === "completed"
                        ? "bg-green-500"
                        : s.state.status === "error"
                          ? "bg-red-500"
                          : s.state.status === "running"
                            ? "bg-yellow-500"
                            : "bg-muted-foreground",
                    )}
                  />
                  <span className="text-muted-foreground">{s.tool}</span>
                  {s.state.title && (
                    <span className="text-foreground/70 truncate">
                      {s.state.title}
                    </span>
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
    icon: Pallete2,
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
          <Pallete2 size={12} className="inline mr-1 text-primary" />
          <span className="text-primary">{name ?? "Theme"}</span>
          {style && (
            <span className="text-muted-foreground ml-1">({style})</span>
          )}
        </>
      );
    },
    content: (p) => {
      const name = p.input.name as string | undefined;
      const style = p.input.style as string | undefined;

      // Extract color values from flat input
      const colorKeys = [
        "primary",
        "secondary",
        "accent",
        "background",
        "muted",
        "card",
        "border",
        "destructive",
      ];
      const colors = colorKeys
        .map((key) => ({ key, value: p.input[key] as string }))
        .filter((c) => c.value);

      if (colors.length === 0) {
        return (
          <div className="text-xs text-muted-foreground">Creating theme...</div>
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

  skill: {
    icon: MagicStick,
    title: (p) => {
      // Try different possible input keys for skill name
      const name = (p.input.skill ?? p.input.name ?? p.input.skillName) as string | undefined;
      if (!name) return "Skill";
      // Convert kebab-case to Title Case
      return name
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
    },
    content: (p) => {
      // Show input for debugging if no recognized keys
      const name = (p.input.skill ?? p.input.name ?? p.input.skillName) as string | undefined;
      if (!name && Object.keys(p.input).length > 0) {
        return (
          <pre className="text-xs text-muted-foreground">
            {JSON.stringify(p.input, null, 2)}
          </pre>
        );
      }
      return null;
    },
  },

  // Question tool - displays questions and user's answers
  question: {
    icon: QuestionCircle,
    title: (p) => {
      const questions = p.input.questions as Array<{ header?: string }> | undefined;
      const firstHeader = questions?.[0]?.header;
      if (p.status === "completed") {
        return "Asked question";
      }
      return firstHeader || "Question";
    },
    chipLabel: (p) => {
      const questions = p.input.questions as Array<{ header?: string }> | undefined;
      return questions?.[0]?.header;
    },
    subtitle: (p) => {
      const questions = p.input.questions as Array<{ question?: string; header?: string }> | undefined;
      const answers = p.metadata?.answers as string[][] | undefined;
      const count = questions?.length ?? 0;

      if (p.status === "completed" && answers?.length) {
        // Clean count indicator when completed
        if (count === 1) {
          // For single question, show the first answer briefly
          const firstAnswer = answers[0]?.[0];
          if (firstAnswer) {
            return firstAnswer.length > 30 ? firstAnswer.slice(0, 30) + "…" : firstAnswer;
          }
        }
        // For multiple questions, just show count
        return `${count} answered`;
      }

      // Show first question text when running/pending
      const firstQuestion = questions?.[0]?.question;
      if (firstQuestion) {
        return firstQuestion.length > 50 ? firstQuestion.slice(0, 50) + "..." : firstQuestion;
      }
      return undefined;
    },
    content: (p) => {
      const questions = p.input.questions as Array<{ question: string; header?: string; options?: Array<{ label: string }> }> | undefined;
      const answers = p.metadata?.answers as string[][] | undefined;

      if (!questions?.length) return null;

      if (p.status === "completed" && answers) {
        // Light, minimal Q&A display
        return (
          <div className="space-y-1.5">
            {questions.map((q, idx) => {
              const answer = answers[idx]?.join(", ") || "—";
              return (
                <div key={idx} className="flex items-baseline gap-2 text-xs">
                  <span className="text-muted-foreground/50 shrink-0">
                    {q.header || `Q${idx + 1}`}
                  </span>
                  <span className="text-muted-foreground">{answer}</span>
                </div>
              );
            })}
          </div>
        );
      }

      // Show questions with options when running/pending
      return (
        <div className="space-y-3 text-xs">
          {questions.map((q, idx) => (
            <div key={idx} className="space-y-1.5">
              <div className="text-foreground">{q.question}</div>
              {q.options && (
                <div className="flex flex-wrap gap-1.5">
                  {q.options.slice(0, 4).map((opt, optIdx) => (
                    <span
                      key={optIdx}
                      className="px-2 py-0.5 rounded-md bg-muted/50 text-muted-foreground text-[11px]"
                    >
                      {opt.label}
                    </span>
                  ))}
                  {q.options.length > 4 && (
                    <span className="text-muted-foreground/60">+{q.options.length - 4} more</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      );
    },
  },
};

// Default config for unknown tools
export const DEFAULT_TOOL: ToolConfig = {
  icon: Settings,
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
