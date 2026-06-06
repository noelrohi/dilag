import {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
  useId,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react"
import { useNavigate } from "@tanstack/react-router"
import { useShallow } from "zustand/react/shallow"
import {
  IconDeviceDesktop as Monitor,
  IconAlertCircle as DangerCircle,
  IconClipboardText as ClipboardText,
  IconCircleX as CloseCircle,
  IconAlertTriangle as DangerTriangle,
  IconArrowUp as ArrowUp,
  IconWand as MagicStick,
  IconGitBranch as BranchingPathsUp,
  IconCopy as Copy,
  IconCircleCheck as CheckCircle,
  IconChevronRight as AltArrowRight,
  IconTerminal2 as Terminal,
  IconPlayerStop as Stop,
  IconTrash as TrashBinMinimalistic,
} from "@tabler/icons-react"
import { IconBook as BookOpen } from "@tabler/icons-react"
import { usePendingMessage } from "@/hooks/use-chat-interface"
import { useElapsedTime } from "@/hooks/use-elapsed-time"
import { DilagIcon } from "@/components/blocks/branding/dilag-icon"
import { useSessions, type SendMessageOptions } from "@/hooks/use-sessions"
import {
  useMessageParts,
  useSessionError,
  useSessionStore,
  usePromptQueue,
  type PromptQueueState,
  type SessionStatus,
  type Message as SessionMessage,
} from "@/context/session-store"
import { Button } from "@dilag/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@dilag/ui/collapsible"
import { cn } from "@/lib/utils"
import { MessagePart } from "./message-part"
import { Shimmer } from "@/components/ai-elements/shimmer"
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation"
import {
  Message,
  MessageContent,
  MessageActions,
  MessageAction,
  MessageResponse,
} from "@/components/ai-elements/message"
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTools,
  PromptInputAddAttachmentButton,
  PromptInputAttachments,
  PromptInputAttachment,
  PromptInputScreenReferences,
  PromptInputScreenReference,
  PromptInputProvider,
  usePromptInputController,
} from "@/components/ai-elements/prompt-input"
import { ModelSelectorButton } from "@/components/blocks/selectors/model-selector-button"
import { AgentSelectorButton } from "@/components/blocks/selectors/agent-selector-button"
import { ThinkingModeSelector } from "@/components/blocks/selectors/thinking-mode-selector"
import { QuestionList } from "./question-list"
import { AttachmentBridgeConnector } from "./attachment-bridge-connector"
import type { MessagePart as MessagePartType } from "@/context/session-store"
import type { FileNode } from "@dilag/desktop-bridge"
import { toast } from "sonner"
import { bridge } from "@/lib/bridge"
import { queuedFollowUpPreview, type PromptDeliveryOutcome } from "@/lib/prompt-delivery"

const FILE_MENTION_SEARCH_DEBOUNCE_MS = 150
const FILE_MENTION_SEARCH_LIMIT = 8
const FILE_MENTION_MAX_COUNT = 10
const FILE_MENTION_MAX_SIZE_BYTES = 200 * 1024

export type MentionedFileRef = {
  id: string
  path: string
  displayName: string
}

type ActiveFileMention = {
  start: number
  end: number
  query: string
}

type MentionSearchResult = {
  path: string
  displayName: string
}

type StreamingComposerShortcutArgs = {
  key: string
  shiftKey: boolean
  metaKey: boolean
  ctrlKey: boolean
  altKey: boolean
  isLoading: boolean
}

type MentionFileContent = {
  content: string
  encoding?: "base64"
  mimeType?: string
}

export function getStreamingComposerShortcut({
  key,
  shiftKey,
  metaKey,
  ctrlKey,
  altKey,
  isLoading,
}: StreamingComposerShortcutArgs): "steer" | "followUp" | "newline" | "defer" {
  if (!isLoading || key !== "Enter" || shiftKey) return "defer"
  if (metaKey || ctrlKey) return "steer"
  if (altKey) return "followUp"
  return "newline"
}

function getFileDisplayName(path: string): string {
  return path.split(/[\\/]/).pop() || path
}

function flattenFileNodes(nodes: FileNode[]): string[] {
  const files: string[] = []
  const visit = (node: FileNode) => {
    if (node.isDir) {
      node.children?.forEach(visit)
      return
    }
    files.push(node.id)
  }
  nodes.forEach(visit)
  return files
}

// Detect active @file mention at a given caret position.
export function findActiveFileMention(
  text: string,
  caretPosition: number,
): ActiveFileMention | null {
  if (caretPosition < 0 || caretPosition > text.length) return null

  let start = caretPosition - 1
  while (start >= 0 && !/\s/.test(text[start])) {
    start--
  }
  start += 1

  let end = caretPosition
  while (end < text.length && !/\s/.test(text[end])) {
    end++
  }

  const token = text.slice(start, end)
  if (!token.startsWith("@")) return null
  if (!/^@[\w./-]*$/.test(token)) return null

  return {
    start,
    end,
    query: text.slice(start + 1, caretPosition),
  }
}

// Remove mention token and keep spacing sane around where it was deleted.
export function removeFileMentionToken(
  text: string,
  mention: Pick<ActiveFileMention, "start" | "end">,
): { text: string; caretPosition: number } {
  let prefix = text.slice(0, mention.start)
  let suffix = text.slice(mention.end)

  if (/\s$/.test(prefix) && /^\s/.test(suffix)) {
    suffix = suffix.slice(1)
  } else if (prefix && !/\s$/.test(prefix) && suffix && !/^\s/.test(suffix)) {
    prefix += " "
  }

  return { text: `${prefix}${suffix}`, caretPosition: prefix.length }
}

export function estimateMentionFileSizeBytes(content: string, encoding?: "base64"): number {
  if (encoding === "base64") {
    const padding = content.endsWith("==") ? 2 : content.endsWith("=") ? 1 : 0
    return Math.max(0, Math.floor((content.length * 3) / 4) - padding)
  }
  return new TextEncoder().encode(content).length
}

export function buildMentionDataUrl(
  content: string,
  mimeType: string,
  encoding?: "base64",
): string {
  if (encoding === "base64") {
    return `data:${mimeType};base64,${content}`
  }
  const base64 = btoa(unescape(encodeURIComponent(content)))
  return `data:${mimeType};base64,${base64}`
}

/**
 * Check if a message part would render content.
 * Matches the null-return conditions in MessagePartContent.
 */
function wouldRenderContent(part: MessagePartType): boolean {
  switch (part.type) {
    case "text":
    case "reasoning":
      return !!part.text?.trim()
    case "tool":
      if (!part.tool || !part.state) return false
      // Question tool only renders when completed
      if (part.tool === "question" && part.state.status !== "completed") return false
      // todoread is filtered elsewhere
      if (part.tool === "todoread") return false
      return true
    case "file":
      return !!part.url
    case "step-start":
      return !!part.model
    case "step-finish":
      return false
    default:
      return false
  }
}

export function getRenderableAssistantParts(
  parts: MessagePartType[],
  isStreaming: boolean,
): MessagePartType[] {
  if (isStreaming) return parts.filter(wouldRenderContent)
  const nonReasoningParts = parts.filter(
    (part) => part.type !== "reasoning" && wouldRenderContent(part),
  )
  return nonReasoningParts.length > 0 ? parts.filter(wouldRenderContent) : []
}

export type ParsedSkillBlock = {
  name: string
  location: string
  content: string
  userMessage?: string
}

export function parseSkillBlock(text: string): ParsedSkillBlock | null {
  const match = text.match(
    /^<skill name="([^"]+)" location="([^"]+)">\n([\s\S]*?)\n<\/skill>(?:\n\n([\s\S]+))?$/,
  )
  if (!match) return null
  return {
    name: match[1],
    location: match[2],
    content: match[3],
    userMessage: match[4]?.trim() || undefined,
  }
}

export function getChatActivityLabel({
  isLoading,
  pendingQuestionCount,
  runningQuestionToolCount,
  runningTools,
  sessionStatus,
  fallback,
}: {
  isLoading: boolean
  pendingQuestionCount: number
  runningQuestionToolCount: number
  runningTools: Array<{ tool: string }>
  sessionStatus: SessionStatus
  fallback: string
}): string | undefined {
  if (!isLoading) return undefined
  if (pendingQuestionCount > 0) return "Waiting for your answer"
  if (runningQuestionToolCount > 0) return "Preparing questions"

  const tool = runningTools[0]?.tool
  if (tool === "write" || tool === "edit") return "Writing screen"
  if (tool === "read" || tool === "grep" || tool === "glob") return "Reading project"
  if (tool === "bash") return "Running command"
  if (tool === "webfetch" || tool === "websearch") return "Searching"
  if (tool === "task") return "Delegating"

  if (sessionStatus === "running" || sessionStatus === "busy") return "Thinking"
  return fallback
}

export function isAssistantMessageStreaming(
  message: Pick<SessionMessage, "isStreaming" | "time">,
  sessionStatus: SessionStatus,
): boolean {
  return (
    !!message.isStreaming &&
    message.time.completed === undefined &&
    sessionStatus !== "idle" &&
    sessionStatus !== "error"
  )
}

function DesigningIndicator({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3 animate-slide-up", compact ? "py-2" : "py-4")}>
      <div className="relative flex items-center justify-center size-8">
        <div className="absolute inset-0 rounded-xl bg-primary/10" />
        <div className="absolute -inset-1 rounded-2xl bg-primary/5 blur-sm" />
        <DilagIcon animated className="relative size-5 text-primary" />
      </div>
      <Shimmer as="span" className="text-sm font-medium">
        Designing screens
      </Shimmer>
    </div>
  )
}

function hasActiveToolPart(parts: MessagePartType[]) {
  return parts.some(
    (part) =>
      part.type === "tool" &&
      (part.state?.status === "pending" || part.state?.status === "running"),
  )
}

function InlineErrorCard({ error }: { error: { name: string; message: string } }) {
  // Format error name: "ProviderAuthError" -> "Provider Auth Error"
  const formattedName = error.name
    .replace(/Error$/, "")
    .replace(/([A-Z])/g, " $1")
    .trim()

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20 animate-slide-up">
      <DangerTriangle size={16} className="text-destructive shrink-0 mt-0.5" />
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-sm font-medium text-destructive">{formattedName || "Error"}</span>
        <span className="text-sm text-destructive/80 break-words">{error.message}</span>
      </div>
    </div>
  )
}

// Helper to extract text from parts
function extractTextFromParts(parts: { type: string; text?: string }[]): string {
  return parts
    .filter((p) => p.type === "text" && p.text)
    .map((p) => p.text!)
    .join("")
}

// Parse and clean text: remove screen context blocks, identify inline @ScreenName refs
export function parseMessageText(text: string): { cleanText: string; hasScreenRefs: boolean } {
  // Remove context blocks hidden from display and used only for AI.
  let cleanText = text
    .replace(/<screen_context\b[^>]*>[\s\S]*?<\/screen_context>/g, "")
    .replace(/<edit_element\b[^>]*>[\s\S]*?<\/edit_element>/g, "")
    .replace(/<dilag_context\b[^>]*>[\s\S]*?<\/dilag_context>/g, "")
    .trim()

  // Also handle legacy <referenced_screen> format
  cleanText = cleanText
    .replace(/<referenced_screen name="[^"]+">[\s\S]*?<\/referenced_screen>/g, "")
    .trim()

  // Check if there are inline @ScreenName refs (including kebab-case names with hyphens)
  const hasScreenRefs = /@[\w-]+/.test(cleanText)

  return { cleanText, hasScreenRefs }
}

export function getDisplayMessageText(rawText: string): string {
  const skillBlock = parseSkillBlock(rawText)
  const displayText = skillBlock?.userMessage ?? rawText
  return parseMessageText(displayText).cleanText
}

function CopyMessageAction({
  messageId,
  onCopyText,
}: {
  messageId: string
  onCopyText: (messageId: string) => void | Promise<void>
}) {
  const [copied, setCopied] = useState(false)
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current)
    }
  }, [])

  const handleCopy = useCallback(async () => {
    await onCopyText(messageId)
    setCopied(true)

    if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current)
    resetTimeoutRef.current = setTimeout(() => setCopied(false), 1200)
  }, [messageId, onCopyText])

  return (
    <MessageAction
      tooltip={copied ? "Copied" : "Copy text"}
      onClick={() => void handleCopy()}
      className={cn(copied && "text-success hover:text-success")}
    >
      {copied ? (
        <CheckCircle key="copied" size={14} className="animate-in zoom-in-75 duration-150" />
      ) : (
        <Copy key="copy" size={14} className="animate-in fade-in duration-100" />
      )}
    </MessageAction>
  )
}

// Render text with inline @ScreenName highlights
export function HighlightedText({ text }: { text: string }) {
  // Split on @Word patterns (including hyphens for kebab-case names), keeping the delimiters
  const parts = text.split(/(@[\w-]+)/g)

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("@") && /^@[\w-]+$/.test(part)) {
          return (
            <span
              key={i}
              className="inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded bg-primary/10 text-primary font-medium"
            >
              {part}
            </span>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

export function SkillInvocationBlock({ skill }: { skill: ParsedSkillBlock }) {
  return (
    <div className="mr-auto w-full max-w-[95%] animate-slide-up">
      <Collapsible>
        <CollapsibleTrigger
          className={cn(
            "group flex h-8 w-full items-center justify-between gap-2 rounded-md px-2 py-1.5",
            "text-sm select-none cursor-default text-muted-foreground transition-colors",
            "hover:bg-muted/30 hover:text-foreground data-[state=open]:bg-muted/20 data-[state=open]:text-foreground",
          )}
        >
          <div className="grid min-w-0 flex-1 grid-cols-[16px_minmax(0,1fr)] items-center gap-2.5">
            <span className="flex size-4 shrink-0 items-center justify-center text-muted-foreground/80">
              <BookOpen className="size-[15px] stroke-[1.75]" />
            </span>
            <span className="truncate text-left text-foreground">
              <span className="font-medium">Skill</span> {skill.name}
            </span>
          </div>
          <AltArrowRight
            size={16}
            className={cn(
              "shrink-0 text-muted-foreground opacity-0 transition-all duration-150",
              "group-hover:opacity-100 group-data-[state=open]:opacity-100 group-data-[state=open]:rotate-90",
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-1 overflow-hidden rounded-lg border border-border/60 bg-card text-card-foreground shadow-sm">
          <div className="max-h-72 overflow-y-auto p-3">
            <div className="mb-3 text-xs font-medium text-muted-foreground">Skill</div>
            <div className="prose prose-sm dark:prose-invert max-w-none text-sm text-card-foreground [&_pre]:!bg-transparent [&_code]:!bg-transparent [&_pre]:!m-0 [&_pre]:!p-0 [&_pre]:!text-card-foreground [&_code]:!text-card-foreground [&_*]:!border-border/70 [&_h1]:text-card-foreground [&_h2]:text-card-foreground [&_h3]:text-card-foreground [&_li]:text-card-foreground [&_p]:text-card-foreground [&_strong]:text-card-foreground">
              <MessageResponse>{`**${skill.name}**\n\n${skill.content}`}</MessageResponse>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

// Component that renders a user message with parts from the store
function UserMessage({
  message,
  index,
  onCopyText,
  hideActions,
}: {
  message: SessionMessage
  index: number
  onCopyText: (messageId: string) => void | Promise<void>
  hideActions?: boolean
}) {
  const parts = useMessageParts(message.id)
  const rawTextContent = extractTextFromParts(parts)
  const skillBlock = parseSkillBlock(rawTextContent)
  const cleanText = getDisplayMessageText(rawTextContent)
  const { hasScreenRefs } = parseMessageText(cleanText)
  const fileParts = parts.filter((p) => p.type === "file" && p.url)

  return (
    <>
      {skillBlock && <SkillInvocationBlock skill={skillBlock} />}
      {(cleanText || fileParts.length > 0) && (
        <Message
          from="user"
          className="animate-slide-up ml-0!"
          style={{ animationDelay: `${Math.min(index * 30, 200)}ms` }}
        >
          <MessageContent className="ml-0! space-y-2">
            {/* File attachments */}
            {fileParts.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {fileParts.map((file) => (
                  <div
                    key={file.id}
                    className="relative rounded-lg overflow-hidden border border-border/50 bg-muted/30"
                  >
                    {file.mime?.startsWith("image/") ? (
                      <img
                        src={file.url}
                        alt={file.filename || "Attached image"}
                        className="max-w-[200px] max-h-[200px] object-contain"
                      />
                    ) : (
                      <div className="px-3 py-2 flex items-center gap-2 text-sm text-muted-foreground">
                        <ClipboardText size={16} />
                        <span className="truncate max-w-[150px]">
                          {file.filename || "Attachment"}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {/* Text content with inline highlights for @ScreenName refs */}
            {cleanText && (
              <p className="whitespace-pre-wrap leading-relaxed">
                {hasScreenRefs ? <HighlightedText text={cleanText} /> : cleanText}
              </p>
            )}
          </MessageContent>
          {!hideActions && (
            <MessageActions>
              <CopyMessageAction messageId={message.id} onCopyText={onCopyText} />
            </MessageActions>
          )}
        </Message>
      )}
      {skillBlock && !cleanText && fileParts.length === 0 && !hideActions && (
        <MessageActions>
          <CopyMessageAction messageId={message.id} onCopyText={onCopyText} />
        </MessageActions>
      )}
    </>
  )
}
function isAssistantWorkPart(part: MessagePartType) {
  return part.type === "reasoning" || part.type === "tool" || part.type === "step-start"
}

export function splitAssistantWorkParts(parts: MessagePartType[]) {
  return {
    workParts: parts.filter(isAssistantWorkPart),
    finalParts: parts.filter((part) => !isAssistantWorkPart(part)),
  }
}

const EXPLORATION_TOOL_LABELS: Record<string, string> = {
  grep: "search",
  websearch: "search",
  read: "file",
  glob: "file search",
  list: "directory",
  webfetch: "page",
}

function pluralizeCount(count: number, label: string) {
  if (count === 1) return `1 ${label}`
  if (label.endsWith("search")) return `${count} ${label}es`
  return `${count} ${label}s`
}

function joinSummaryItems(items: string[]) {
  if (items.length <= 1) return items[0] ?? ""
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`
}

function sentenceCase(text: string) {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text
}

export function getAssistantWorkSummary(parts: MessagePartType[]): string | undefined {
  const toolParts = parts.filter((part) => part.type === "tool" && part.tool)
  if (toolParts.length === 0) return undefined

  const explorationCounts = new Map<string, number>()
  let commandCount = 0
  let fileUpdateCount = 0
  let taskCount = 0
  let todoCount = 0
  let questionCount = 0
  let otherToolCount = 0

  for (const part of toolParts) {
    const tool = part.tool!
    const explorationLabel = EXPLORATION_TOOL_LABELS[tool]

    if (explorationLabel) {
      explorationCounts.set(explorationLabel, (explorationCounts.get(explorationLabel) ?? 0) + 1)
    } else if (tool === "bash") {
      commandCount++
    } else if (tool === "write" || tool === "edit") {
      fileUpdateCount++
    } else if (tool === "task") {
      taskCount++
    } else if (tool === "todowrite") {
      todoCount++
    } else if (tool === "question") {
      questionCount++
    } else {
      otherToolCount++
    }
  }

  const phrases: string[] = []
  const explorationItems = Array.from(explorationCounts.entries()).map(([label, count]) =>
    pluralizeCount(count, label),
  )

  if (explorationItems.length > 0) {
    phrases.push(`explored ${joinSummaryItems(explorationItems)}`)
  }
  if (fileUpdateCount > 0) phrases.push(`made ${pluralizeCount(fileUpdateCount, "file change")}`)
  if (commandCount > 0) phrases.push(`ran ${pluralizeCount(commandCount, "command")}`)
  if (taskCount > 0) phrases.push(`ran ${pluralizeCount(taskCount, "task")}`)
  if (todoCount > 0) phrases.push("updated to-dos")
  if (questionCount > 0) phrases.push(`asked ${pluralizeCount(questionCount, "question")}`)
  if (otherToolCount > 0) phrases.push(`used ${pluralizeCount(otherToolCount, "tool")}`)

  return phrases.length > 0 ? sentenceCase(phrases.join(", ")) : undefined
}

function getEffectiveToolStatus(part: MessagePartType, isMessageComplete: boolean) {
  const status = part.state?.status
  if (!status) return undefined
  if (isMessageComplete && (status === "pending" || status === "running")) return "completed"
  return status
}

function isFileMutationToolPart(part: MessagePartType) {
  return part.tool === "write" || part.tool === "edit"
}

export function shouldShimmerAssistantWorkSummary(
  parts: MessagePartType[],
  isMessageComplete: boolean,
) {
  const latestToolPart = [...parts].reverse().find((part) => part.type === "tool" && part.state)
  if (!latestToolPart) return false

  const status = getEffectiveToolStatus(latestToolPart, isMessageComplete)
  if (status === "pending") return true
  return status === "running" && isFileMutationToolPart(latestToolPart)
}

function isReasoningPartStreaming(
  parts: MessagePartType[],
  partIndex: number,
  isStreaming: boolean,
): boolean {
  if (!isStreaming || parts[partIndex]?.type !== "reasoning") return false

  // A reasoning block can be followed immediately by a running tool call. In that state the
  // assistant message is still live, but the reasoning part is no longer the final part, so
  // checking only `partIndex === parts.length - 1` collapses the exact thinking block the user is
  // trying to read while tools run. Keep the latest reasoning block open until the message settles.
  return !parts.slice(partIndex + 1).some((part) => part.type === "reasoning")
}

export function AssistantWorkGroup({
  parts,
  isStreaming,
  startedAt,
  completedAt,
}: {
  parts: MessagePartType[]
  isStreaming: boolean
  startedAt: number
  completedAt?: number
}) {
  if (parts.length === 0) return null

  const elapsed = useElapsedTime(startedAt, completedAt)
  const prefix = completedAt === undefined ? "Working" : "Worked for"
  const summary = getAssistantWorkSummary(parts) ?? `${prefix} ${elapsed}`
  const shouldShimmerSummary = shouldShimmerAssistantWorkSummary(parts, !isStreaming)

  return (
    <Collapsible>
      <CollapsibleTrigger
        className={cn(
          "group flex h-7 w-full items-center justify-start gap-2 rounded-md px-0 py-1",
          "text-sm text-muted-foreground transition-colors hover:text-foreground",
        )}
      >
        <span className="flex size-4 shrink-0 items-center justify-center text-muted-foreground/80">
          <Terminal className="size-[15px] stroke-[1.75]" />
        </span>
        {shouldShimmerSummary ? (
          <Shimmer as="span" className="min-w-0 truncate text-left">
            {summary}
          </Shimmer>
        ) : (
          <span className="min-w-0 truncate text-left">{summary}</span>
        )}
        <AltArrowRight
          size={14}
          className={cn(
            "shrink-0 text-muted-foreground opacity-0 transition-all duration-150",
            "group-hover:opacity-100 group-data-[state=open]:opacity-100 group-data-[state=open]:rotate-90",
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-0.5 pb-1.5">
        {parts.map((part, partIndex) => {
          const isPartStreaming =
            part.type === "reasoning"
              ? isReasoningPartStreaming(parts, partIndex, isStreaming)
              : isStreaming

          return (
            <div
              key={part.id}
              className="animate-stream-in"
              style={{ animationDelay: `${partIndex * 35}ms` }}
            >
              <MessagePart part={part} isStreaming={isPartStreaming} />
            </div>
          )
        })}
      </CollapsibleContent>
    </Collapsible>
  )
}

// Component that renders an assistant message with parts from the store
function AssistantMessage({
  message,
  index,
  isLast,
  onFork,
  onCopyText,
}: {
  message: SessionMessage
  index: number
  isLast: boolean
  onFork: (messageId: string) => void
  onCopyText: (messageId: string) => void | Promise<void>
}) {
  const messageParts = useSessionStore(useShallow((state) => state.parts[message.id] ?? []))
  const sessionError = useSessionError(message.sessionID)
  const sessionStatus = useSessionStore(
    (state) => state.sessionStatus[message.sessionID] ?? "unknown",
  )
  const isStreaming = isAssistantMessageStreaming(message, sessionStatus)
  const turnRenderableParts = getRenderableAssistantParts(messageParts, isStreaming)
  const showAwaitingModelIndicator =
    isStreaming && turnRenderableParts.length > 0 && !hasActiveToolPart(messageParts)

  if (!isStreaming && turnRenderableParts.length === 0 && !sessionError) {
    return null
  }

  return (
    <Message
      from="assistant"
      className="animate-slide-up"
      style={{ animationDelay: `${Math.min(index * 30, 200)}ms` }}
    >
      <MessageContent className="space-y-2 w-full">
        {turnRenderableParts.map((part, partIndex) => {
          const isPartStreaming = isStreaming

          return (
            <div
              key={part.id}
              className="animate-stream-in"
              style={{ animationDelay: `${partIndex * 50}ms` }}
            >
              <MessagePart part={part} isStreaming={isPartStreaming} />
            </div>
          )
        })}

        {/* Thinking indicator - show before the first renderable part, and also between tool waves
            while Pi is waiting on the provider after all current tools have completed. Pi TUI keeps
            a global working loader visible for this gap; without this row the GUI looks stuck at
            the last "Ran …" tool even though the session is still running. */}
        {isStreaming && turnRenderableParts.length === 0 && <DesigningIndicator />}
        {showAwaitingModelIndicator && <DesigningIndicator compact />}

        {/* Inline error - show on last assistant message when session has error */}
        {isLast && !isStreaming && sessionError && <InlineErrorCard error={sessionError} />}
      </MessageContent>
      {!isStreaming && isLast && (
        <MessageActions>
          <CopyMessageAction messageId={message.id} onCopyText={onCopyText} />
          <MessageAction tooltip="Fork from here" onClick={() => onFork(message.id)}>
            <BranchingPathsUp size={14} />
          </MessageAction>
        </MessageActions>
      )}
    </Message>
  )
}

function EmptyState({ onCreateSession }: { onCreateSession: () => void }) {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="relative max-w-md text-center animate-slide-up">
        {/* Decorative background */}
        <div className="absolute -inset-8 rounded-3xl bg-gradient-to-br from-primary/5 via-transparent to-primary/5 blur-xl" />

        <div className="relative space-y-6">
          {/* Icon */}
          <div className="mx-auto size-16 rounded-2xl bg-card border border-border/50 flex items-center justify-center">
            <Monitor size={28} className="text-primary" />
          </div>

          {/* Text */}
          <div className="space-y-2">
            <h2 className="text-xl font-semibold tracking-tight">Start a new session</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Create a session to begin coding with AI assistance. Each session maintains its own
              context and history.
            </p>
          </div>

          {/* Action */}
          <Button onClick={onCreateSession} className="gap-2 glow-ring" size="lg">
            <MagicStick size={16} />
            New Session
          </Button>
        </div>
      </div>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="flex flex-col items-center gap-6 animate-slide-up">
        <div className="relative">
          <div className="size-12 rounded-xl bg-card border border-border/50 flex items-center justify-center">
            <Monitor size={20} className="text-primary animate-thinking" />
          </div>
          <div className="absolute -inset-2 rounded-2xl bg-primary/10 animate-pulse" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-medium">Starting server</p>
          <p className="text-xs text-muted-foreground">Initializing Pi...</p>
        </div>
      </div>
    </div>
  )
}

function ErrorState({ error }: { error: string }) {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="relative max-w-md text-center animate-slide-up">
        <div className="absolute -inset-8 rounded-3xl bg-destructive/5 blur-xl" />

        <div className="relative space-y-4">
          <div className="mx-auto size-12 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center justify-center">
            <DangerCircle size={20} className="text-destructive" />
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-destructive">{error}</h3>
            <p className="text-xs text-muted-foreground">
              Make sure Pi has an authenticated model provider configured.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function ChatInputArea({
  isLoading,
  sendMessage,
  stopSession,
  sessionId,
  sessionCwd,
  promptQueue,
}: {
  isLoading: boolean
  sendMessage: (
    message: string,
    files?: import("ai").FileUIPart[],
    options?: SendMessageOptions,
  ) => Promise<PromptDeliveryOutcome | undefined>
  stopSession: () => Promise<void>
  sessionId: string
  sessionCwd: string | null
  promptQueue: PromptQueueState
}) {
  const composerTextareaId = useId()
  const { textInput, attachments, screenRefs } = usePromptInputController()
  const [caretPosition, setCaretPosition] = useState(0)
  const [activeMention, setActiveMention] = useState<ActiveFileMention | null>(null)
  const [mentionOpen, setMentionOpen] = useState(false)
  const [isSearchingMentions, setIsSearchingMentions] = useState(false)
  const [mentionSearchResults, setMentionSearchResults] = useState<MentionSearchResult[]>([])
  const [highlightedMentionIndex, setHighlightedMentionIndex] = useState(0)
  const [mentionedFiles, setMentionedFiles] = useState<MentionedFileRef[]>([])
  const mentionSearchRequestRef = useRef(0)
  const nextStreamingBehaviorRef = useRef<"steer" | "followUp">("steer")
  const hasInput = textInput.value.trim().length > 0
  const hasComposerReferences =
    attachments.files.length > 0 || screenRefs.references.length > 0 || mentionedFiles.length > 0
  const hasSubmittableInput = hasInput || hasComposerReferences
  const queuedPrompts = useMemo(
    () => [
      ...promptQueue.steering.map((prompt, index) => ({
        id: `steer-${index}-${prompt}`,
        prompt,
        label: "Steer",
      })),
      ...promptQueue.followUp.map((prompt, index) => ({
        id: `follow-up-${index}-${prompt}`,
        prompt,
        label: "Follow-up",
      })),
    ],
    [promptQueue],
  )
  const hasQueuedPrompts = queuedPrompts.length > 0
  const { pendingMessage, clearPendingMessage } = usePendingMessage()

  // Handle pending messages from server error overlay or other sources
  useEffect(() => {
    if (pendingMessage) {
      textInput.setInput(pendingMessage)
      setCaretPosition(pendingMessage.length)
      clearPendingMessage()
    }
  }, [pendingMessage, textInput, clearPendingMessage])

  // Keep caret position bounded as input changes
  useEffect(() => {
    if (caretPosition > textInput.value.length) {
      setCaretPosition(textInput.value.length)
    }
  }, [caretPosition, textInput.value.length])

  // Parse active @file token from the current caret position
  useEffect(() => {
    const mention = findActiveFileMention(textInput.value, caretPosition)
    setActiveMention(mention)

    if (!mention) {
      setMentionOpen(false)
      setMentionSearchResults([])
      setHighlightedMentionIndex(0)
      setIsSearchingMentions(false)
      return
    }

    setMentionOpen(true)
  }, [textInput.value, caretPosition])

  // Debounced project file search for active mention
  useEffect(() => {
    if (!mentionOpen || !activeMention || !sessionCwd) {
      return
    }

    const requestId = ++mentionSearchRequestRef.current
    setIsSearchingMentions(true)

    const timer = window.setTimeout(async () => {
      try {
        const files = flattenFileNodes(await bridge.project.listFiles({ sessionCwd }))
        const query = activeMention.query.trim().toLowerCase()

        if (requestId !== mentionSearchRequestRef.current) return

        const results = files
          .filter((path) => !query || path.toLowerCase().includes(query))
          .slice(0, FILE_MENTION_SEARCH_LIMIT)
          .map((path) => ({
            path,
            displayName: getFileDisplayName(path),
          }))
        setMentionSearchResults(results)
        setHighlightedMentionIndex(0)
      } catch {
        if (requestId !== mentionSearchRequestRef.current) return
        setMentionSearchResults([])
      } finally {
        if (requestId === mentionSearchRequestRef.current) {
          setIsSearchingMentions(false)
        }
      }
    }, FILE_MENTION_SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(timer)
  }, [activeMention, mentionOpen, sessionCwd])

  const syncCaretPosition = useCallback((target: HTMLTextAreaElement | null) => {
    if (!target) return
    setCaretPosition(target.selectionStart ?? target.value.length)
  }, [])

  const selectMentionResult = useCallback(
    (result: MentionSearchResult) => {
      if (!activeMention) return

      const existing = mentionedFiles.some((file) => file.path === result.path)
      if (existing) {
        toast.info(`"${result.displayName}" is already mentioned`)
      } else if (mentionedFiles.length >= FILE_MENTION_MAX_COUNT) {
        toast.warning(`You can mention up to ${FILE_MENTION_MAX_COUNT} files per message`)
      } else {
        setMentionedFiles((prev) => [
          ...prev,
          {
            id: result.path,
            path: result.path,
            displayName: result.displayName,
          },
        ])
      }

      const next = removeFileMentionToken(textInput.value, activeMention)
      textInput.setInput(next.text)
      setCaretPosition(next.caretPosition)
      setMentionOpen(false)
      setMentionSearchResults([])
      setHighlightedMentionIndex(0)

      requestAnimationFrame(() => {
        const textarea = document.getElementById(composerTextareaId) as HTMLTextAreaElement | null
        if (!textarea) return
        textarea.focus()
        textarea.setSelectionRange(next.caretPosition, next.caretPosition)
      })
    },
    [activeMention, composerTextareaId, mentionedFiles, textInput],
  )

  const removeMentionedFile = useCallback((id: string) => {
    setMentionedFiles((prev) => prev.filter((file) => file.id !== id))
  }, [])

  const handleComposerKeyDownCapture = useCallback(
    (e: ReactKeyboardEvent<HTMLFormElement>) => {
      const target = e.target as HTMLElement | null
      if (!target || target.id !== composerTextareaId) return

      if (mentionOpen && e.key === "Escape") {
        e.preventDefault()
        e.stopPropagation()
        setMentionOpen(false)
        return
      }

      if (mentionOpen && e.key === "ArrowDown") {
        e.preventDefault()
        e.stopPropagation()
        if (mentionSearchResults.length === 0) return
        setHighlightedMentionIndex((prev) => (prev + 1) % mentionSearchResults.length)
        return
      }

      if (mentionOpen && e.key === "ArrowUp") {
        e.preventDefault()
        e.stopPropagation()
        if (mentionSearchResults.length === 0) return
        setHighlightedMentionIndex(
          (prev) => (prev - 1 + mentionSearchResults.length) % mentionSearchResults.length,
        )
        return
      }

      const isPlainEnter = e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey
      if (mentionOpen && (isPlainEnter || e.key === "Tab")) {
        e.preventDefault()
        e.stopPropagation()
        if (mentionSearchResults.length === 0) return
        const selected =
          mentionSearchResults[Math.min(highlightedMentionIndex, mentionSearchResults.length - 1)]
        if (selected) {
          selectMentionResult(selected)
        }
      }

      const streamingShortcut = getStreamingComposerShortcut({
        key: e.key,
        shiftKey: e.shiftKey,
        metaKey: e.metaKey,
        ctrlKey: e.ctrlKey,
        altKey: e.altKey,
        isLoading,
      })

      if (streamingShortcut === "steer" || streamingShortcut === "followUp") {
        e.preventDefault()
        e.stopPropagation()
        nextStreamingBehaviorRef.current = streamingShortcut
        e.currentTarget.requestSubmit()
        return
      }

      if (streamingShortcut === "newline") {
        e.stopPropagation()
      }
    },
    [
      composerTextareaId,
      highlightedMentionIndex,
      isLoading,
      mentionOpen,
      mentionSearchResults,
      selectMentionResult,
    ],
  )

  const clearPromptQueue = useCallback(async () => {
    try {
      await bridge.agent.clearQueue({ sessionID: sessionId })
      useSessionStore.getState().setPromptQueue(sessionId, { steering: [], followUp: [] })
    } catch {
      toast.error("Failed to clear queued prompts")
    }
  }, [sessionId])

  const resolveMentionedFileParts = useCallback(async () => {
    const parts: import("ai").FileUIPart[] = []
    let tooLargeCount = 0
    let failedCount = 0

    for (const file of mentionedFiles) {
      try {
        if (!sessionCwd) {
          failedCount++
          continue
        }
        const fileContent = await bridge.project.readFile({ sessionCwd, filePath: file.path })
        const content: MentionFileContent = {
          content: fileContent,
          mimeType: "text/plain",
        }

        const bytes = estimateMentionFileSizeBytes(content.content, content.encoding)
        if (bytes > FILE_MENTION_MAX_SIZE_BYTES) {
          tooLargeCount++
          continue
        }

        const mimeType = content.mimeType || "text/plain"
        parts.push({
          type: "file",
          filename: file.path,
          mediaType: mimeType,
          url: buildMentionDataUrl(content.content, mimeType, content.encoding),
        })
      } catch {
        failedCount++
      }
    }

    return { parts, tooLargeCount, failedCount }
  }, [mentionedFiles, sessionCwd])

  const handleSubmit = async (text: string, files?: import("ai").FileUIPart[]) => {
    const trimmedText = text.trim()
    const inputFiles = files ?? []
    const hasMentionedFiles = mentionedFiles.length > 0
    if (!trimmedText && inputFiles.length === 0 && !hasMentionedFiles) return

    let mentionParts: import("ai").FileUIPart[] = []
    if (hasMentionedFiles) {
      if (!sessionCwd) {
        toast.error("Session path is unavailable for file mentions")
        return
      }

      const resolved = await resolveMentionedFileParts()
      mentionParts = resolved.parts

      if (resolved.tooLargeCount > 0) {
        toast.warning(
          `Skipped ${resolved.tooLargeCount} mentioned ${resolved.tooLargeCount === 1 ? "file" : "files"} over 200KB`,
        )
      }
      if (resolved.failedCount > 0) {
        toast.warning(
          `Could not attach ${resolved.failedCount} mentioned ${resolved.failedCount === 1 ? "file" : "files"}`,
        )
      }
    }

    const mergedFiles = [...inputFiles, ...mentionParts]
    if (!trimmedText && mergedFiles.length === 0) {
      toast.error("All mentioned files were skipped. Add text or mention smaller files.")
      return
    }

    try {
      const streamingBehavior = isLoading ? nextStreamingBehaviorRef.current : undefined
      const delivery = await sendMessage(
        trimmedText,
        mergedFiles.length > 0 ? mergedFiles : undefined,
        { streamingBehavior },
      )
      if (delivery?.status === "queued") {
        toast.success(
          delivery.mode === "followUp" ? "Queued follow-up message" : "Queued steering message",
        )
      }
      nextStreamingBehaviorRef.current = "steer"
      setMentionedFiles([])
      setMentionOpen(false)
      setMentionSearchResults([])
      setHighlightedMentionIndex(0)
    } catch {
      toast.error("Failed to send message")
    }
  }

  // ESC key handler to stop session
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isLoading) {
        // Don't stop session if any dialog/modal is open (includes Dialog and AlertDialog)
        const hasOpenDialog = document.querySelector(
          '[data-radix-portal] [role="dialog"], [data-radix-portal] [role="alertdialog"]',
        )
        if (hasOpenDialog) return

        e.preventDefault()
        stopSession()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isLoading, stopSession])

  return (
    <div className="relative px-4 pb-4">
      <div className="relative isolate">
        {/* Gradient fade */}
        <div className="absolute inset-x-0 -top-12 h-12 bg-gradient-to-t from-background to-transparent pointer-events-none" />

        {hasQueuedPrompts && (
          <div className="relative z-0 mx-auto mb-[-14px] w-[calc(100%-2rem)] overflow-hidden rounded-xl border border-sidebar-border/80 bg-sidebar px-3 pb-5 pt-2 shadow-lg shadow-black/5">
            <div className="max-h-24 divide-y divide-sidebar-border/60 overflow-y-auto">
              {queuedPrompts.map((item) => (
                <div
                  key={item.id}
                  className="flex min-h-8 items-center justify-between gap-3 py-1 text-xs"
                >
                  <div className="flex min-w-0 items-center gap-2 text-sidebar-foreground/75">
                    <AltArrowRight size={13} className="shrink-0 text-sidebar-foreground/45" />
                    <span className="truncate">{queuedFollowUpPreview(item.prompt)}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className="inline-flex h-6 items-center rounded-md px-1.5 font-medium text-sidebar-foreground/65">
                      {item.label}
                    </span>
                    <button
                      type="button"
                      aria-label="Clear queued prompts"
                      title="Clear queued prompts"
                      onClick={() => void clearPromptQueue()}
                      className="inline-flex size-6 items-center justify-center rounded-md text-sidebar-foreground/45 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    >
                      <TrashBinMinimalistic size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {mentionOpen && (
          <div className="absolute inset-x-0 bottom-full z-20 mb-3 overflow-hidden rounded-[1.35rem] border border-sidebar-border/90 bg-sidebar/95 p-2 shadow-2xl shadow-black/20 backdrop-blur-xl animate-slide-up">
            <div className="px-3 pb-1 pt-1 text-sm text-muted-foreground">Files</div>
            <div className="max-h-64 overflow-y-auto">
              {isSearchingMentions ? (
                <div className="px-3 py-3 text-sm text-muted-foreground">Searching files…</div>
              ) : mentionSearchResults.length === 0 ? (
                <div className="px-3 py-3 text-sm text-muted-foreground">No files found</div>
              ) : (
                mentionSearchResults.map((result, index) => (
                  <button
                    key={result.path}
                    type="button"
                    className={cn(
                      "group flex min-h-10 w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors",
                      "hover:bg-sidebar-accent/80",
                      index === highlightedMentionIndex && "bg-sidebar-accent",
                    )}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectMentionResult(result)}
                  >
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <ClipboardText size={15} />
                    </span>
                    <span className="flex min-w-0 items-baseline gap-2">
                      <span className="shrink-0 text-sm font-medium text-sidebar-foreground">
                        {result.displayName}
                      </span>
                      <span className="truncate text-sm text-muted-foreground">{result.path}</span>
                    </span>
                  </button>
                ))
              )}
            </div>
            <div className="border-t border-sidebar-border/50 px-3 pb-2 pt-3 text-sm text-muted-foreground">
              Type to search for files
            </div>
          </div>
        )}

        <PromptInput
          onSubmit={async ({ text, files }) => handleSubmit(text, files)}
          onKeyDownCapture={handleComposerKeyDownCapture}
          className={cn(
            "relative z-10 rounded-2xl bg-sidebar text-sidebar-foreground transition-colors duration-200 [&_[data-slot=input-group]]:rounded-2xl [&_[data-slot=input-group]]:border-sidebar-border focus-within:[&_[data-slot=input-group]]:border-primary/50",
          )}
        >
          <PromptInputAttachments>
            {(attachment) => <PromptInputAttachment data={attachment} />}
          </PromptInputAttachments>
          <PromptInputScreenReferences className="px-3 pt-2">
            {(ref) => <PromptInputScreenReference data={ref} />}
          </PromptInputScreenReferences>
          {mentionedFiles.length > 0 && (
            <div className="flex w-full flex-wrap items-start justify-start gap-1.5 px-3 pt-2">
              {mentionedFiles.map((file) => (
                <div
                  key={file.id}
                  className="group relative inline-flex h-6 cursor-default select-none items-center gap-1 rounded-[5px] pl-1.5 pr-1 bg-gradient-to-b from-foreground/[0.06] to-foreground/[0.03] ring-1 ring-inset ring-foreground/[0.08]"
                >
                  <ClipboardText size={10} className="text-foreground/45" />
                  <span className="max-w-[220px] truncate text-[12px] font-medium tracking-tight text-foreground/70 group-hover:text-foreground/85">
                    {file.path}
                  </span>
                  <button
                    aria-label={`Remove ${file.displayName}`}
                    className="ml-0.5 flex size-4 shrink-0 cursor-pointer items-center justify-center rounded opacity-0 transition-all duration-150 group-hover:opacity-100 hover:bg-foreground/10"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeMentionedFile(file.id)
                    }}
                    type="button"
                  >
                    <CloseCircle size={10} className="text-foreground/50" />
                    <span className="sr-only">Remove</span>
                  </button>
                </div>
              ))}
            </div>
          )}
          <PromptInputBody>
            <PromptInputTextarea
              id={composerTextareaId}
              data-chat-composer-textarea
              aria-keyshortcuts={isLoading ? "Meta+Enter Control+Enter" : undefined}
              placeholder={isLoading ? "Ask for follow-up changes" : "Describe what to design..."}
              className="min-h-[56px] max-h-[200px]"
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                syncCaretPosition(event.currentTarget)
              }
              onClick={(event) => syncCaretPosition(event.currentTarget)}
              onKeyUp={(event) => syncCaretPosition(event.currentTarget)}
              onSelect={(event) => syncCaretPosition(event.currentTarget as HTMLTextAreaElement)}
            />
          </PromptInputBody>
          <PromptInputFooter className="border-t-0">
            {/* Left side - agent selector, model selector, thinking mode */}
            <PromptInputTools className="min-w-0 flex-1">
              <div className="flex items-center gap-1 overflow-x-auto max-w-[280px] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <AgentSelectorButton />
                <ModelSelectorButton />
                <ThinkingModeSelector />
              </div>
            </PromptInputTools>

            {/* Right side - attachment menu + submit */}
            <div className="flex items-center gap-1">
              <PromptInputAddAttachmentButton />
              <PromptInputSubmit
                type={isLoading ? "button" : "submit"}
                onClick={
                  isLoading
                    ? (event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        void stopSession()
                      }
                    : undefined
                }
                disabled={isLoading ? false : !hasSubmittableInput}
                aria-label={isLoading ? "Stop agent" : "Send message"}
                className={cn(
                  "size-9 rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition-all duration-200 hover:bg-primary/90 disabled:opacity-45 disabled:shadow-none",
                  isLoading
                    ? "pointer-events-auto cursor-pointer"
                    : !hasSubmittableInput && "cursor-not-allowed",
                )}
              >
                {isLoading ? (
                  <Stop size={16} className="text-primary-foreground" />
                ) : (
                  <ArrowUp size={16} className="text-primary-foreground" />
                )}
              </PromptInputSubmit>
            </div>
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  )
}

export function ChatView() {
  const {
    messages,
    currentSessionId,
    currentSession,
    isLoading,
    isServerReady,
    error,
    sendMessage,
    stopSession,
    createSession,
    forkSession,
  } = useSessions()

  const navigate = useNavigate()

  const promptQueue = usePromptQueue(currentSessionId)
  // Handler for forking from a message
  const handleFork = useCallback(
    async (messageId: string) => {
      const newSessionId = await forkSession(messageId)
      if (newSessionId) {
        navigate({ to: "/studio/$sessionId", params: { sessionId: newSessionId } })
      }
    },
    [forkSession, navigate],
  )

  // Handler for copying message text
  const handleCopyText = useCallback(async (messageId: string) => {
    const state = useSessionStore.getState()
    const parts = state.parts[messageId] || []
    const rawText = parts
      .filter((p) => p.type === "text" && p.text)
      .map((p) => p.text!)
      .join("")
    await navigator.clipboard.writeText(getDisplayMessageText(rawText))
  }, [])

  const firstUserMessageId = useMemo(() => messages.find((m) => m.role === "user")?.id, [messages])
  const hideInitialMessageActions = useMemo(() => {
    const userCount = messages.reduce(
      (count, message) => count + (message.role === "user" ? 1 : 0),
      0,
    )
    if (userCount !== 1) return false

    const firstAssistant = messages.find((m) => m.role === "assistant")
    if (!firstAssistant) return false

    const hasCompletedAssistant = messages.some(
      (m) => m.role === "assistant" && m.time.completed !== undefined,
    )
    if (hasCompletedAssistant) return false

    return firstAssistant.isStreaming && firstAssistant.time.completed === undefined
  }, [messages])

  if (!isServerReady) {
    return <LoadingState />
  }

  if (error) {
    return <ErrorState error={error} />
  }

  if (!currentSessionId) {
    return <EmptyState onCreateSession={() => createSession()} />
  }

  return (
    <PromptInputProvider>
      <AttachmentBridgeConnector />
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        {/* Messages area - flex-1 + min-h-0 allows proper flex shrinking */}
        <Conversation className="scrollbar-none flex-1 min-h-0">
          <ConversationContent className="scrollbar-none px-4">
            {messages.length === 0
              ? null
              : messages.map((message, index) => {
                  // Check if this is the last assistant message
                  const isLastAssistant =
                    message.role === "assistant" &&
                    !messages.slice(index + 1).some((m) => m.role === "assistant")

                  return message.role === "user" ? (
                    <UserMessage
                      key={message.id}
                      message={message}
                      index={index}
                      onCopyText={handleCopyText}
                      hideActions={hideInitialMessageActions && message.id === firstUserMessageId}
                    />
                  ) : (
                    <AssistantMessage
                      key={message.id}
                      message={message}
                      index={index}
                      isLast={isLastAssistant}
                      onFork={handleFork}
                      onCopyText={handleCopyText}
                    />
                  )
                })}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        {/* Input area */}
        <div className="shrink-0">
          {/* Question prompts - shown when AI is asking questions */}
          <QuestionList className="px-4 pb-2" />

          <ChatInputArea
            isLoading={isLoading}
            sendMessage={sendMessage}
            stopSession={stopSession}
            sessionId={currentSessionId}
            sessionCwd={currentSession?.cwd ?? null}
            promptQueue={promptQueue}
          />
        </div>
      </div>
    </PromptInputProvider>
  )
}
