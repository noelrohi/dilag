import { useState } from "react";
import { Loader2 } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { getVersion } from "@tauri-apps/api/app";
import { useQuery } from "@tanstack/react-query";
import { useLicenseContext } from "@/context/license-context";
import { ActivationModal } from "./activation-modal";
import { DilagIcon } from "@/components/ui/dilag-icon";
import { cn } from "@/lib/utils";

const AUTH_URL = import.meta.env.PROD
  ? "https://dilag.noelrohi.com/sign-up?from=desktop"
  : "http://localhost:3000/sign-up?from=desktop";

interface LicenseGateProps {
  children: React.ReactNode;
}

export function LicenseGate({ children }: LicenseGateProps) {
  const { status, loading, error } = useLicenseContext();
  const [starting, setStarting] = useState(false);
  const [showActivation, setShowActivation] = useState(false);

  const { data: version } = useQuery({
    queryKey: ["app", "version"],
    queryFn: getVersion,
    staleTime: Infinity,
  });

  // Show loading state
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="relative">
          <div className="absolute inset-0 blur-2xl bg-primary/20 rounded-full animate-pulse" />
          <Loader2 className="relative size-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  // Allow access for trial and activated users
  if (status?.type === "Trial" || status?.type === "Activated") {
    return <>{children}</>;
  }

  // First-time user - show welcome screen
  if (status?.type === "NoLicense") {
    const handleGetStarted = async () => {
      setStarting(true);
      try {
        await openUrl(AUTH_URL);
      } catch {
        // Error handled by context
      } finally {
        setStarting(false);
      }
    };

    return (
      <>
        <div className="relative flex h-screen overflow-hidden bg-background">
          <div className="grain absolute inset-0 pointer-events-none z-10" />

          {/* Background glow */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/10 blur-3xl" />
          </div>

          {/* Main content */}
          <div className="relative z-10 flex flex-col items-center justify-center w-full px-8">
            <div className="max-w-sm w-full text-center">
              {/* Logo */}
              <div className="mb-8">
                <DilagIcon className="size-16 mx-auto text-primary" />
              </div>

              {/* Heading */}
              <h1 className="text-3xl font-semibold text-foreground mb-3">
                Welcome to Dilag
              </h1>
              <p className="text-muted-foreground mb-8 text-balance">
                AI-powered design for mobile and web apps. Start your 7-day free trial.
              </p>

              {/* CTA buttons */}
              <div className="space-y-3">
                <button
                  onClick={handleGetStarted}
                  disabled={starting}
                  className={cn(
                    "w-full h-11 rounded-lg font-medium text-sm flex items-center justify-center gap-2",
                    "bg-primary text-primary-foreground",
                    "hover:bg-primary/90 transition-colors",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  {starting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      <span>Opening browser...</span>
                    </>
                  ) : (
                    <span>Get Started</span>
                  )}
                </button>

                <button
                  onClick={() => setShowActivation(true)}
                  className={cn(
                    "w-full h-10 rounded-lg text-sm flex items-center justify-center",
                    "text-muted-foreground hover:text-foreground transition-colors"
                  )}
                >
                  Enter License Key
                </button>
              </div>

              {error && (
                <div className="mt-6 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}
            </div>
          </div>

          {/* Version */}
          <div className="absolute bottom-6 left-6 flex items-center gap-1.5 text-xs text-muted-foreground/40">
            <DilagIcon className="size-3" />
            {version && `v${version}`}
          </div>
        </div>

        <ActivationModal
          open={showActivation}
          onOpenChange={setShowActivation}
          allowClose
        />
      </>
    );
  }

  // Trial expired or requires validation - block access
  if (status?.type === "TrialExpired" || status?.type === "RequiresValidation") {
    return (
      <>
        <div className="relative flex h-screen items-center justify-center bg-background overflow-hidden">
          <div className="grain absolute inset-0 pointer-events-none z-10" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/10 blur-3xl" />

          <div className="relative z-10 max-w-sm w-full px-8 text-center">
            <div className="mb-8">
              <DilagIcon className="size-16 mx-auto text-primary" />
            </div>

            <h1 className="text-3xl font-semibold text-foreground mb-3">
              {status.type === "TrialExpired" ? "Trial Ended" : "Verification Needed"}
            </h1>

            <p className="text-muted-foreground mb-8">
              {status.type === "TrialExpired"
                ? "Your 7-day trial has ended. Enter a license key to continue."
                : "Connect to the internet to validate your license."}
            </p>

            <button
              onClick={() => setShowActivation(true)}
              className={cn(
                "w-full h-11 rounded-lg font-medium text-sm flex items-center justify-center",
                "bg-primary text-primary-foreground",
                "hover:bg-primary/90 transition-colors"
              )}
            >
              Enter License Key
            </button>
          </div>
        </div>

        <ActivationModal
          open={showActivation}
          onOpenChange={setShowActivation}
          allowClose={false}
        />
      </>
    );
  }

  // Fallback for error state
  return (
    <div className="flex h-screen items-center justify-center bg-background p-8">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-xl font-semibold text-foreground">Something went wrong</h1>
        <p className="text-muted-foreground">
          {status?.type === "Error" ? status.message : "Unable to verify license status"}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 rounded-lg bg-secondary text-secondary-foreground text-sm hover:bg-accent transition-colors"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
