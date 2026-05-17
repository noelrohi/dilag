import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@dilag/ui/collapsible"
import { AltArrowRight, CheckCircle, DangerTriangle, ClockCircle } from "@solar-icons/react"
import { getToolConfig, isStructuredSubtitle, type ToolRenderProps } from "@/lib/tool-registry"
import type { ToolState } from "@/context/session-store"
import { cn } from "@/lib/utils"
import { Shimmer } from "@/components/ai-elements/shimmer"
import { useElapsedTime } from "@/hooks/use-elapsed-time"
import { useMemo, useState, type ReactNode } from "react"

interface ToolPartProps {
  tool: string
  state: ToolState
  isMessageComplete?: boolean
}

// Tools are collapsed by default; the turn-level work group owns first-level disclosure.
const DEFAULT_OPEN_TOOLS: string[] = []

function renderSubtitleText(subtitle: ReactNode | { text: ReactNode }) {
  const value = isStructuredSubtitle(subtitle) ? subtitle.text : subtitle
  if (typeof value === "string" || typeof value === "number") return String(value)
  return "Working"
}

function displayedToolStatus(state: ToolState, isMessageComplete: boolean): ToolState["status"] {
  if (isMessageComplete && (state.status === "pending" || state.status === "running")) {
    return "completed"
  }
  return state.status
}

function isFileMutationTool(tool: string) {
  return tool === "write" || tool === "edit"
}

export function ToolPart({ tool, state, isMessageComplete = false }: ToolPartProps) {
  const config = getToolConfig(tool)
  const Icon = config.icon
  const defaultOpen = DEFAULT_OPEN_TOOLS.includes(tool)
  const [open, setOpen] = useState(defaultOpen)
  const elapsed = useElapsedTime(state.time?.start ?? Date.now(), state.time?.end)
  const status = displayedToolStatus(state, isMessageComplete)

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
  const subtitle = useMemo(() => config.subtitle?.(props), [config, props])
  const hasContent = !!config.content || status === "error"
  const content = useMemo(
    () => (open && config.content ? config.content(props) : null),
    [config, open, props],
  )
  const shouldShimmer = status === "pending" && !isFileMutationTool(tool)
  const shouldShimmerTitle = (status === "pending" || status === "running") && isFileMutationTool(tool)

  const statusLabel =
    status === "completed" ? "Success" : status === "error" ? "Failed" : "Running"
  const StatusIcon =
    status === "completed"
      ? CheckCircle
      : status === "error"
        ? DangerTriangle
        : ClockCircle

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        className={cn(
          "group flex w-full items-center justify-between gap-2",
          "h-8 px-2 py-1.5 rounded-md",
          "text-sm select-none cursor-default",
          "text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-colors",
          "data-[state=open]:bg-muted/20 data-[state=open]:text-foreground",
        )}
      >
        <div className="grid min-w-0 flex-1 grid-cols-[16px_minmax(0,1fr)_auto] items-center gap-2.5">
          <span className="flex size-4 shrink-0 items-center justify-center text-muted-foreground/80">
            <Icon className="size-[15px] stroke-[1.75]" />
          </span>
          <div className="flex min-w-0 items-center gap-2 overflow-hidden text-left">
            {shouldShimmer ? (
              <Shimmer className="font-medium whitespace-nowrap" duration={0.85}>
                {subtitle ? renderSubtitleText(subtitle) : title}
              </Shimmer>
            ) : (
              <>
                <span className="hidden truncate font-medium text-foreground group-data-[state=open]:inline">
                  {shouldShimmerTitle ? (
                    <Shimmer className="font-medium whitespace-nowrap" duration={0.85}>
                      {expandedTitle}
                    </Shimmer>
                  ) : (
                    expandedTitle
                  )}
                </span>
                <span className="flex min-w-0 items-center gap-1.5 group-data-[state=open]:hidden">
                  {shouldShimmerTitle ? (
                    <Shimmer className="font-medium whitespace-nowrap" duration={0.85}>
                      {title}
                    </Shimmer>
                  ) : (
                    <span className="font-medium text-foreground whitespace-nowrap">{title}</span>
                  )}
                  {subtitle ? (
                    <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                      {isStructuredSubtitle(subtitle) ? (
                        <>
                          <span className="truncate">{subtitle.text}</span>
                          {subtitle.suffix && <span className="shrink-0">{subtitle.suffix}</span>}
                        </>
                      ) : (
                        <span className="truncate">{subtitle}</span>
                      )}
                    </span>
                  ) : null}
                </span>
              </>
            )}
          </div>
          {status === "running" && (
            <span className="text-xs tabular-nums text-muted-foreground shrink-0">{elapsed}</span>
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
                <span className="font-medium text-muted-foreground">{title}</span>
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
            <StatusIcon size={13} className={status === "error" ? "text-destructive" : ""} />
            <span>{statusLabel}</span>
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  )
}
