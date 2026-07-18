import { memo } from "react"
import { Marker, MarkerContent, MarkerIcon } from "@dilag/ui/marker"
import type { MessagePart as MessagePartType } from "@/context/session-store"
import { Markdown } from "./markdown"
import { Reasoning, ReasoningTrigger, ReasoningContent } from "./reasoning"
import { ToolPart } from "./tool-part"
import { IconFileCode as CodeFile } from "@tabler/icons-react"
import { ErrorBoundary, InlineErrorFallback } from "@/components/blocks/errors/error-boundary"

interface MessagePartProps {
  part: MessagePartType
  isStreaming?: boolean
}

function isReasoningHeading(line: string | undefined): boolean {
  if (!line) return false
  const trimmed = line.trim()
  return /^#+\s+/.test(trimmed) || /^\*\*.+\*\*$/.test(trimmed)
}

function normalizeReasoningTitle(line: string | undefined): string {
  if (!line) return "Reasoning"
  return (
    line
      .replace(/^#+\s*/, "")
      .replace(/^\*\*(.*)\*\*$/, "$1")
      .replace(/^[-*]\s*/, "")
      .replace(/^\d+[.)]\s*/, "")
      .trim() || "Reasoning"
  )
}

export function getReasoningTitle(text: string | undefined): string | undefined {
  const firstLine = text
    ?.split("\n")
    .find((line) => line.trim())
    ?.trim()
  return isReasoningHeading(firstLine) ? normalizeReasoningTitle(firstLine) : undefined
}

export function getReasoningBody(text: string | undefined): string {
  if (!text) return ""
  const lines = text.split("\n")
  const titleIndex = lines.findIndex((line) => line.trim())
  if (titleIndex === -1) return ""

  // Pi TUI does not synthesize headings; it renders model-provided thinking markdown. Only avoid
  // duplicate content when the model actually emitted a markdown heading/bold title line.
  if (!isReasoningHeading(lines[titleIndex])) return text.trim()

  const body = lines
    .slice(titleIndex + 1)
    .join("\n")
    .trim()
  return body || text.trim()
}

export const MessagePart = memo(function MessagePart({
  part,
  isStreaming = false,
}: MessagePartProps) {
  return (
    <ErrorBoundary fallback={<InlineErrorFallback message="Failed to render message part" />}>
      <MessagePartContent part={part} isStreaming={isStreaming} />
    </ErrorBoundary>
  )
})

function MessagePartContent({ part, isStreaming = false }: MessagePartProps) {
  switch (part.type) {
    case "text":
      if (!part.text?.trim()) return null
      return (
        <div className="text-foreground">
          <Markdown>{part.text}</Markdown>
        </div>
      )

    case "reasoning":
      if (!part.text?.trim()) return null
      {
        const title = getReasoningTitle(part.text)
        if (!title) {
          return (
            <div className="py-1 text-sm italic text-muted-foreground">
              <Markdown>{part.text.trim()}</Markdown>
            </div>
          )
        }
        return (
          <Reasoning isStreaming={isStreaming} defaultOpen autoClose={false} className="mb-0">
            <ReasoningTrigger getThinkingMessage={() => <span>{title}</span>} />
            <ReasoningContent>{getReasoningBody(part.text)}</ReasoningContent>
          </Reasoning>
        )
      }

    case "tool":
      if (!part.tool || !part.state) return null
      // QuestionPrompt owns interaction; terminal outcomes remain visible in message history.
      if (
        part.tool === "question" &&
        (part.state.status === "pending" || part.state.status === "running")
      ) {
        return null
      }
      return <ToolPart tool={part.tool} state={part.state} isMessageComplete={!isStreaming} />

    case "file": {
      if (!part.url) return null
      const isImage = part.mime?.startsWith("image/")
      if (isImage) {
        return (
          <div className="max-w-md rounded-xl overflow-hidden border border-border/50 bg-card/50">
            <img src={part.url} alt={part.filename || "Image"} className="w-full h-auto" />
            {part.filename && (
              <div className="px-3 py-2 bg-muted/30 text-xs text-muted-foreground font-mono">
                {part.filename}
              </div>
            )}
          </div>
        )
      }
      return (
        <div className="inline-flex items-center gap-2.5 rounded-lg border border-border/50 bg-card/50 px-3 py-2 text-sm">
          <CodeFile size={16} className="text-primary/60" />
          <span className="font-mono text-sm">{part.filename || "File"}</span>
        </div>
      )
    }

    case "step-start":
      if (!part.model) return null
      return (
        <Marker className="w-fit gap-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/50">
          <MarkerIcon className="flex items-center justify-center">
            <div className="size-1 rounded-full bg-primary/40" />
          </MarkerIcon>
          <MarkerContent>
            <span>
              {part.provider && `${part.provider}/`}
              {part.model}
            </span>
          </MarkerContent>
        </Marker>
      )

    case "step-finish":
      return null

    default:
      return null
  }
}
