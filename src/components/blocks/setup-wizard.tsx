import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Loader2, Terminal, CheckCircle2, XCircle, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type SetupStatus = "checking" | "not-installed" | "installed" | "error";

interface SetupWizardProps {
  onComplete: () => void;
}

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const [status, setStatus] = useState<SetupStatus>("checking");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const checkOpenCode = async () => {
    setStatus("checking");
    setErrorMessage(null);
    
    try {
      const result = await invoke<{ installed: boolean; version: string | null; error: string | null }>("check_opencode_installation");
      
      if (result.installed) {
        setStatus("installed");
        // Auto-proceed after a short delay
        setTimeout(() => {
          onComplete();
        }, 1000);
      } else {
        setStatus("not-installed");
        if (result.error) {
          setErrorMessage(result.error);
        }
      }
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  };

  useEffect(() => {
    checkOpenCode();
  }, []);

  const handleOpenDocs = async () => {
    await openUrl("https://opencode.ai");
  };

  const handleRetry = () => {
    checkOpenCode();
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full mx-auto p-8">
        {/* Logo/Title */}
        <div className="text-center mb-8">
          <div className="size-16 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Terminal className="size-8 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground">Welcome to Dilag</h1>
          <p className="text-muted-foreground mt-2">
            AI-powered UI design studio
          </p>
        </div>

        {/* Status Card */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          {status === "checking" && (
            <div className="flex flex-col items-center text-center space-y-3">
              <Loader2 className="size-8 text-primary animate-spin" />
              <div>
                <p className="font-medium">Checking dependencies...</p>
                <p className="text-sm text-muted-foreground">
                  Looking for OpenCode CLI
                </p>
              </div>
            </div>
          )}

          {status === "installed" && (
            <div className="flex flex-col items-center text-center space-y-3">
              <CheckCircle2 className="size-8 text-green-500" />
              <div>
                <p className="font-medium text-green-600">OpenCode found!</p>
                <p className="text-sm text-muted-foreground">
                  Starting Dilag...
                </p>
              </div>
            </div>
          )}

          {status === "not-installed" && (
            <div className="space-y-4">
              <div className="flex flex-col items-center text-center space-y-3">
                <XCircle className="size-8 text-amber-500" />
                <div>
                  <p className="font-medium">OpenCode CLI not found</p>
                  <p className="text-sm text-muted-foreground">
                    Dilag requires OpenCode to be installed
                  </p>
                </div>
              </div>

              {/* Installation Instructions */}
              <div className="rounded-lg bg-muted/50 p-4 space-y-3">
                <p className="text-sm font-medium">Install OpenCode:</p>
                <div className="space-y-2">
                  <code className="block text-xs bg-background rounded px-3 py-2 font-mono">
                    npm install -g opencode
                  </code>
                  <p className="text-xs text-muted-foreground text-center">or</p>
                  <code className="block text-xs bg-background rounded px-3 py-2 font-mono">
                    bun install -g opencode
                  </code>
                </div>
              </div>

              {errorMessage && (
                <p className="text-xs text-destructive text-center">
                  {errorMessage}
                </p>
              )}

              <div className="flex flex-col gap-2">
                <Button onClick={handleRetry} className="w-full">
                  <RefreshCw className="size-4 mr-2" />
                  Check Again
                </Button>
                <Button variant="outline" onClick={handleOpenDocs} className="w-full">
                  <ExternalLink className="size-4 mr-2" />
                  OpenCode Docs
                </Button>
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-4">
              <div className="flex flex-col items-center text-center space-y-3">
                <XCircle className="size-8 text-destructive" />
                <div>
                  <p className="font-medium text-destructive">Setup Error</p>
                  <p className="text-sm text-muted-foreground">
                    {errorMessage || "An unexpected error occurred"}
                  </p>
                </div>
              </div>

              <Button onClick={handleRetry} className="w-full">
                <RefreshCw className="size-4 mr-2" />
                Try Again
              </Button>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground/60 mt-6">
          Dilag uses OpenCode as its AI backend
        </p>
      </div>
    </div>
  );
}
