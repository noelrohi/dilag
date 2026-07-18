import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@dilag/ui/collapsible"
import {
  IconChevronRight as AltArrowRight,
  IconCircleCheck as CheckCircle,
  IconAlertTriangle as DangerTriangle,
  IconClock as ClockCircle,
} from "@tabler/icons-react"
import {
  getToolConfig,
  isStructuredSubtitle,
  type StructuredSubtitle,
  type ToolRenderProps,
} from "@/lib/tool-registry"
import type { ToolState } from "@/context/session-store"
import { cn } from "@/lib/utils"
import { useElapsedTime } from "@/hooks/use-elapsed-time"
import { isValidElement, useMemo, useRef, useState, type ReactNode } from "react"

interface ToolPartProps {
  tool: string
  state: ToolState
  isMessageComplete?: boolean
}

// Tools are collapsed by default; the turn-level work group owns first-level disclosure.
const DEFAULT_OPEN_TOOLS: string[] = []

function renderSubtitleText(subtitle: ReactNode | StructuredSubtitle) {
  const value = isStructuredSubtitle(subtitle) ? subtitle.text : subtitle
  if (typeof value === "string" || typeof value === "number") return String(value)
  return "Working"
}

function reactNodeText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return ""
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(reactNodeText).filter(Boolean).join(" ")
  if (!isValidElement(node)) return ""

  const props = node.props as { "aria-label"?: unknown; children?: ReactNode }
  if (typeof props["aria-label"] === "string") return props["aria-label"]
  return reactNodeText(props.children)
}

function renderSubtitleAccessibleText(subtitle: ReactNode | StructuredSubtitle) {
  if (!isStructuredSubtitle(subtitle)) return reactNodeText(subtitle)
  if (subtitle.ariaText) return subtitle.ariaText

  return [reactNodeText(subtitle.text), reactNodeText(subtitle.suffix)].filter(Boolean).join(" ")
}

function isFileMutationTool(tool: string) {
  return tool === "write" || tool === "edit"
}

export function ToolPart({ tool, state }: ToolPartProps) {
  const config = getToolConfig(tool)
  const defaultOpen = DEFAULT_OPEN_TOOLS.includes(tool)
  const [open, setOpen] = useState(defaultOpen)
  const fallbackStartRef = useRef<number | null>(null)
  if (fallbackStartRef.current === null) fallbackStartRef.current = Date.now()
  const status = state.status
  const elapsedStart = state.time?.start ?? fallbackStartRef.current
  const elapsedEnd =
    status === "running" ? state.time?.end : (state.time?.end ?? state.time?.start ?? elapsedStart)
  const elapsed = useElapsedTime(elapsedStart, elapsedEnd)

  // Build render props from state
  const props: ToolRenderProps = useMemo(
    () => ({
      tool,
      input: state.input ?? {},
      output: status === "completed" ? state.output : undefined,
      error: status === "error" ? state.error : undefined,
      status,
      metadata: "metadata" in state ? state.metadata : undefined,
    }),
    [state.error, state.input, state.metadata, state.output, status, tool],
  )

  const title = useMemo(() => config.title(props), [config, props])
  const expandedTitle = useMemo(
    () => config.expandedTitle?.(props) ?? title,
    [config, props, title],
  )
  const contentTitle = useMemo(() => config.contentTitle?.(props) ?? title, [config, props, title])
  const subtitle = useMemo(() => config.subtitle?.(props), [config, props])
  const subtitleText = subtitle ? renderSubtitleAccessibleText(subtitle) : undefined
  const hasContent = !!config.content || status === "error"
  const content = useMemo(
    () => (open && config.content ? config.content(props) : null),
    [config, open, props],
  )
  const shouldShimmer = status === "pending" && !isFileMutationTool(tool)
  const shouldShimmerTitle =
    (status === "pending" || status === "running") && isFileMutationTool(tool)
  const exitCode = tool === "bash" ? (props.metadata?.exit as number | null | undefined) : undefined
  const hasExitCodeFailure = exitCode !== undefined && exitCode !== null && exitCode !== 0

  const statusLabel = hasExitCodeFailure
    ? `Exit code ${exitCode}`
    : status === "completed"
      ? "Success"
      : status === "error"
        ? state.error === "Interrupted"
          ? "Interrupted"
          : "Failed"
        : status === "pending"
          ? "Pending"
          : "Running"
  const StatusIcon =
    status === "completed" && !hasExitCodeFailure
      ? CheckCircle
      : status === "error" || hasExitCodeFailure
        ? DangerTriangle
        : ClockCircle
  const triggerLabel = [open ? expandedTitle : title, subtitleText, statusLabel]
    .filter(Boolean)
    .join(" ")
    .trim()

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        aria-label={triggerLabel}
        className={cn(
          "group flex w-full items-center justify-start gap-1.5",
          "h-7 overflow-hidden rounded-md px-2 py-1",
          "text-sm select-none cursor-default",
          "text-muted-foreground hover:text-foreground transition-colors",
          "data-[state=open]:text-foreground",
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden text-left whitespace-nowrap">
          {shouldShimmer ? (
            <span className={cn("shimmer", "min-w-0 truncate whitespace-nowrap")}>
              {subtitle ? renderSubtitleText(subtitle) : title}
            </span>
          ) : open ? (
            <span className="min-w-0 truncate text-foreground">
              {shouldShimmerTitle ? (
                <span className={cn("shimmer", "whitespace-nowrap")}>{expandedTitle}</span>
              ) : (
                expandedTitle
              )}
            </span>
          ) : (
            <>
              {shouldShimmerTitle ? (
                <span className={cn("shimmer", "shrink-0 whitespace-nowrap")}>{title}</span>
              ) : (
                <span className="shrink-0 whitespace-nowrap text-foreground">{title}</span>
              )}
              {subtitle ? (
                <span className="flex min-w-0 items-center gap-1.5 truncate text-muted-foreground">
                  {isStructuredSubtitle(subtitle) ? (
                    <>
                      <span className="min-w-0 truncate">{subtitle.text}</span>
                      {subtitle.suffix && <span className="shrink-0">{subtitle.suffix}</span>}
                    </>
                  ) : (
                    <span className="min-w-0 truncate">{subtitle}</span>
                  )}
                </span>
              ) : null}
            </>
          )}
          {status === "running" && (
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{elapsed}</span>
          )}
        </div>
        {hasContent && (
          <AltArrowRight
            size={16}
            className={cn(
              "shrink-0 text-muted-foreground opacity-0 transition-all duration-150",
              "group-hover:opacity-100 group-data-[state=open]:opacity-100 group-data-[state=open]:rotate-90",
            )}
          />
        )}
      </CollapsibleTrigger>

      {hasContent && (
        <CollapsibleContent className="mt-1 overflow-hidden rounded-lg border border-border/60 bg-card text-card-foreground shadow-sm">
          <div className="max-h-72 overflow-y-auto p-3">
            <div className="[&_pre]:!bg-transparent [&_code]:!bg-transparent [&_pre]:!m-0 [&_pre]:!p-0 [&_pre]:!text-card-foreground [&_code]:!text-card-foreground [&_*]:!border-border/70">
              <div className="mb-3 flex items-baseline gap-2 text-xs">
                <span className="font-medium text-muted-foreground">{contentTitle}</span>
                {subtitle && (
                  <span className="min-w-0 truncate text-card-foreground">
                    {renderSubtitleText(subtitle)}
                  </span>
                )}
              </div>
              {content}
            </div>
            {status === "error" && state.error && (
              <p className="mt-3 text-xs text-destructive">{state.error}</p>
            )}
          </div>
          <div className="flex items-center justify-end gap-1.5 px-3 pb-3 text-xs text-muted-foreground">
            <StatusIcon
              size={13}
              className={status === "error" || hasExitCodeFailure ? "text-destructive" : ""}
            />
            <span>{statusLabel}</span>
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  )
}
