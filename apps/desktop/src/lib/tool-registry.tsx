import { useEffect, useRef, type ReactNode, type FC } from "react"
import type { ToolState } from "@/context/session-store"
import { IconCheckbox as CheckSquare, IconCircle as Record, IconPalette as Pallete2 } from "@tabler/icons-react"
import { IconTerminal2 as Terminal, IconSearch as Search, IconWorld as Globe, IconGlass as Glasses, IconPencil as PencilLine, IconFilePlus as FilePlus2, IconFolder as FolderTree, IconRobot as Bot, IconSettings as Settings, IconClipboardList as ClipboardList, IconBook as BookOpen, IconHelpCircle as CircleHelp } from "@tabler/icons-react"
import { diffLines } from "diff"
import { cn } from "@/lib/utils"

// Tool props passed to render functions
export interface ToolRenderProps {
  tool: string
  input: Record<string, unknown>
  output?: string
  error?: string
  status: ToolState["status"]
  metadata?: Record<string, unknown>
}

// Structured subtitle with truncatable and fixed parts
export interface StructuredSubtitle {
  text: ReactNode // Truncatable part (filename, description)
  suffix?: ReactNode // Fixed part (line counts, stats) - never truncated
}

// Icon type that works with both Lucide and Solar icons
type IconComponent = FC<{ size?: number; className?: string }>

// Tool registration config
export interface ToolConfig {
  icon: IconComponent
  title: (props: ToolRenderProps) => string
  expandedTitle?: (props: ToolRenderProps) => string
  chipLabel?: (props: ToolRenderProps) => string | undefined
  subtitle?: (props: ToolRenderProps) => ReactNode | StructuredSubtitle
  content?: (props: ToolRenderProps) => ReactNode
}

// Type guard for structured subtitle
export function isStructuredSubtitle(value: unknown): value is StructuredSubtitle {
  return typeof value === "object" && value !== null && "text" in value
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
  offset: props.input.offset as number | undefined,
  limit: props.input.limit as number | undefined,
})

// Get filename from path
const filename = (path?: string) => path?.split("/").pop() || ""

function countLines(text: string | undefined): number {
  if (!text) return 0
  let lines = 1
  for (let index = 0; index < text.length; index++) {
    const char = text.charCodeAt(index)
    if (char === 10) lines++
    if (char === 13) {
      lines++
      if (text.charCodeAt(index + 1) === 10) index++
    }
  }
  return lines
}

function countUnifiedDiffLines(diff: string | undefined): { additions: number; deletions: number } {
  if (!diff) return { additions: 0, deletions: 0 }

  let additions = 0
  let deletions = 0
  for (const line of diff.split(/\r\n|\r|\n/)) {
    if (line.startsWith("+++") || line.startsWith("---")) continue
    if (line.startsWith("+")) additions++
    if (line.startsWith("-")) deletions++
  }
  return { additions, deletions }
}

function fileDiffCounts(p: ToolRenderProps): { additions: number; deletions: number } {
  const filediff = p.metadata?.filediff as { additions?: number; deletions?: number } | undefined
  if (filediff) {
    return {
      additions: filediff.additions ?? 0,
      deletions: filediff.deletions ?? 0,
    }
  }

  const metadataDiff = p.metadata?.diff as string | undefined
  if (metadataDiff) return countUnifiedDiffLines(metadataDiff)

  const { oldString, newString, content } = getInput(p)
  if (p.tool === "write") return { additions: countLines(content), deletions: 0 }
  if (p.tool === "edit") {
    return {
      additions: countLines(newString),
      deletions: countLines(oldString),
    }
  }

  return { additions: 0, deletions: 0 }
}

function SlotNumber({ value, direction }: { value: number; direction: "up" | "down" }) {
  const previousRef = useRef(value)
  const previous = previousRef.current
  const shouldAnimate = previous !== value
  const width = `${Math.max(String(previous).length, String(value).length)}ch`

  useEffect(() => {
    previousRef.current = value
  }, [value])

  if (!shouldAnimate) {
    return (
      <span className="inline-block h-4 text-right leading-4 align-[-3px]" style={{ width }}>
        {value}
      </span>
    )
  }

  return (
    <span className="relative inline-block h-4 overflow-hidden align-[-3px]" style={{ width }}>
      <span
        key={`${direction}-${previous}-${value}`}
        className={cn(
          "absolute inset-x-0 top-0 flex flex-col text-right leading-4 will-change-transform",
          direction === "up" ? "animate-slot-count-up" : "animate-slot-count-down",
        )}
      >
        {direction === "up" ? (
          <>
            <span>{previous}</span>
            <span>{value}</span>
          </>
        ) : (
          <>
            <span>{value}</span>
            <span>{previous}</span>
          </>
        )}
      </span>
    </span>
  )
}

function DiffDeltaBadge({ additions, deletions }: { additions: number; deletions: number }) {
  if (additions === 0 && deletions === 0) return null

  return (
    <span className="inline-flex shrink-0 items-center gap-1 tabular-nums">
      {additions > 0 && (
        <span aria-label={`+${additions}`} className="inline-flex items-center text-success">
          <span aria-hidden="true" className="inline-flex items-center">
            +<SlotNumber value={additions} direction="up" />
          </span>
        </span>
      )}
      {deletions > 0 && (
        <span aria-label={`-${deletions}`} className="inline-flex items-center text-destructive">
          <span aria-hidden="true" className="inline-flex items-center">
            -<SlotNumber value={deletions} direction="down" />
          </span>
        </span>
      )}
    </span>
  )
}

function PlainToolOutput({ text }: { text: string }) {
  return (
    <pre className="text-xs font-mono leading-relaxed whitespace-pre-wrap break-words text-card-foreground">
      {text}
    </pre>
  )
}

function InlineDiff({ diff }: { diff: string }) {
  const lines = diff.split(/\r\n|\r|\n/)
  return (
    <pre className="text-xs font-mono leading-relaxed whitespace-pre-wrap break-words">
      {lines.map((line, index) => {
        const isFileMeta = line.startsWith("+++") || line.startsWith("---")
        const isHunk = line.startsWith("@@")
        const isAdd = line.startsWith("+") && !line.startsWith("+++")
        const isRemove = line.startsWith("-") && !line.startsWith("---")
        return (
          <span
            key={index}
            className={cn(
              "block min-h-[1.35em]",
              isAdd && "text-success bg-success/10",
              isRemove && "text-destructive bg-destructive/10",
              (isHunk || isFileMeta) && "text-info",
              !isAdd && !isRemove && !isHunk && !isFileMeta && "text-card-foreground",
            )}
          >
            {line || " "}
          </span>
        )
      })}
    </pre>
  )
}

// Todo type
interface Todo {
  content: string
  status: "pending" | "in_progress" | "completed"
}

// Tool registry - all tool configs in one place
// Note: Tool names from backend are lowercase
export const TOOLS: Record<string, ToolConfig> = {
  read: {
    icon: Glasses,
    title: () => "Read",
    expandedTitle: () => "Read file",
    chipLabel: (p) => filename(getInput(p).filePath),
    subtitle: (p) => {
      const file = filename(getInput(p).filePath)
      if (!file) return undefined
      return { text: file }
    },
    content: (p) => {
      // Prefer metadata.preview for display (more concise)
      const content = (p.metadata?.preview as string) ?? p.output
      if (!content) return null

      const truncated =
        content.length > 3000 ? content.slice(0, 3000) + "\n// ... truncated" : content

      return <PlainToolOutput text={truncated} />
    },
  },

  edit: {
    icon: PencilLine,
    title: (p) => (p.status === "completed" ? "Edited" : "Editing"),
    expandedTitle: () => "Edited file",
    chipLabel: (p) => filename(getInput(p).filePath),
    subtitle: (p) => {
      const { filePath } = getInput(p)
      const file = filename(filePath)
      const counts = fileDiffCounts(p)
      if (!file && counts.additions === 0 && counts.deletions === 0) return undefined
      return {
        text: file,
        suffix: <DiffDeltaBadge additions={counts.additions} deletions={counts.deletions} />,
      }
    },
    content: (p) => {
      const diff = p.metadata?.diff as string | undefined
      if (!diff) return null

      return <InlineDiff diff={diff} />
    },
  },

  bash: {
    icon: Terminal,
    title: () => "Ran shell",
    chipLabel: (p) => {
      const desc = p.metadata?.description as string | undefined
      const { description, command } = getInput(p)
      if (desc) return desc.slice(0, 25)
      if (description) return description.slice(0, 25)
      if (command) return command.slice(0, 20)
      return undefined
    },
    subtitle: (p) => {
      const desc = p.metadata?.description as string | undefined
      const { description, command } = getInput(p)
      const exit = p.metadata?.exit as number | null | undefined
      const exitIndicator =
        exit !== undefined && exit !== null && exit !== 0 ? (
          <span className="text-destructive">(exit {exit})</span>
        ) : null
      return {
        text: desc || description || command?.slice(0, 50),
        suffix: exitIndicator,
      }
    },
    content: (p) => {
      const { command } = getInput(p)
      const output = (p.metadata?.output as string) ?? p.output
      const exit = p.metadata?.exit as number | null | undefined
      const hasError = exit !== undefined && exit !== null && exit !== 0

      if (!command && !output) return null

      return (
        <div className="space-y-2">
          {command && (
            <div className="flex items-start gap-2 font-mono text-xs">
              <span className="text-muted-foreground/50 select-none shrink-0">$</span>
              <code className="text-card-foreground break-all whitespace-pre-wrap">{command}</code>
            </div>
          )}
          {output && (
            <pre
              className={cn(
                "text-xs font-mono leading-relaxed max-h-40 overflow-auto",
                "whitespace-pre-wrap break-words",
                hasError ? "text-destructive" : "text-card-foreground",
              )}
            >
              {output.length > 2000 ? output.slice(0, 2000) + "\n..." : output}
            </pre>
          )}
        </div>
      )
    },
  },

  write: {
    icon: FilePlus2,
    title: (p) => (p.status === "completed" ? "Wrote" : "Writing"),
    expandedTitle: () => "Wrote file",
    chipLabel: (p) => filename(getInput(p).filePath),
    subtitle: (p) => {
      const { filePath } = getInput(p)
      const file = filename(filePath)
      const counts = fileDiffCounts(p)
      if (!file && counts.additions === 0) return undefined
      return {
        text: file || "file",
        suffix: <DiffDeltaBadge additions={counts.additions} deletions={counts.deletions} />,
      }
    },
    content: (p) => {
      const { content } = getInput(p)
      if (!content) return null

      const truncated =
        content.length > 3000 ? content.slice(0, 3000) + "\n// ... truncated" : content
      const parts = diffLines("", truncated)

      return (
        <pre className="text-xs font-mono leading-relaxed whitespace-pre-wrap break-words">
          {parts.flatMap((part, partIndex) =>
            part.value
              .split(/(\r\n|\r|\n)/)
              .reduce<ReactNode[]>((nodes, segment, index, segments) => {
                if (segment === "\n" || segment === "\r" || segment === "\r\n") return nodes
                if (segment === "" && index === segments.length - 1) return nodes
                const lineBreak = index < segments.length - 1 ? "\n" : ""
                nodes.push(
                  <span
                    key={`${partIndex}-${index}`}
                    className={cn(
                      "block min-h-[1.35em]",
                      part.added && "text-success bg-success/10",
                      part.removed && "text-destructive bg-destructive/10",
                      !part.added && !part.removed && "text-card-foreground",
                    )}
                  >
                    {part.added ? "+ " : part.removed ? "- " : "  "}
                    {segment}
                    {lineBreak}
                  </span>,
                )
                return nodes
              }, []),
          )}
        </pre>
      )
    },
  },

  todowrite: {
    icon: ClipboardList,
    title: () => "Updated to-dos",
    subtitle: (p) => {
      const todos = p.input.todos as Todo[] | undefined
      if (!todos?.length) return undefined
      const completed = todos.filter((t) => t.status === "completed").length
      return `${completed}/${todos.length}`
    },
    content: (p) => {
      const todos = p.input.todos as Todo[] | undefined
      if (!todos?.length) return null
      return (
        <div className="space-y-1">
          {todos.map((todo, i) => (
            <div key={i} className="flex items-start gap-2">
              {todo.status === "completed" ? (
                <CheckSquare size={16} className="shrink-0 text-success mt-0.5" />
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
      )
    },
  },

  glob: {
    icon: FolderTree,
    title: () => "Found files",
    chipLabel: (p) => getInput(p).pattern?.slice(0, 20),
    subtitle: (p) => {
      const pattern = getInput(p).pattern
      const count = p.metadata?.count as number | undefined
      const truncated = p.metadata?.truncated as boolean | undefined
      if (count !== undefined) {
        return {
          text: pattern,
          suffix: (
            <span className="text-muted-foreground/70">
              ({count} files{truncated ? "+" : ""})
            </span>
          ),
        }
      }
      return pattern
    },
    content: (p) =>
      p.output && (
        <PlainToolOutput
          text={p.output.length > 1000 ? `${p.output.slice(0, 1000)}...` : p.output}
        />
      ),
  },

  list: {
    icon: FolderTree,
    title: () => "Listed",
    chipLabel: (p) => filename(getInput(p).filePath) || "directory",
    subtitle: (p) => {
      const { filePath } = getInput(p)
      const count = p.metadata?.count as number | undefined
      const truncated = p.metadata?.truncated as boolean | undefined
      const path = filePath ? filename(filePath) || filePath : "directory"
      if (count !== undefined) {
        return {
          text: path,
          suffix: (
            <span className="text-muted-foreground/70">
              ({count} items{truncated ? "+" : ""})
            </span>
          ),
        }
      }
      return path
    },
    content: (p) =>
      p.output && (
        <PlainToolOutput
          text={p.output.length > 1500 ? `${p.output.slice(0, 1500)}...` : p.output}
        />
      ),
  },

  grep: {
    icon: Search,
    title: () => "Searched",
    chipLabel: (p) => getInput(p).pattern?.slice(0, 20),
    subtitle: (p) => {
      const pattern = getInput(p).pattern
      const matches = p.metadata?.matches as number | undefined
      const truncated = p.metadata?.truncated as boolean | undefined
      if (matches !== undefined) {
        return {
          text: pattern,
          suffix: (
            <span className="text-muted-foreground/70">
              ({matches} matches{truncated ? "+" : ""})
            </span>
          ),
        }
      }
      return pattern
    },
    content: (p) =>
      p.output && (
        <PlainToolOutput
          text={p.output.length > 1000 ? `${p.output.slice(0, 1000)}...` : p.output}
        />
      ),
  },

  webfetch: {
    icon: Globe,
    title: () => "Fetched",
    chipLabel: (p) => {
      const url = getInput(p).url
      try {
        return url ? new URL(url).hostname : undefined
      } catch {
        return url?.slice(0, 20)
      }
    },
    subtitle: (p) => {
      const { url, prompt } = getInput(p)
      // Show hostname and prompt summary
      let hostname = ""
      try {
        hostname = url ? new URL(url).hostname : ""
      } catch {
        hostname = url?.slice(0, 30) ?? ""
      }
      const promptSummary = prompt
        ? ` - "${prompt.slice(0, 40)}${prompt.length > 40 ? "..." : ""}"`
        : ""
      return hostname + promptSummary
    },
    content: (p) => {
      const { url, prompt } = getInput(p)
      return (
        <div className="space-y-2">
          {url && (
            <div className="text-xs">
              <span className="text-muted-foreground">URL: </span>
              <span className="text-info break-all">{url}</span>
            </div>
          )}
          {prompt && (
            <div className="text-xs">
              <span className="text-muted-foreground">Prompt: </span>
              <span className="text-card-foreground">{prompt}</span>
            </div>
          )}
          {p.output && (
            <div className="mt-2 pt-2 border-t border-border/70">
              <PlainToolOutput
                text={p.output.length > 2000 ? `${p.output.slice(0, 2000)}\n...` : p.output}
              />
            </div>
          )}
        </div>
      )
    },
  },

  task: {
    icon: Bot,
    title: () => "Ran task",
    chipLabel: (p) => getInput(p).description?.slice(0, 25),
    subtitle: (p) => {
      const { description } = getInput(p)
      const summary = p.metadata?.summary as
        | Array<{ tool: string; state: { status: string } }>
        | undefined
      if (summary?.length) {
        const completed = summary.filter((s) => s.state.status === "completed").length
        return (
          <>
            {description}{" "}
            <span className="text-muted-foreground">
              ({completed}/{summary.length} tools)
            </span>
          </>
        )
      }
      return description
    },
    content: (p) => {
      const { prompt } = getInput(p)
      const summary = p.metadata?.summary as
        | Array<{
            id: string
            tool: string
            state: { status: string; title?: string }
          }>
        | undefined

      return (
        <div className="space-y-2">
          {prompt && (
            <p className="text-xs text-card-foreground">
              {prompt.slice(0, 200)}
              {prompt.length > 200 && "..."}
            </p>
          )}
          {summary && summary.length > 0 && (
            <div className="space-y-1 pt-1 border-t border-border/70">
              {summary.map((s) => (
                <div key={s.id} className="flex items-center gap-2 text-xs">
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      s.state.status === "completed"
                        ? "bg-success"
                        : s.state.status === "error"
                          ? "bg-destructive"
                          : s.state.status === "running"
                            ? "bg-warning"
                            : "bg-muted-foreground",
                    )}
                  />
                  <span className="text-muted-foreground">{s.tool}</span>
                  {s.state.title && (
                    <span className="text-foreground/70 truncate">{s.state.title}</span>
                  )}
                </div>
              ))}
            </div>
          )}
          {p.output && !summary && (
            <PlainToolOutput
              text={p.output.length > 500 ? `${p.output.slice(0, 500)}...` : p.output}
            />
          )}
        </div>
      )
    },
  },

  theme: {
    icon: Pallete2,
    title: () => "Created theme",
    chipLabel: (p) => {
      const name = p.input.name as string | undefined
      return name?.slice(0, 20)
    },
    subtitle: (p) => {
      const name = p.input.name as string | undefined
      const style = p.input.style as string | undefined
      return (
        <>
          <Pallete2 size={12} className="inline mr-1 text-primary" />
          <span className="text-primary">{name ?? "Theme"}</span>
          {style && <span className="text-muted-foreground ml-1">({style})</span>}
        </>
      )
    },
    content: (p) => {
      const name = p.input.name as string | undefined
      const style = p.input.style as string | undefined

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
      ]
      const colors = colorKeys
        .map((key) => ({ key, value: p.input[key] as string }))
        .filter((c) => c.value)

      if (colors.length === 0) {
        return <div className="text-xs text-muted-foreground">Creating theme...</div>
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
      )
    },
  },

  skill: {
    icon: BookOpen,
    title: (p) => {
      // Try different possible input keys for skill name
      const name = (p.input.skill ?? p.input.name ?? p.input.skillName) as string | undefined
      if (!name) return "Skill"
      // Convert kebab-case to Title Case
      return name
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
    },
    content: (p) => {
      // Show input for debugging if no recognized keys
      const name = (p.input.skill ?? p.input.name ?? p.input.skillName) as string | undefined
      if (!name && Object.keys(p.input).length > 0) {
        return <PlainToolOutput text={JSON.stringify(p.input, null, 2)} />
      }
      return null
    },
  },

  // Question tool - displays questions and user's answers
  question: {
    icon: CircleHelp,
    title: (p) => {
      const questions = p.input.questions as Array<{ header?: string }> | undefined
      const firstHeader = questions?.[0]?.header
      if (p.status === "completed") {
        return "Asked question"
      }
      return firstHeader || "Question"
    },
    chipLabel: (p) => {
      const questions = p.input.questions as Array<{ header?: string }> | undefined
      return questions?.[0]?.header
    },
    subtitle: (p) => {
      const questions = p.input.questions as
        | Array<{ question?: string; header?: string }>
        | undefined
      const answers = p.metadata?.answers as string[][] | undefined
      const count = questions?.length ?? 0

      if (p.status === "completed" && answers?.length) {
        // Clean count indicator when completed
        if (count === 1) {
          // For single question, show the first answer briefly
          const firstAnswer = answers[0]?.[0]
          if (firstAnswer) {
            return firstAnswer.length > 30 ? firstAnswer.slice(0, 30) + "…" : firstAnswer
          }
        }
        // For multiple questions, just show count
        return `${count} answered`
      }

      // Show first question text when running/pending
      const firstQuestion = questions?.[0]?.question
      if (firstQuestion) {
        return firstQuestion.length > 50 ? firstQuestion.slice(0, 50) + "..." : firstQuestion
      }
      return undefined
    },
    content: (p) => {
      const questions = p.input.questions as
        | Array<{ question: string; header?: string; options?: Array<{ label: string }> }>
        | undefined
      const answers = p.metadata?.answers as string[][] | undefined

      if (!questions?.length) return null

      if (p.status === "completed" && answers) {
        // Light, minimal Q&A display
        return (
          <div className="space-y-1.5">
            {questions.map((q, idx) => {
              const answer = answers[idx]?.join(", ") || "—"
              return (
                <div key={idx} className="flex items-baseline gap-2 text-xs">
                  <span className="text-muted-foreground/50 shrink-0">
                    {q.header || `Q${idx + 1}`}
                  </span>
                  <span className="text-muted-foreground">{answer}</span>
                </div>
              )
            })}
          </div>
        )
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
      )
    },
  },
}

// Default config for unknown tools
export const DEFAULT_TOOL: ToolConfig = {
  icon: Settings,
  title: (p) => p.tool,
  content: (p) => {
    const hasInput = Object.keys(p.input).length > 0
    return (
      <>
        {hasInput && <PlainToolOutput text={JSON.stringify(p.input, null, 2).slice(0, 500)} />}
        {p.output && (
          <PlainToolOutput
            text={p.output.length > 500 ? `${p.output.slice(0, 500)}...` : p.output}
          />
        )}
      </>
    )
  },
}

// Get tool config
export function getToolConfig(name: string): ToolConfig {
  return TOOLS[name] ?? DEFAULT_TOOL
}
