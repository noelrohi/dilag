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
import { useSDK } from "@/context/global-events";
import { cn } from "@/lib/utils";

// Provider configurations with display info
const PROVIDER_CONFIG: Record<
  string,
  {
    name: string;
    description: string;
    color: string;
    bgColor: string;
    logo: string;
  }
> = {
  anthropic: {
    name: "Anthropic",
    description: "Claude Pro/Max subscription",
    color: "text-orange-600",
    bgColor: "bg-orange-100",
    logo: "A",
  },
  "github-copilot": {
    name: "GitHub Copilot",
    description: "GitHub Copilot subscription",
    color: "text-gray-900 dark:text-white",
    bgColor: "bg-gray-100 dark:bg-gray-800",
    logo: "GH",
  },
  google: {
    name: "Google Gemini",
    description: "Google AI Studio",
    color: "text-blue-600",
    bgColor: "bg-blue-100",
    logo: "G",
  },
  openai: {
    name: "OpenAI",
    description: "ChatGPT Plus/Pro subscription",
    color: "text-green-600",
    bgColor: "bg-green-100",
    logo: "AI",
  },
};

interface AuthMethod {
  type: "oauth" | "api";
  label: string;
}

interface ProviderAuthState {
  providerID: string;
  oauthUrl: string | null;
  oauthMethod: "auto" | "code" | null;
  oauthCode: string;
  instructions: string;
}

export function AuthSettings() {
  const sdk = useSDK();
  const [open, setOpen] = useState(false);
  const [connectedProviders, setConnectedProviders] = useState<string[]>([]);
  const [authMethods, setAuthMethods] = useState<Record<string, AuthMethod[]>>(
    {}
  );
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // OAuth flow state for each provider
  const [oauthState, setOauthState] = useState<ProviderAuthState | null>(null);

  useEffect(() => {
    if (open) {
      loadProviderInfo();
    }
  }, [open]);

  async function loadProviderInfo() {
    try {
      setIsLoading(true);
      setError(null);

      const [providerResponse, authResponse] = await Promise.all([
        sdk.provider.list(),
        sdk.provider.auth(),
      ]);

      if (providerResponse.data) {
        setConnectedProviders(providerResponse.data.connected);
      }

      if (authResponse.data) {
        setAuthMethods(authResponse.data);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load provider info"
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleConnect(providerID: string, methodIndex: number = 0) {
    try {
      setLoadingProvider(providerID);
      setError(null);

      const response = await sdk.provider.oauth.authorize({
        providerID,
        method: methodIndex,
      });

      if (response.data?.url) {
        setOauthState({
          providerID,
          oauthUrl: response.data.url,
          oauthMethod: response.data.method,
          oauthCode: "",
          instructions: response.data.instructions || "",
        });

        // Open URL in system browser
        await openUrl(response.data.url);

        // For auto method, poll for completion
        if (response.data.method === "auto") {
          pollForCompletion(providerID, methodIndex);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start OAuth");
    } finally {
      setLoadingProvider(null);
    }
  }

  async function pollForCompletion(providerID: string, methodIndex: number) {
    // Poll every 2 seconds for up to 2 minutes
    const maxAttempts = 60;
    let attempts = 0;

    const poll = async () => {
      if (attempts >= maxAttempts) {
        setError("OAuth timeout. Please try again.");
        setOauthState(null);
        return;
      }

      try {
        // Try to complete the callback without a code (auto method)
        await sdk.provider.oauth.callback({
          providerID,
          method: methodIndex,
        });

        // Success - refresh and close
        await loadProviderInfo();
        setOauthState(null);
      } catch {
        // Not ready yet, continue polling
        attempts++;
        setTimeout(poll, 2000);
      }
    };

    setTimeout(poll, 2000);
  }

  async function handleSubmitCode() {
    if (!oauthState || !oauthState.oauthCode.trim()) return;

    try {
      setLoadingProvider(oauthState.providerID);
      setError(null);

      await sdk.provider.oauth.callback({
        providerID: oauthState.providerID,
        code: oauthState.oauthCode.trim(),
      });

      // Refresh provider info to get updated connected status
      await loadProviderInfo();

      // Reset OAuth state
      setOauthState(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete OAuth");
    } finally {
      setLoadingProvider(null);
    }
  }

  async function handleDisconnect(providerID: string) {
    try {
      setLoadingProvider(providerID);
      setError(null);

      // Use auth.set with empty key to disconnect
      await sdk.auth.set({
        providerID,
        auth: { type: "api", key: "" },
      });

      // Refresh provider info to get updated connected status
      await loadProviderInfo();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect");
    } finally {
      setLoadingProvider(null);
    }
  }

  function handleCancel() {
    setOauthState(null);
    setError(null);
  }

  // Get providers that have OAuth methods available
  const availableProviders = Object.entries(authMethods)
    .filter(([, methods]) => methods.some((m) => m.type === "oauth"))
    .map(([providerID]) => providerID)
    .filter((id) => PROVIDER_CONFIG[id]); // Only show configured providers

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
            Connect your AI providers to use their models.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {isLoading && availableProviders.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : availableProviders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No OAuth providers available. Configure plugins in your opencode
              config.
            </p>
          ) : (
            availableProviders.map((providerID) => {
              const config = PROVIDER_CONFIG[providerID];
              const isConnected = connectedProviders.includes(providerID);
              const isProviderLoading = loadingProvider === providerID;
              const isInOAuthFlow = oauthState?.providerID === providerID;

              return (
                <div key={providerID} className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex size-10 items-center justify-center rounded-full text-sm font-semibold",
                          config.bgColor,
                          config.color
                        )}
                      >
                        {config.logo}
                      </div>
                      <div>
                        <p className="font-medium">{config.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {isConnected ? (
                            <span className="flex items-center gap-1 text-green-600">
                              <Check className="size-3" /> Connected
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <X className="size-3" /> {config.description}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    {isProviderLoading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : isConnected ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDisconnect(providerID)}
                      >
                        Disconnect
                      </Button>
                    ) : !isInOAuthFlow ? (
                      <Button
                        size="sm"
                        onClick={() => handleConnect(providerID, 0)}
                      >
                        Connect
                      </Button>
                    ) : null}
                  </div>

                  {/* OAuth Code Entry for this provider */}
                  {isInOAuthFlow && oauthState && (
                    <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950 p-4">
                      {oauthState.oauthMethod === "auto" ? (
                        <div className="flex items-center gap-3">
                          <Loader2 className="size-4 animate-spin" />
                          <p className="text-sm">
                            Waiting for authorization in browser...
                          </p>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm">
                            1. Click below to authorize in your browser
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full justify-start gap-2"
                            onClick={() =>
                              oauthState.oauthUrl &&
                              openUrl(oauthState.oauthUrl)
                            }
                          >
                            <ExternalLink className="size-4" />
                            Open Authorization Page
                          </Button>

                          {oauthState.instructions && (
                            <p className="text-xs text-muted-foreground">
                              {oauthState.instructions}
                            </p>
                          )}

                          <p className="text-sm">
                            2. After authorizing, paste the code here:
                          </p>
                          <div className="flex gap-2">
                            <Input
                              placeholder="Paste authorization code..."
                              value={oauthState.oauthCode}
                              onChange={(e) =>
                                setOauthState({
                                  ...oauthState,
                                  oauthCode: e.target.value,
                                })
                              }
                              onKeyDown={(e) =>
                                e.key === "Enter" && handleSubmitCode()
                              }
                            />
                            <Button
                              onClick={handleSubmitCode}
                              disabled={!oauthState.oauthCode.trim()}
                            >
                              Submit
                            </Button>
                          </div>
                        </>
                      )}

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
                </div>
              );
            })
          )}

          {/* Error Display */}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
