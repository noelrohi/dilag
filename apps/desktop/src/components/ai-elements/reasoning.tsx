"use client"

import { useControllableState } from "radix-ui/internal"
import { IconBrain as BrainIcon, IconChevronDown as ChevronDownIcon } from "@tabler/icons-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@dilag/ui/collapsible"
import { cn } from "@/lib/utils"
import type { ComponentProps, ReactNode } from "react"
import { createContext, memo, useContext, useEffect, useState } from "react"
import { Streamdown } from "streamdown"
import { Shimmer } from "./shimmer"

type ReasoningContextValue = {
  isStreaming: boolean
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  duration: number | undefined
}

const ReasoningContext = createContext<ReasoningContextValue | null>(null)

export const useReasoning = () => {
  const context = useContext(ReasoningContext)
  if (!context) {
    throw new Error("Reasoning components must be used within Reasoning")
  }
  return context
}

export type ReasoningProps = ComponentProps<typeof Collapsible> & {
  isStreaming?: boolean
  open?: boolean
  defaultOpen?: boolean
  autoClose?: boolean
  onOpenChange?: (open: boolean) => void
  duration?: number
}

const AUTO_CLOSE_DELAY = 1000
const MS_IN_S = 1000

export const Reasoning = memo(
  ({
    className,
    isStreaming = false,
    open,
    defaultOpen = true,
    autoClose = true,
    onOpenChange,
    duration: durationProp,
    children,
    ...props
  }: ReasoningProps) => {
    const [isOpen, setIsOpen] = useControllableState({
      prop: open,
      defaultProp: defaultOpen,
      onChange: onOpenChange,
    })
    const [duration, setDuration] = useControllableState({
      prop: durationProp,
      defaultProp: undefined,
    })

    const [hasAutoClosed, setHasAutoClosed] = useState(false)
    const [startTime, setStartTime] = useState<number | null>(null)

    // Track duration when streaming starts and ends
    useEffect(() => {
      if (isStreaming) {
        if (startTime === null) {
          setStartTime(Date.now())
        }
      } else if (startTime !== null) {
        setDuration(Math.ceil((Date.now() - startTime) / MS_IN_S))
        setStartTime(null)
      }
    }, [isStreaming, startTime, setDuration])

    // Auto-open whenever streaming starts. A reasoning part can mount closed and later become
    // the active streaming part as the SDK appends/updates parts, so don't rely on defaultOpen
    // only being read during the first render.
    useEffect(() => {
      if (!isStreaming) return
      setIsOpen(true)
      setHasAutoClosed(false)
    }, [isStreaming, setIsOpen])

    // Auto-close when streaming ends (once only)
    useEffect(() => {
      if (autoClose && defaultOpen && !isStreaming && isOpen && !hasAutoClosed) {
        // Add a small delay before closing to allow user to see the content
        const timer = setTimeout(() => {
          setIsOpen(false)
          setHasAutoClosed(true)
        }, AUTO_CLOSE_DELAY)

        return () => clearTimeout(timer)
      }
    }, [autoClose, isStreaming, isOpen, defaultOpen, setIsOpen, hasAutoClosed])

    const handleOpenChange = (newOpen: boolean) => {
      setIsOpen(newOpen)
    }

    return (
      <ReasoningContext.Provider value={{ isStreaming, isOpen, setIsOpen, duration }}>
        <Collapsible
          className={cn("not-prose mb-4", className)}
          onOpenChange={handleOpenChange}
          open={isOpen}
          {...props}
        >
          {children}
        </Collapsible>
      </ReasoningContext.Provider>
    )
  },
)

export type ReasoningTriggerProps = ComponentProps<typeof CollapsibleTrigger> & {
  getThinkingMessage?: (isStreaming: boolean, duration?: number) => ReactNode
}

const defaultGetThinkingMessage = (isStreaming: boolean, duration?: number) => {
  if (isStreaming || duration === 0) {
    return <Shimmer as="span">Thinking...</Shimmer>
  }
  if (duration === undefined) {
    return <span>Thought for a few seconds</span>
  }
  return <span>Thought for {duration} seconds</span>
}

export const ReasoningTrigger = memo(
  ({
    className,
    children,
    getThinkingMessage = defaultGetThinkingMessage,
    ...props
  }: ReasoningTriggerProps) => {
    const { isStreaming, isOpen, duration } = useReasoning()

    return (
      <CollapsibleTrigger
        className={cn(
          "group flex h-7 w-full items-center gap-2 rounded-md px-0 py-1 text-left",
          "text-sm text-muted-foreground select-none cursor-default transition-colors hover:text-foreground",
          className,
        )}
        {...props}
      >
        {children ?? (
          <>
            <BrainIcon className="size-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate text-left">
              {getThinkingMessage(isStreaming, duration)}
            </span>
            <ChevronDownIcon
              className={cn(
                "size-4 shrink-0 opacity-0 transition-all duration-150 group-hover:opacity-100",
                isOpen ? "rotate-180" : "rotate-0",
              )}
            />
          </>
        )}
      </CollapsibleTrigger>
    )
  },
)

export type ReasoningContentProps = ComponentProps<typeof CollapsibleContent> & {
  children: string
}

export const ReasoningContent = memo(({ className, children, ...props }: ReasoningContentProps) => (
  <CollapsibleContent
    className={cn(
      "mt-4 text-sm",
      "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 text-muted-foreground outline-none data-[state=closed]:animate-out data-[state=open]:animate-in",
      className,
    )}
    {...props}
  >
    <Streamdown className="size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      {children}
    </Streamdown>
  </CollapsibleContent>
))

Reasoning.displayName = "Reasoning"
ReasoningTrigger.displayName = "ReasoningTrigger"
ReasoningContent.displayName = "ReasoningContent"
