import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { openUrl } from "@tauri-apps/plugin-opener";
import { ArrowLeft, Loader2, AlertCircle, Copy, Check } from "lucide-react";
import { useSDK } from "@/context/global-events";
import { Dialog, DialogContent } from "@dilag/ui/dialog";
import { Input } from "@dilag/ui/input";
import { Field, FieldLabel, FieldDescription } from "@dilag/ui/field";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type AuthState = "select-method" | "pending" | "api-key" | "oauth-code" | "oauth-auto" | "error";

interface DialogConnectProviderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerId: string;
  onBack: () => void;
  onSuccess: () => void;
}

export function DialogConnectProvider({
  open,
  onOpenChange,
  providerId,
  onBack,
  onSuccess,
}: DialogConnectProviderProps) {
  const sdk = useSDK();
  const queryClient = useQueryClient();

  const [authState, setAuthState] = useState<AuthState>("select-method");
  const [selectedMethodIndex, setSelectedMethodIndex] = useState<number | null>(null);
  const [authorization, setAuthorization] = useState<{
    url?: string;
    method?: "code" | "auto";
    instructions?: string;
  } | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [authCode, setAuthCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Fetch provider info
  const { data: provider } = useQuery({
    queryKey: ["provider", providerId],
    queryFn: async () => {
      const response = await sdk.provider.list();
      return response.data?.all?.find((p) => p.id === providerId);
    },
    enabled: open && !!providerId,
  });

  // Fetch auth methods for this provider
  const { data: authMethods = [] } = useQuery({
    queryKey: ["provider-auth", providerId],
    queryFn: async () => {
      const response = await sdk.provider.auth();
      const methods = response.data?.[providerId];
      // Default to API key if no methods defined
      return methods ?? [{ type: "api" as const, label: "API key" }];
    },
    enabled: open && !!providerId,
  });

  // Auto-select if only one method
  useEffect(() => {
    if (authMethods.length === 1 && authState === "select-method") {
      selectMethod(0);
    }
  }, [authMethods, authState]);

  // Reset state when dialog closes or provider changes
  useEffect(() => {
    if (!open) {
      setAuthState("select-method");
      setSelectedMethodIndex(null);
      setAuthorization(null);
      setApiKey("");
      setAuthCode("");
      setError(null);
    }
  }, [open, providerId]);

  // API key mutation
  const apiKeyMutation = useMutation({
    mutationFn: async (key: string) => {
      await sdk.auth.set({
        providerID: providerId,
        auth: { type: "api", key },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "providers"] });
      toast.success(`${provider?.name} connected`, {
        description: `${provider?.name} models are now available to use.`,
      });
      onSuccess();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to save API key");
      setAuthState("error");
    },
  });

  // OAuth callback mutation
  const oauthCallbackMutation = useMutation({
    mutationFn: async ({ code, method }: { code?: string; method?: number }) => {
      await sdk.provider.oauth.callback({
        providerID: providerId,
        code,
        method,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "providers"] });
      toast.success(`${provider?.name} connected`, {
        description: `${provider?.name} models are now available to use.`,
      });
      onSuccess();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Authorization failed");
      setAuthState("error");
    },
  });

  async function selectMethod(index: number) {
    const method = authMethods[index];
    setSelectedMethodIndex(index);
    setError(null);

    if (method.type === "api") {
      setAuthState("api-key");
      return;
    }

    // OAuth flow
    setAuthState("pending");
    try {
      const response = await sdk.provider.oauth.authorize({
        providerID: providerId,
        method: index,
      });

      if (response.data?.url) {
        setAuthorization({
          url: response.data.url,
          method: response.data.method as "code" | "auto",
          instructions: response.data.instructions,
        });

        // Open URL in browser
        await openUrl(response.data.url);

        if (response.data.method === "auto") {
          setAuthState("oauth-auto");
          // Start polling for completion
          oauthCallbackMutation.mutate({ method: index });
        } else {
          setAuthState("oauth-code");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start authorization");
      setAuthState("error");
    }
  }

  function handleSubmitApiKey(e: React.FormEvent) {
    e.preventDefault();
    if (!apiKey.trim()) return;
    apiKeyMutation.mutate(apiKey.trim());
  }

  function handleSubmitAuthCode(e: React.FormEvent) {
    e.preventDefault();
    if (!authCode.trim()) return;
    oauthCallbackMutation.mutate({ code: authCode.trim(), method: selectedMethodIndex ?? 0 });
  }

  function handleBack() {
    if (authMethods.length === 1) {
      onBack();
      return;
    }
    if (authState !== "select-method") {
      setAuthState("select-method");
      setSelectedMethodIndex(null);
      setAuthorization(null);
      setApiKey("");
      setAuthCode("");
      setError(null);
      return;
    }
    onBack();
  }

  const selectedMethod = selectedMethodIndex !== null ? authMethods[selectedMethodIndex] : null;
  const [copied, setCopied] = useState(false);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getTitle = () => {
    if (providerId === "anthropic" && selectedMethod?.label?.toLowerCase().includes("max")) {
      return "Login with Claude Pro/Max";
    }
    return `Connect ${provider?.name ?? providerId}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-[380px] overflow-hidden border-border/50 shadow-2xl">
        {/* Header */}
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className={cn(
                "size-8 rounded-lg flex items-center justify-center",
                "transition-colors duration-150",
                "hover:bg-muted/80 active:bg-muted",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
            >
              <ArrowLeft className="size-4 text-muted-foreground" />
            </button>
            <div className="size-8 rounded-md bg-muted/50 flex items-center justify-center">
              <img
                src={`https://models.dev/logos/${providerId}.svg`}
                alt=""
                className="size-5 dark:invert"
              />
            </div>
            <h2 className="text-base font-medium tracking-tight">{getTitle()}</h2>
          </div>
        </div>

        {/* Content */}
        <div className="px-5 pb-5 space-y-4">
          {/* Method Selection */}
          {authState === "select-method" && authMethods.length > 1 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Select how you want to authenticate
              </p>
              <div className="space-y-1.5">
                {authMethods.map((method, index) => (
                  <button
                    key={method.label}
                    onClick={() => selectMethod(index)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg",
                      "transition-colors duration-150 text-left",
                      "hover:bg-muted/80 active:bg-muted",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    )}
                  >
                    <div className="size-4 rounded-full border-2 border-muted-foreground/30" />
                    <span className="text-sm">{method.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Pending state */}
          {authState === "pending" && (
            <div className="py-6 flex flex-col items-center gap-3">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Starting authorization...</p>
            </div>
          )}

          {/* Error state */}
          {authState === "error" && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <div className="flex items-start gap-2">
                <AlertCircle className="size-4 text-destructive mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-destructive">Authorization failed</p>
                  <p className="text-xs text-destructive/80">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* API Key input */}
          {authState === "api-key" && (
            <div className="space-y-4">
              {providerId === "opencode" ? (
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    OpenCode Zen gives you access to a curated set of reliable
                    optimized models for coding agents.
                  </p>
                  <p>
                    With a single API key you'll get access to models such as
                    Claude, GPT, Gemini, GLM and more.
                  </p>
                  <p>
                    Visit{" "}
                    <button
                      onClick={() => openUrl("https://opencode.ai/zen")}
                      className="text-primary hover:underline font-medium"
                    >
                      opencode.ai/zen
                    </button>{" "}
                    to get your API key.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Enter your {provider?.name} API key to connect and access {provider?.name} models.
                </p>
              )}
              <form onSubmit={handleSubmitApiKey} className="space-y-4">
                <Field>
                  <FieldLabel htmlFor="api-key">API Key</FieldLabel>
                  <Input
                    id="api-key"
                    type="password"
                    placeholder="sk-..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    autoFocus
                  />
                </Field>
                <button
                  type="submit"
                  disabled={!apiKey.trim() || apiKeyMutation.isPending}
                  className={cn(
                    "w-full h-9 rounded-lg text-sm font-medium",
                    "bg-primary text-primary-foreground",
                    "hover:bg-primary/90 transition-colors",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  )}
                >
                  {apiKeyMutation.isPending ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="size-3.5 animate-spin" />
                      Connecting...
                    </span>
                  ) : (
                    "Connect"
                  )}
                </button>
              </form>
            </div>
          )}

          {/* OAuth Code input */}
          {authState === "oauth-code" && authorization && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Complete authorization in your browser, then paste the code below.
              </p>
              <button
                onClick={() => authorization.url && openUrl(authorization.url)}
                className={cn(
                  "w-full h-9 rounded-lg text-sm font-medium",
                  "border border-border/50 bg-muted/30",
                  "hover:bg-muted/50 transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                )}
              >
                Open {provider?.name} in browser
              </button>
              <form onSubmit={handleSubmitAuthCode} className="space-y-4">
                <Field>
                  <FieldLabel htmlFor="auth-code">Authorization Code</FieldLabel>
                  <Input
                    id="auth-code"
                    type="text"
                    placeholder="Paste code here..."
                    value={authCode}
                    onChange={(e) => setAuthCode(e.target.value)}
                    autoFocus
                    className="font-mono"
                  />
                </Field>
                <button
                  type="submit"
                  disabled={!authCode.trim() || oauthCallbackMutation.isPending}
                  className={cn(
                    "w-full h-9 rounded-lg text-sm font-medium",
                    "bg-primary text-primary-foreground",
                    "hover:bg-primary/90 transition-colors",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  )}
                >
                  {oauthCallbackMutation.isPending ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="size-3.5 animate-spin" />
                      Verifying...
                    </span>
                  ) : (
                    "Verify"
                  )}
                </button>
              </form>
            </div>
          )}

          {/* OAuth Auto (device code) */}
          {authState === "oauth-auto" && authorization && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                A browser window has opened. Enter the code below to complete authorization.
              </p>
              {authorization.instructions && (
                <Field>
                  <FieldLabel>Your Code</FieldLabel>
                  <div className="relative">
                    <Input
                      value={
                        authorization.instructions.includes(":")
                          ? authorization.instructions.split(":")[1]?.trim()
                          : authorization.instructions
                      }
                      readOnly
                      className="h-11 font-mono text-base tracking-widest text-center pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopyCode(
                        authorization.instructions?.includes(":")
                          ? authorization.instructions.split(":")[1]?.trim() ?? ""
                          : authorization.instructions ?? ""
                      )}
                      className={cn(
                        "absolute right-2 top-1/2 -translate-y-1/2",
                        "size-7 rounded flex items-center justify-center",
                        "hover:bg-muted transition-colors"
                      )}
                    >
                      {copied ? (
                        <Check className="size-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="size-3.5 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                  <FieldDescription>Copy this code and paste it in your browser</FieldDescription>
                </Field>
              )}
              <button
                onClick={() => authorization.url && openUrl(authorization.url)}
                className={cn(
                  "w-full h-9 rounded-lg text-sm font-medium",
                  "border border-border/50 bg-muted/30",
                  "hover:bg-muted/50 transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                )}
              >
                Reopen browser window
              </button>
              <div className="flex items-center justify-center gap-2 py-2">
                <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Waiting for authorization...</span>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
