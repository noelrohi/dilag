import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { ExternalLink, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SetupStatus = "checking" | "not-installed" | "installed" | "error";

type DependencyStatus = {
  opencode: SetupStatus;
  bun: SetupStatus;
};

interface SetupWizardProps {
  onComplete: () => void;
}

// Animated orb component for the loading/status indicator
function StatusOrb({ status }: { status: SetupStatus }) {
  return (
    <div className="relative size-20">
      {/* Outer glow ring */}
      <div
        className={cn(
          "absolute inset-0 rounded-full blur-xl transition-all duration-700",
          status === "checking" && "bg-primary/30 animate-pulse",
          status === "installed" && "bg-emerald-500/40",
          status === "not-installed" && "bg-amber-500/30",
          status === "error" && "bg-rose-500/30",
        )}
      />

      {/* Main orb */}
      <div
        className={cn(
          "relative size-20 rounded-full flex items-center justify-center transition-all duration-500",
          "bg-linear-to-br shadow-lg",
          status === "checking" &&
            "from-primary/80 to-primary shadow-primary/25",
          status === "installed" &&
            "from-emerald-400 to-emerald-600 shadow-emerald-500/25",
          status === "not-installed" &&
            "from-amber-400 to-amber-600 shadow-amber-500/25",
          status === "error" && "from-rose-400 to-rose-600 shadow-rose-500/25",
        )}
      >
        {/* Inner icon/animation */}
        {status === "checking" && (
          <div className="relative">
            <div className="size-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        )}
        {status === "installed" && (
          <svg
            className="size-10 text-white animate-in zoom-in-50 duration-300"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
        {status === "not-installed" && (
          <span className="text-3xl font-serif text-white/90">?</span>
        )}
        {status === "error" && (
          <span className="text-2xl font-medium text-white/90">!</span>
        )}
      </div>
    </div>
  );
}

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const [status, setStatus] = useState<DependencyStatus>({
    opencode: "checking",
    bun: "checking",
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [currentCheck, setCurrentCheck] = useState<"opencode" | "bun">("opencode");

  const checkDependencies = async () => {
    setStatus({ opencode: "checking", bun: "checking" });
    setErrorMessage(null);
    setCurrentCheck("opencode");

    try {
      const opencodeResult = await invoke<{
        installed: boolean;
        version: string | null;
        error: string | null;
      }>("check_opencode_installation");

      if (!opencodeResult.installed) {
        setStatus({ opencode: "not-installed", bun: "not-installed" });
        if (opencodeResult.error) {
          setErrorMessage(opencodeResult.error);
        }
        return;
      }

      setStatus((prev) => ({ ...prev, opencode: "installed" }));
      setCurrentCheck("bun");

      const bunResult = await invoke<{
        installed: boolean;
        version: string | null;
        error: string | null;
      }>("check_bun_installation");

      if (!bunResult.installed) {
        setStatus((prev) => ({ ...prev, bun: "not-installed" }));
        if (bunResult.error) {
          setErrorMessage(bunResult.error);
        }
        return;
      }

      setStatus({ opencode: "installed", bun: "installed" });
      setTimeout(() => {
        onComplete();
      }, 800);
    } catch (err) {
      setStatus({
        opencode: currentCheck === "opencode" ? "error" : status.opencode,
        bun: currentCheck === "bun" ? "error" : "not-installed",
      });
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  };

  useEffect(() => {
    checkDependencies();
  }, []);

  const overallStatus: SetupStatus =
    status.opencode === "checking" || status.bun === "checking"
      ? "checking"
      : status.opencode === "installed" && status.bun === "installed"
        ? "installed"
        : status.opencode === "error" || status.bun === "error"
          ? "error"
          : "not-installed";

  const missingDependency =
    status.opencode !== "installed"
      ? "opencode"
      : status.bun !== "installed"
        ? "bun"
        : null;

  const handleOpenDocs = async () => {
    if (missingDependency === "bun") {
      await openUrl("https://bun.sh");
    } else {
      await openUrl("https://opencode.ai");
    }
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    await checkDependencies();
    setIsRetrying(false);
  };

  const isPossiblePathIssue =
    errorMessage?.toLowerCase().includes("no such file") ||
    errorMessage?.toLowerCase().includes("not found");

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-background overflow-hidden">
      {/* Subtle background gradient */}
      <div className="absolute inset-0 bg-linear-to-b from-primary/2 via-transparent to-transparent pointer-events-none" />

      {/* Main content */}
      <div className="relative z-10 max-w-sm w-full mx-auto px-8">
        <div className="flex flex-col items-center text-center">
          {/* Status Orb */}
          <div className="mb-10">
            <StatusOrb status={overallStatus} />
          </div>

          {/* Content based on status */}
          <div className="space-y-3 mb-8">
            {overallStatus === "checking" && (
              <>
                <h1 className="text-xl font-medium text-foreground animate-in fade-in duration-300">
                  Setting up...
                </h1>
                <p className="text-sm text-muted-foreground animate-in fade-in duration-500 delay-100">
                  {currentCheck === "opencode" ? "Looking for OpenCode" : "Looking for Bun"}
                </p>
              </>
            )}

            {overallStatus === "installed" && (
              <>
                <h1 className="text-xl font-medium text-foreground animate-in fade-in duration-300">
                  Ready to go
                </h1>
                <p className="text-sm text-muted-foreground animate-in fade-in duration-500 delay-100">
                  Launching Dilag...
                </p>
              </>
            )}

            {overallStatus === "not-installed" && (
              <>
                <h1 className="text-xl font-medium text-foreground animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {missingDependency === "bun" ? "Bun not found" : "OpenCode not found"}
                </h1>
                <p className="text-sm text-muted-foreground animate-in fade-in slide-in-from-bottom-2 duration-500 delay-75 max-w-70">
                  {isPossiblePathIssue
                    ? `${missingDependency === "bun" ? "Bun" : "OpenCode"} may be installed but not in your PATH. Try restarting Dilag after installation.`
                    : missingDependency === "bun"
                      ? "Dilag requires Bun to run web projects. Install it to continue."
                      : "Dilag requires OpenCode to be installed on your system."}
                </p>
              </>
            )}

            {overallStatus === "error" && (
              <>
                <h1 className="text-xl font-medium text-foreground animate-in fade-in duration-300">
                  Something went wrong
                </h1>
                <p className="text-sm text-muted-foreground animate-in fade-in duration-500 delay-100 max-w-70">
                  {errorMessage ||
                    "Unable to check dependencies. Please try again."}
                </p>
              </>
            )}
          </div>

          {/* Actions */}
          {(overallStatus === "not-installed" || overallStatus === "error") && (
            <div className="flex flex-col gap-2.5 w-full max-w-55 animate-in fade-in slide-in-from-bottom-3 duration-500 delay-150">
              <Button
                onClick={handleRetry}
                disabled={isRetrying}
                className="w-full h-10 rounded-full font-medium shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-shadow"
              >
                <RotateCw
                  className={cn("size-4 mr-2", isRetrying && "animate-spin")}
                />
                Check again
              </Button>
              <Button
                variant="ghost"
                onClick={handleOpenDocs}
                className="w-full h-10 rounded-full text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="size-4 mr-2" />
                {missingDependency === "bun" ? "Get Bun" : "Get OpenCode"}
              </Button>
              <button
                onClick={onComplete}
                className="text-xs text-muted-foreground/50 hover:text-muted-foreground mt-2 transition-colors"
              >
                Continue anyway
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
