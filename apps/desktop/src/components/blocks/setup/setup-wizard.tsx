import { useState, useEffect, useCallback } from "react"
import { bridge } from "@/lib/bridge"
import { cn } from "@/lib/utils"

type SetupStage = "checking" | "missing" | "installing" | "installed" | "error"

interface SetupWizardProps {
  onComplete: () => void
}

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const [stage, setStage] = useState<SetupStage>("checking")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const checkDependencies = useCallback(async () => {
    setStage("checking")
    setErrorMessage(null)

    try {
      await bridge.agent.start()
      setStage("installed")
      setTimeout(onComplete, 600)
    } catch (err) {
      setStage("error")
      setErrorMessage(err instanceof Error ? err.message : String(err))
    }
  }, [onComplete])

  const handleInstall = async () => {
    await checkDependencies()
  }

  useEffect(() => {
    checkDependencies()
  }, [checkDependencies])

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-xs px-6">
        {/* Minimal status indicator */}
        <div className="flex justify-center mb-8">
          <div
            className={cn(
              "size-3 rounded-full transition-all duration-500",
              stage === "checking" && "bg-muted-foreground/40 animate-pulse",
              stage === "missing" && "bg-amber-500",
              stage === "installing" && "bg-primary animate-pulse",
              stage === "installed" && "bg-emerald-500",
              stage === "error" && "bg-rose-500",
            )}
          />
        </div>

        {/* Content */}
        <div className="text-center space-y-2">
          {stage === "checking" && (
            <p className="text-sm text-muted-foreground">Checking setup...</p>
          )}

          {stage === "installed" && <p className="text-sm text-muted-foreground">Ready</p>}

          {stage === "missing" && (
            <>
              <p className="text-sm text-foreground">Install required dependencies</p>
              <p className="text-xs text-muted-foreground">Pi runtime could not be initialized</p>
            </>
          )}

          {stage === "installing" && (
            <>
              <p className="text-sm text-foreground">Installing...</p>
              <p className="text-xs text-muted-foreground">This may take a moment</p>
            </>
          )}

          {stage === "error" && (
            <>
              <p className="text-sm text-foreground">Setup failed</p>
              <p className="text-xs text-muted-foreground max-w-60 mx-auto">
                {errorMessage || "Something went wrong"}
              </p>
            </>
          )}
        </div>

        {/* Actions */}
        {(stage === "missing" || stage === "error") && (
          <div className="mt-8 flex flex-col items-center gap-3">
            <button
              onClick={stage === "error" ? checkDependencies : handleInstall}
              className={cn(
                "h-9 px-5 rounded-full text-sm font-medium transition-all",
                "bg-foreground text-background",
                "hover:opacity-90 active:scale-[0.98]",
              )}
            >
              {stage === "error" ? "Try again" : "Install"}
            </button>

            <button
              onClick={onComplete}
              className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
            >
              Skip
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
