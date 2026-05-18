import { useState, useEffect, useRef } from "react"
import { IconAlertTriangle as DangerTriangle, IconCircleX as CloseCircle, IconCopy as Copy, IconMessageCircle as ChatRoundDots, IconChevronDown as AltArrowDown, IconCircleCheck as CheckCircle } from "@tabler/icons-react"
import { Button } from "@dilag/ui/button"
import { cn } from "@/lib/utils"
import { bridge } from "@/lib/bridge"

interface ServerErrorOverlayProps {
  className?: string
  onSendToChat?: (error: string) => void
}

export function ServerErrorOverlay({ className, onSendToChat }: ServerErrorOverlayProps) {
  const [errors, setErrors] = useState<string[]>([])
  const [isExpanded, setIsExpanded] = useState(true)
  const [isDismissed, setIsDismissed] = useState(false)
  const [copied, setCopied] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Listen for Vite error events
  useEffect(() => {
    const unsubscribeError = bridge.dev.onViteError((line) => {
      setErrors((prev) => [...prev.slice(-9), line]) // Keep last 10 errors
      setIsDismissed(false) // Show overlay when new error arrives
    })

    // Clear errors on successful server start
    const unsubscribeStdout = bridge.dev.onViteStdout((line) => {
      // Vite outputs "ready in" or "Local:" when server starts successfully
      if (line.includes("ready in") || line.includes("Local:")) {
        setErrors([])
        setIsDismissed(false)
      }
    })

    return () => {
      unsubscribeError()
      unsubscribeStdout()
    }
  }, [])

  // Auto-scroll to bottom when new errors arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [errors])

  // Reset copied state after 2 seconds
  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [copied])

  // Don't show if no errors or dismissed
  if (errors.length === 0 || isDismissed) return null

  const allErrors = errors.join("\n\n")

  const handleCopy = async () => {
    await navigator.clipboard.writeText(allErrors)
    setCopied(true)
  }

  const handleSendToChat = () => {
    onSendToChat?.(allErrors)
    setIsDismissed(true)
  }

  const handleDismiss = () => {
    setIsDismissed(true)
  }

  return (
    <div
      className={cn(
        "absolute inset-0 z-10 bg-background/80 backdrop-blur-sm",
        "flex items-center justify-center p-4",
        className,
      )}
    >
      <div className="w-full max-w-lg bg-card border border-destructive/30 rounded-lg shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-destructive/20 bg-destructive/5">
          <div className="flex items-center gap-2 text-destructive">
            <DangerTriangle size={16} />
            <span className="font-medium text-sm">Server Error</span>
            <span className="text-xs text-muted-foreground">
              ({errors.length} error{errors.length > 1 ? "s" : ""})
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="size-7 p-0"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <AltArrowDown
                size={16}
                className={cn("transition-transform", !isExpanded && "-rotate-90")}
              />
            </Button>
            <Button variant="ghost" size="sm" className="size-7 p-0" onClick={handleDismiss}>
              <CloseCircle size={16} />
            </Button>
          </div>
        </div>

        {/* Error content */}
        {isExpanded && (
          <>
            <div
              ref={scrollRef}
              className="max-h-48 overflow-y-auto p-4 font-mono text-xs text-destructive/90 bg-destructive/5"
            >
              <pre className="whitespace-pre-wrap break-words">{allErrors}</pre>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-destructive/20">
              <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
                {copied ? (
                  <>
                    <CheckCircle size={14} />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    Copy
                  </>
                )}
              </Button>
              {onSendToChat && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleSendToChat}
                  className="gap-1.5 bg-destructive hover:bg-destructive/90"
                >
                  <ChatRoundDots size={14} />
                  Send to Chat
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
