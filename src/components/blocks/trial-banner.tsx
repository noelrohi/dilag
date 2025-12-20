import { useState } from "react";
import { Clock, Sparkles } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Button } from "@/components/ui/button";
import { useLicenseContext } from "@/context/license-context";
import { ActivationModal } from "./activation-modal";

export function TrialBanner() {
  const { status, purchaseUrl } = useLicenseContext();
  const [showActivation, setShowActivation] = useState(false);

  // Only show for trial users
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
      <div
        className={`
          mx-2 mb-2 rounded-lg border p-3 text-sm
          ${isUrgent
            ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
            : "border-border bg-muted/50 text-muted-foreground"
          }
        `}
      >
        <div className="flex items-center gap-2 mb-2">
          <Clock className="size-4" />
          <span className="font-medium">
            {daysRemaining} day{daysRemaining !== 1 ? "s" : ""} left in trial
          </span>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant={isUrgent ? "default" : "secondary"}
            onClick={handlePurchase}
            className="flex-1 gap-1"
          >
            <Sparkles className="size-3" />
            Buy Now
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowActivation(true)}
            className="flex-1"
          >
            Activate
          </Button>
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
