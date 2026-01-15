import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Search, ChevronDown } from "lucide-react";
import { useSDK } from "@/context/global-events";
import { Dialog, DialogContent } from "@dilag/ui/dialog";
import { Input } from "@dilag/ui/input";
import { cn } from "@/lib/utils";

// Popular providers to show at top
const POPULAR_PROVIDERS = [
  "opencode",
  "anthropic",
  "github-copilot",
  "openai",
  "google",
  "openrouter",
];

interface DialogSelectProviderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectProvider: (providerId: string) => void;
}

export function DialogSelectProvider({
  open,
  onOpenChange,
  onSelectProvider,
}: DialogSelectProviderProps) {
  const sdk = useSDK();
  const [search, setSearch] = useState("");
  const [othersExpanded, setOthersExpanded] = useState(false);

  // Fetch all providers and connected status
  const { data: providerData } = useQuery({
    queryKey: ["providers", "all"],
    queryFn: async () => {
      const response = await sdk.provider.list();
      return {
        all: response.data?.all ?? [],
        connected: response.data?.connected ?? [],
      };
    },
    enabled: open,
  });

  const allProviders = providerData?.all ?? [];
  const connectedProviders = providerData?.connected ?? [];

  // Split providers into popular and others, apply search
  const { popularProviders, otherProviders } = useMemo(() => {
    const query = search.trim().toLowerCase();

    const popular = allProviders
      .filter((p) => POPULAR_PROVIDERS.includes(p.id))
      .sort((a, b) => POPULAR_PROVIDERS.indexOf(a.id) - POPULAR_PROVIDERS.indexOf(b.id));

    const others = allProviders
      .filter((p) => !POPULAR_PROVIDERS.includes(p.id))
      .sort((a, b) => a.name.localeCompare(b.name));

    if (query) {
      return {
        popularProviders: popular.filter(
          (p) => p.name.toLowerCase().includes(query) || p.id.toLowerCase().includes(query)
        ),
        otherProviders: others.filter(
          (p) => p.name.toLowerCase().includes(query) || p.id.toLowerCase().includes(query)
        ),
      };
    }

    return { popularProviders: popular, otherProviders: others };
  }, [allProviders, search]);

  const handleSelect = (providerId: string) => {
    onSelectProvider(providerId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-[380px] overflow-hidden border-border/50 shadow-2xl">
        {/* Header */}
        <div className="px-5 pt-5 pb-4">
          <h2 className="text-base font-medium tracking-tight">Connect provider</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Select a provider to authenticate
          </p>
        </div>

        {/* Search */}
        <div className="px-5 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/50" />
            <Input
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 bg-muted/50 border-0 focus-visible:ring-1"
            />
          </div>
        </div>

        {/* Provider list */}
        <div className="px-2 pb-3 max-h-[320px] overflow-y-auto">
          {popularProviders.length === 0 && otherProviders.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No providers found
            </div>
          ) : (
            <div className="space-y-0.5">
              {/* Popular providers */}
              {popularProviders.map((provider) => {
                const isConnected = connectedProviders.includes(provider.id);
                return (
                  <button
                    key={provider.id}
                    onClick={() => handleSelect(provider.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg",
                      "transition-colors duration-150",
                      "hover:bg-muted/80 active:bg-muted",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    )}
                  >
                    <div className="size-8 rounded-md bg-muted/50 flex items-center justify-center">
                      <img
                        src={`https://models.dev/logos/${provider.id}.svg`}
                        alt=""
                        className="size-5 dark:invert"
                      />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{provider.name}</span>
                        {provider.id === "opencode" && !isConnected && (
                          <span className="text-[10px] font-medium uppercase tracking-wider text-primary px-1.5 py-0.5 rounded bg-primary/10">
                            Recommended
                          </span>
                        )}
                      </div>
                    </div>
                    {isConnected && (
                      <div className="size-5 rounded-full bg-emerald-500/10 flex items-center justify-center">
                        <Check className="size-3 text-emerald-600" />
                      </div>
                    )}
                  </button>
                );
              })}

              {/* Other providers (collapsible) */}
              {otherProviders.length > 0 && (
                <>
                  <button
                    onClick={() => setOthersExpanded(!othersExpanded)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 mt-2",
                      "text-xs font-medium text-muted-foreground uppercase tracking-wider",
                      "hover:text-foreground transition-colors"
                    )}
                  >
                    <ChevronDown
                      className={cn(
                        "size-3.5 transition-transform duration-200",
                        !othersExpanded && "-rotate-90"
                      )}
                    />
                    <span>Other providers ({otherProviders.length})</span>
                  </button>
                  {othersExpanded && (
                    <div className="space-y-0.5">
                      {otherProviders.map((provider) => {
                        const isConnected = connectedProviders.includes(provider.id);
                        return (
                          <button
                            key={provider.id}
                            onClick={() => handleSelect(provider.id)}
                            className={cn(
                              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg",
                              "transition-colors duration-150",
                              "hover:bg-muted/80 active:bg-muted",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            )}
                          >
                            <div className="size-8 rounded-md bg-muted/50 flex items-center justify-center">
                              <img
                                src={`https://models.dev/logos/${provider.id}.svg`}
                                alt=""
                                className="size-5 dark:invert"
                              />
                            </div>
                            <span className="text-sm font-medium text-left flex-1">
                              {provider.name}
                            </span>
                            {isConnected && (
                              <div className="size-5 rounded-full bg-emerald-500/10 flex items-center justify-center">
                                <Check className="size-3 text-emerald-600" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
