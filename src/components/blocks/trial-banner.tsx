import { useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useLicenseContext } from "@/context/license-context";
import { ActivationModal } from "./activation-modal";
import { cn } from "@/lib/utils";

export function TrialBanner() {
  const { status, purchaseUrl } = useLicenseContext();
  const [showActivation, setShowActivation] = useState(false);

  if (status?.type !== "Trial") {
    return null;
  }

  const daysRemaining = status.days_remaining;
  const isUrgent = daysRemaining <= 2;

  const handlePurchase = async () => {
    if (purchaseUrl) {
      await openUrl(purchaseUrl);
    }
  };

  return (
    <>
      <div className="mx-2 mb-2">
        <div
          className={cn(
            "rounded-lg border p-3",
            isUrgent ? "border-primary/30 bg-primary/5" : "border-border bg-muted/30"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Trial
            </span>
            <span
              className={cn(
                "font-mono text-[10px] tabular-nums",
                isUrgent ? "text-primary font-medium" : "text-muted-foreground"
              )}
            >
              {daysRemaining}d left
            </span>
          </div>

          {/* Message */}
          <p className="font-serif text-sm text-foreground mb-3">
            {isUrgent ? (
              <span className="italic">Unlock lifetime access</span>
            ) : (
              <>Keep it <span className="italic">forever</span></>
            )}
          </p>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handlePurchase}
              className={cn(
                "flex-1 h-7 rounded-md text-xs font-medium",
                "transition-colors duration-150",
                isUrgent
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-primary/10 text-primary hover:bg-primary/20"
              )}
            >
              Purchase
            </button>
            <button
              onClick={() => setShowActivation(true)}
              className="h-7 px-3 rounded-md text-xs border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors duration-150"
            >
              Key
            </button>
          </div>
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
