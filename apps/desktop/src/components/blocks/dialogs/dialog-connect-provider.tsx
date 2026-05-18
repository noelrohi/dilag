import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  IconArrowLeft as ArrowLeft,
  IconAlertCircle as DangerCircle,
  IconRefresh as Restart,
} from "@tabler/icons-react"
import { Dialog, DialogContent } from "@dilag/ui/dialog"
import { Input } from "@dilag/ui/input"
import { Field, FieldLabel } from "@dilag/ui/field"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { bridge } from "@/lib/bridge"

interface DialogConnectProviderProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  providerId: string
  onBack: () => void
  onSuccess: () => void
}

type AuthMode = "api-key" | "oauth"

const OPENAI_CODEX_PROVIDER_ID = "openai-codex"

export function DialogConnectProvider({
  open,
  onOpenChange,
  providerId,
  onBack,
  onSuccess,
}: DialogConnectProviderProps) {
  const queryClient = useQueryClient()
  const [apiKey, setApiKey] = useState("")
  const [authMode, setAuthMode] = useState<AuthMode>("api-key")
  const [error, setError] = useState<string | null>(null)

  const { data: providers = [] } = useQuery({
    queryKey: ["providers", "all"],
    queryFn: () => bridge.agent.listProviders(),
    enabled: open,
  })
  const provider = providers.find((p) => p.id === providerId)
  const providerName = provider?.name ?? providerId
  const isOAuthProvider = provider?.authType === "oauth"
  const showsOpenAIAuthChoices = providerId === "openai"
  const oauthProviderId = showsOpenAIAuthChoices ? OPENAI_CODEX_PROVIDER_ID : providerId

  useEffect(() => {
    if (!open) {
      setApiKey("")
      setError(null)
      setAuthMode("api-key")
      return
    }

    setAuthMode(isOAuthProvider ? "oauth" : "api-key")
  }, [isOAuthProvider, open, providerId])

  async function refreshProviderQueries() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["providers"] }),
      queryClient.invalidateQueries({ queryKey: ["models"] }),
    ])
  }

  const apiKeyMutation = useMutation({
    mutationFn: (key: string) => bridge.agent.setApiKey({ providerID: providerId, apiKey: key }),
    onSuccess: async () => {
      await refreshProviderQueries()
      toast.success(`${providerName} connected`, {
        description: `${providerName} models are now available to use.`,
      })
      onSuccess()
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to save API key")
    },
  })

  const oauthMutation = useMutation({
    mutationFn: () => bridge.agent.loginOAuthProvider({ providerID: oauthProviderId }),
    onSuccess: async () => {
      await refreshProviderQueries()
      toast.success("ChatGPT Codex connected", {
        description: "Codex subscription models are now available to use.",
      })
      onSuccess()
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "OAuth login failed")
    },
  })

  function handleSubmitApiKey(e: React.FormEvent) {
    e.preventDefault()
    if (!apiKey.trim()) return
    setError(null)
    apiKeyMutation.mutate(apiKey.trim())
  }

  function handleOAuthLogin() {
    setError(null)
    oauthMutation.mutate()
  }

  const connectButtonPending = apiKeyMutation.isPending || oauthMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-[380px] overflow-hidden border-border/50 shadow-2xl">
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className={cn(
                "size-8 rounded-lg flex items-center justify-center",
                "transition-colors duration-150",
                "hover:bg-muted/80 active:bg-muted",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              <ArrowLeft size={16} className="text-muted-foreground" />
            </button>
            <div className="size-8 rounded-md bg-muted/50 flex items-center justify-center">
              <img
                src={`https://models.dev/logos/${providerId}.svg`}
                alt=""
                className="size-5 dark:invert"
              />
            </div>
            <h2 className="text-base font-medium tracking-tight">Connect {providerName}</h2>
          </div>
        </div>

        <div className="px-5 pb-5 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <div className="flex items-start gap-2">
                <DangerCircle size={16} className="text-destructive mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-destructive">Connection failed</p>
                  <p className="text-xs text-destructive/80">{error}</p>
                </div>
              </div>
            </div>
          )}

          {showsOpenAIAuthChoices && (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAuthMode("api-key")}
                className={cn(
                  "rounded-lg border px-3 py-2 text-left transition-colors",
                  authMode === "api-key" ? "border-primary bg-primary/10" : "hover:bg-muted/60",
                )}
              >
                <span className="block text-sm font-medium">API key</span>
                <span className="block text-xs text-muted-foreground">OpenAI Platform</span>
              </button>
              <button
                type="button"
                onClick={() => setAuthMode("oauth")}
                className={cn(
                  "rounded-lg border px-3 py-2 text-left transition-colors",
                  authMode === "oauth" ? "border-primary bg-primary/10" : "hover:bg-muted/60",
                )}
              >
                <span className="block text-sm font-medium">Codex OAuth</span>
                <span className="block text-xs text-muted-foreground">ChatGPT Plus/Pro</span>
              </button>
            </div>
          )}

          {authMode === "oauth" ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Connect ChatGPT Plus/Pro with Pi's Codex OAuth flow. Dilag will open your browser;
                finish login there and return to the app when it completes.
              </p>
              <button
                type="button"
                onClick={handleOAuthLogin}
                disabled={connectButtonPending}
                className={cn(
                  "w-full h-9 rounded-lg text-sm font-medium",
                  "bg-primary text-primary-foreground",
                  "hover:bg-primary/90 transition-colors",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                )}
              >
                {oauthMutation.isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <Restart size={14} className="animate-spin" />
                    Waiting for browser login...
                  </span>
                ) : (
                  "Continue with ChatGPT"
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Enter your {providerName} API key to make its Pi models available in Dilag.
              </p>
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
                  disabled={!apiKey.trim() || connectButtonPending}
                  className={cn(
                    "w-full h-9 rounded-lg text-sm font-medium",
                    "bg-primary text-primary-foreground",
                    "hover:bg-primary/90 transition-colors",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  )}
                >
                  {apiKeyMutation.isPending ? (
                    <span className="flex items-center justify-center gap-2">
                      <Restart size={14} className="animate-spin" />
                      Connecting...
                    </span>
                  ) : (
                    "Connect"
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
