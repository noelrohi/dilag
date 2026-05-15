import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@dilag/ui/collapsible"
import { AltArrowRight, CheckCircle, DangerTriangle, ClockCircle } from "@solar-icons/react"
import { getToolConfig, isStructuredSubtitle, type ToolRenderProps } from "@/lib/tool-registry"
import type { ToolState } from "@/context/session-store"
import { cn } from "@/lib/utils"
import { Shimmer } from "@/components/ai-elements/shimmer"
import { useElapsedTime } from "@/hooks/use-elapsed-time"
import type { ReactNode } from "react"

interface ToolPartProps {
  tool: string
  state: ToolState
}

// Tools are collapsed by default; the turn-level work group owns first-level disclosure.
const DEFAULT_OPEN_TOOLS: string[] = []

function renderSubtitleText(subtitle: ReactNode | { text: ReactNode }) {
  const value = isStructuredSubtitle(subtitle) ? subtitle.text : subtitle
  if (typeof value === "string" || typeof value === "number") return String(value)
  return "Working"
}

export function ToolPart({ tool, state }: ToolPartProps) {
  const config = getToolConfig(tool)
  const Icon = config.icon
  const defaultOpen = DEFAULT_OPEN_TOOLS.includes(tool)
  const elapsed = useElapsedTime(state.time?.start ?? Date.now(), state.time?.end)

  // Build render props from state
  const props: ToolRenderProps = {
    tool,
    input: state.input ?? {},
    output: state.status === "completed" ? state.output : undefined,
    error: state.status === "error" ? state.error : undefined,
    status: state.status,
    metadata: "metadata" in state ? state.metadata : undefined,
  }

  const title = config.title(props)
  const expandedTitle = config.expandedTitle?.(props) ?? title
  const subtitle = config.subtitle?.(props)
  const content = config.content?.(props)
  const hasContent = !!content || state.status === "error"

  const statusLabel =
    state.status === "completed" ? "Success" : state.status === "error" ? "Failed" : "Running"
  const StatusIcon =
    state.status === "completed"
      ? CheckCircle
      : state.status === "error"
        ? DangerTriangle
        : ClockCircle

  return (
    <Collapsible defaultOpen={defaultOpen}>
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
            {state.status === "pending" ? (
              <Shimmer className="font-medium whitespace-nowrap" duration={1.5}>
                {subtitle ? renderSubtitleText(subtitle) : title}
              </Shimmer>
            ) : (
              <>
                <span className="hidden truncate font-medium text-foreground group-data-[state=open]:inline">
                  {expandedTitle}
                </span>
                <span className="flex min-w-0 items-center gap-1.5 group-data-[state=open]:hidden">
                  <span className="font-medium text-foreground whitespace-nowrap">{title}</span>
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
          {state.status === "running" && (
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
        <CollapsibleContent className="mt-1 overflow-hidden rounded-lg bg-[#2a2a2a] text-[#e2e2e2] shadow-sm">
          <div className="max-h-72 overflow-y-auto p-3">
            <div className="[&_pre]:!bg-transparent [&_code]:!bg-transparent [&_pre]:!m-0 [&_pre]:!p-0 [&_pre]:!text-[#e2e2e2] [&_code]:!text-[#e2e2e2] [&_*]:!border-neutral-700/70">
              <div className="mb-3 flex items-baseline gap-2 text-xs">
                <span className="font-medium text-[#a8a8a8]">{title}</span>
                {subtitle && (
                  <span className="min-w-0 truncate text-[#e2e2e2]">
                    {renderSubtitleText(subtitle)}
                  </span>
                )}
              </div>
              {content}
            </div>
            {state.status === "error" && state.error && (
              <p className="mt-3 text-xs text-red-400">{state.error}</p>
            )}
          </div>
          <div className="flex items-center justify-end gap-1.5 px-3 pb-3 text-xs text-[#9b9b9b]">
            <StatusIcon size={13} className={state.status === "error" ? "text-red-400" : ""} />
            <span>{statusLabel}</span>
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  )
}
