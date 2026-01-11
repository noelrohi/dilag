import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useLicenseContext } from "@/context/license-context";
import { ActivationModal } from "./activation-modal";
import { cn } from "@/lib/utils";

interface LicenseGateProps {
  children: React.ReactNode;
}

export function LicenseGate({ children }: LicenseGateProps) {
  const { status, loading, startTrial, purchaseUrl, error } = useLicenseContext();
  const [starting, setStarting] = useState(false);
  const [showActivation, setShowActivation] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
    const handleStartTrial = async () => {
      setStarting(true);
      try {
        await startTrial();
      } catch {
        // Error handled by context
      } finally {
        setStarting(false);
      }
    };

    const handlePurchase = async () => {
      if (purchaseUrl) {
        await openUrl(purchaseUrl);
      }
    };

    return (
      <>
        <div className="relative flex h-screen overflow-hidden bg-background">
          {/* Grain overlay */}
          <div className="grain absolute inset-0 pointer-events-none z-10" />

          {/* Animated gradient orbs */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="animate-float absolute top-[10%] left-[15%] w-[500px] h-[500px] rounded-full bg-gradient-to-br from-primary/15 via-primary/5 to-transparent blur-3xl" />
            <div className="animate-float-delayed absolute bottom-[10%] right-[10%] w-[600px] h-[600px] rounded-full bg-gradient-to-tl from-primary/10 via-primary/5 to-transparent blur-3xl" />
            <div className="animate-float-slow absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-gradient-to-r from-primary/5 via-transparent to-primary/5 blur-3xl" />
          </div>

          {/* Grid pattern */}
          <div
            className="absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage: `linear-gradient(var(--foreground) 1px, transparent 1px),
                               linear-gradient(90deg, var(--foreground) 1px, transparent 1px)`,
              backgroundSize: '60px 60px'
            }}
          />

          {/* Main content */}
          <div className="relative z-10 flex flex-col items-center justify-center w-full px-8">
            <div
              className={cn(
                "max-w-lg w-full transition-all duration-1000",
                mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              )}
            >
              {/* Logo mark */}
              <div
                className={cn(
                  "mb-10 transition-all duration-700 delay-100",
                  mounted ? "opacity-100 scale-100" : "opacity-0 scale-90"
                )}
              >
                <div className="relative inline-flex">
                  <div className="absolute inset-0 bg-primary/30 rounded-2xl blur-xl" />
                  <div className="relative size-14 rounded-2xl bg-primary/20 border border-primary/20 flex items-center justify-center backdrop-blur-sm">
                    <svg className="size-7 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M12 3L20 7.5V16.5L12 21L4 16.5V7.5L12 3Z" strokeLinejoin="round"/>
                      <path d="M12 12L20 7.5" strokeLinecap="round"/>
                      <path d="M12 12V21" strokeLinecap="round"/>
                      <path d="M12 12L4 7.5" strokeLinecap="round"/>
                    </svg>
                  </div>
                </div>
              </div>

              {/* Headlines */}
              <div
                className={cn(
                  "space-y-4 mb-10 transition-all duration-700 delay-200",
                  mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                )}
              >
                <h1 className="font-serif text-5xl md:text-6xl text-foreground leading-[1.1] tracking-tight">
                  Design apps<br />
                  <span className="italic text-primary">
                    at the speed of thought
                  </span>
                </h1>
                <p className="font-sans text-base text-muted-foreground max-w-md leading-relaxed">
                  Transform ideas into polished mobile and web designs with AI.
                  No templates, no constraints—just your vision, realized.
                </p>
              </div>

              {/* CTA buttons */}
              <div
                className={cn(
                  "space-y-3 transition-all duration-700 delay-300",
                  mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                )}
              >
                <button
                  onClick={handleStartTrial}
                  disabled={starting}
                  className={cn(
                    "w-full h-12 rounded-lg font-sans font-medium text-sm flex items-center justify-center gap-2",
                    "bg-primary text-primary-foreground",
                    "hover:bg-primary/90 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/25",
                    "active:translate-y-0 transition-all duration-200",
                    "disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  )}
                >
                  {starting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      <span>Starting trial...</span>
                    </>
                  ) : (
                    <>
                      <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinejoin="round" strokeLinecap="round"/>
                      </svg>
                      <span>Start 7-Day Free Trial</span>
                    </>
                  )}
                </button>

                <div className="flex gap-2">
                  <button
                    onClick={() => setShowActivation(true)}
                    className={cn(
                      "flex-1 h-10 rounded-lg font-sans text-sm flex items-center justify-center gap-2",
                      "bg-secondary text-secondary-foreground border border-border",
                      "hover:bg-accent hover:border-accent transition-all duration-200"
                    )}
                  >
                    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>Enter Key</span>
                  </button>

                  {purchaseUrl && (
                    <button
                      onClick={handlePurchase}
                      className={cn(
                        "flex-1 h-10 rounded-lg font-sans text-sm flex items-center justify-center gap-2",
                        "bg-secondary text-secondary-foreground border border-border",
                        "hover:bg-accent hover:border-accent transition-all duration-200"
                      )}
                    >
                      <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" strokeLinecap="round" strokeLinejoin="round"/>
                        <circle cx="7" cy="7" r="1" fill="currentColor"/>
                      </svg>
                      <span>Purchase</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Footer note */}
              <p
                className={cn(
                  "font-sans text-xs text-muted-foreground/60 mt-8 text-center transition-all duration-700 delay-500",
                  mounted ? "opacity-100" : "opacity-0"
                )}
              >
                Requires internet to start trial • No credit card needed
              </p>

              {error && (
                <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="font-sans text-sm text-destructive text-center">{error}</p>
                </div>
              )}
            </div>
          </div>

          {/* Decorative corner elements */}
          <div className="absolute top-8 right-8 flex gap-2">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="size-1.5 rounded-full bg-muted-foreground/20"
              />
            ))}
          </div>

          <div className="absolute bottom-8 left-8 font-mono text-[10px] tracking-widest text-muted-foreground/40 uppercase">
            Dilag v0.0.1
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
          {/* Background glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/10 blur-3xl" />

          <div className="relative z-10 max-w-md w-full px-8 text-center">
            {/* Icon */}
            <div className="mb-8 inline-flex">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-xl" />
                <div className="relative size-16 rounded-2xl bg-primary/20 border border-primary/20 flex items-center justify-center">
                  <svg className="size-8 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 6v6l4 2" strokeLinecap="round"/>
                  </svg>
                </div>
              </div>
            </div>

            <h1 className="font-serif text-4xl text-foreground mb-3">
              {status.type === "TrialExpired" ? "Time's up" : "Verification needed"}
            </h1>

            <p className="font-sans text-muted-foreground mb-8 leading-relaxed">
              {status.type === "TrialExpired"
                ? "Your 7-day trial has ended. Unlock unlimited access to continue designing beautiful apps."
                : "Please connect to the internet to validate your license."}
            </p>

            <button
              onClick={() => setShowActivation(true)}
              className={cn(
                "w-full h-12 rounded-lg font-sans font-medium text-sm flex items-center justify-center gap-2",
                "bg-primary text-primary-foreground",
                "hover:bg-primary/90 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/25",
                "transition-all duration-200"
              )}
            >
              <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>Enter License Key</span>
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
