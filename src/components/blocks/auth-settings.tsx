import { useState, useEffect } from "react";
import { Settings, ExternalLink, Check, X, Loader2 } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  getProviders,
  startOAuthFlow,
  completeOAuthFlow,
  disconnectProvider,
} from "@/lib/opencode";

export function AuthSettings() {
  const [open, setOpen] = useState(false);
  const [connectedProviders, setConnectedProviders] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // OAuth flow state
  const [oauthUrl, setOauthUrl] = useState<string | null>(null);
  const [oauthCode, setOauthCode] = useState("");

  const isConnected = connectedProviders.includes("anthropic");

  useEffect(() => {
    if (open) {
      loadProviderInfo();
    }
  }, [open]);

  async function loadProviderInfo() {
    try {
      setIsLoading(true);
      setError(null);

      const providersRes = await getProviders();
      setConnectedProviders(providersRes.connected);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load provider info");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleConnect() {
    try {
      setIsLoading(true);
      setError(null);

      // Start OAuth flow with method 0 (Claude Pro/Max)
      const result = await startOAuthFlow("anthropic", 0);
      setOauthUrl(result.url);

      // Open URL in system browser
      await openUrl(result.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start OAuth");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmitCode() {
    if (!oauthCode.trim()) return;

    try {
      setIsLoading(true);
      setError(null);

      await completeOAuthFlow("anthropic", oauthCode.trim());

      // Refresh provider info to get updated connected status
      await loadProviderInfo();

      // Reset OAuth state
      setOauthUrl(null);
      setOauthCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete OAuth");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDisconnect() {
    try {
      setIsLoading(true);
      setError(null);

      await disconnectProvider("anthropic");

      // Refresh provider info to get updated connected status
      await loadProviderInfo();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect");
    } finally {
      setIsLoading(false);
    }
  }

  function handleCancel() {
    setOauthUrl(null);
    setOauthCode("");
    setError(null);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="size-7">
          <Settings className="size-4" />
          <span className="sr-only">Settings</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Connect to Anthropic to use Claude models.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Anthropic Provider Status */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-orange-100 text-orange-600">
                <span className="text-lg font-semibold">A</span>
              </div>
              <div>
                <p className="font-medium">Anthropic</p>
                <p className="text-sm text-muted-foreground">
                  {isConnected ? (
                    <span className="flex items-center gap-1 text-green-600">
                      <Check className="size-3" /> Connected
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <X className="size-3" /> Not connected
                    </span>
                  )}
                </p>
              </div>
            </div>

            {isLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : isConnected ? (
              <Button variant="outline" size="sm" onClick={handleDisconnect}>
                Disconnect
              </Button>
            ) : !oauthUrl ? (
              <Button size="sm" onClick={handleConnect}>
                Connect
              </Button>
            ) : null}
          </div>

          {/* OAuth Code Entry */}
          {oauthUrl && !isConnected && (
            <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm">
                1. Click the link below to authorize in your browser
              </p>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() => openUrl(oauthUrl)}
              >
                <ExternalLink className="size-4" />
                Open Authorization Page
              </Button>

              <p className="text-sm">
                2. After authorizing, paste the code here:
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="Paste authorization code..."
                  value={oauthCode}
                  onChange={(e) => setOauthCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmitCode()}
                />
                <Button onClick={handleSubmitCode} disabled={!oauthCode.trim()}>
                  Submit
                </Button>
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={handleCancel}
              >
                Cancel
              </Button>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {/* Model Info */}
          <div className="rounded-lg border p-4">
            <p className="text-sm font-medium">Current Model</p>
            <p className="text-sm text-muted-foreground">claude-opus-4-5</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
