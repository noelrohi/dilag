import { useState } from "react";
import { Loader2, Key, ExternalLink } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@dilag/ui/dialog";
import { Button } from "@dilag/ui/button";
import { Input } from "@dilag/ui/input";
import { useLicenseContext } from "@/context/license-context";

interface ActivationModalProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  allowClose?: boolean;
}

export function ActivationModal({
  open,
  onOpenChange,
  allowClose = false,
}: ActivationModalProps) {
  const [licenseKey, setLicenseKey] = useState("");
  const { activateLicense, activating, error, purchaseUrl } = useLicenseContext();

  const handleActivate = async () => {
    if (!licenseKey.trim()) return;

    try {
      await activateLicense(licenseKey.trim());
      setLicenseKey("");
      onOpenChange?.(false);
    } catch {
      // Error is handled by context
    }
  };

  const handlePurchase = async () => {
    if (purchaseUrl) {
      await openUrl(purchaseUrl);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && licenseKey.trim() && !activating) {
      handleActivate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={allowClose ? onOpenChange : undefined}>
      <DialogContent showCloseButton={allowClose} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="size-5" />
            Activate Dilag
          </DialogTitle>
          <DialogDescription>
            Enter your license key to unlock full access, or purchase a license to continue using Dilag.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Input
              placeholder="DILAG_XXXX-XXXX-XXXX-XXXX"
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={activating}
              className="font-mono"
            />
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          {purchaseUrl && (
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">
                Don't have a license?
              </p>
              <Button
                variant="link"
                onClick={handlePurchase}
                className="gap-1"
              >
                Purchase a license
                <ExternalLink className="size-3" />
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          {allowClose && (
            <Button
              variant="outline"
              onClick={() => onOpenChange?.(false)}
              disabled={activating}
            >
              Cancel
            </Button>
          )}
          <Button
            onClick={handleActivate}
            disabled={!licenseKey.trim() || activating}
          >
            {activating ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Activating...
              </>
            ) : (
              "Activate"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
