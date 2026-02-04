import { useState, useMemo } from "react";
import { AltArrowDown, AddCircle, Refresh } from "@solar-icons/react";
import { Button } from "@dilag/ui/button";
import { cn } from "@/lib/utils";
import { selectorStyles } from "./agent-selector-button";
import {
  ModelSelector,
  ModelSelectorTrigger,
  ModelSelectorContent,
  ModelSelectorInput,
  ModelSelectorList,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorItem,
  ModelSelectorLogo,
} from "@/components/ai-elements/model-selector";
import { DialogSelectProvider } from "@/components/blocks/dialogs/dialog-select-provider";
import { DialogConnectProvider } from "@/components/blocks/dialogs/dialog-connect-provider";
import { useModels, type Model } from "@/hooks/use-models";

type ProviderDialogState =
  | { type: "closed" }
  | { type: "select-provider" }
  | { type: "connect-provider"; providerId: string };

// Popular providers in priority order
const PROVIDER_PRIORITY = [
  "opencode",
  "anthropic",
  "openai",
  "google",
  "github-copilot",
  "openrouter",
];

interface ModelSelectorButtonProps {
  variant?: "default" | "settings";
}

export function ModelSelectorButton({ variant = "default" }: ModelSelectorButtonProps) {
  const { models, connectedProviders, selectedModelInfo, selectModel, isLoading, isRestarting, restartServerAndRefresh } = useModels();
  const [open, setOpen] = useState(false);
  const [providerDialogState, setProviderDialogState] =
    useState<ProviderDialogState>({ type: "closed" });

  // Group models by provider, sorted by priority
  const groupedModels = useMemo(() => {
    const grouped = models.reduce(
      (acc, model) => {
        if (!acc[model.providerID]) {
          acc[model.providerID] = {
            name: model.providerName,
            models: [],
          };
        }
        acc[model.providerID].models.push(model);
        return acc;
      },
      {} as Record<string, { name: string; models: Model[] }>
    );

    // Sort models within each group: hot first, then alphabetically
    for (const group of Object.values(grouped)) {
      group.models.sort((a, b) => {
        if (a.hot && !b.hot) return -1;
        if (!a.hot && b.hot) return 1;
        return a.name.localeCompare(b.name);
      });
    }

    // Sort providers: connected first, then by priority, then alphabetically
    const sortedEntries = Object.entries(grouped).sort(([aId], [bId]) => {
      const aConnected = connectedProviders.includes(aId);
      const bConnected = connectedProviders.includes(bId);

      // Connected providers first
      if (aConnected && !bConnected) return -1;
      if (!aConnected && bConnected) return 1;

      // Then by priority
      const aIndex = PROVIDER_PRIORITY.indexOf(aId);
      const bIndex = PROVIDER_PRIORITY.indexOf(bId);
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;

      // Then alphabetically
      return aId.localeCompare(bId);
    });

    return Object.fromEntries(sortedEntries);
  }, [models, connectedProviders]);

  const handleSelectProvider = (providerId: string) => {
    setProviderDialogState({ type: "connect-provider", providerId });
  };

  const handleBackToSelect = () => {
    setProviderDialogState({ type: "select-provider" });
  };

  const handleCloseProviderDialog = () => {
    setProviderDialogState({ type: "closed" });
  };

  const header = (
    <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border/30">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-[15px] font-semibold tracking-tight">Select model</h2>
        <p className="text-[11px] text-muted-foreground/60">
          {connectedProviders.length} provider{connectedProviders.length !== 1 ? 's' : ''} connected
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => restartServerAndRefresh()}
          disabled={isRestarting}
          title="Refresh models"
        >
          <Refresh size={14} className={isRestarting ? "animate-spin" : ""} />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs border-border/50 bg-transparent hover:bg-accent/50 transition-colors"
          onClick={() => {
            setOpen(false);
            setProviderDialogState({ type: "select-provider" });
          }}
        >
          <AddCircle size={14} />
          Connect
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <ModelSelector open={open} onOpenChange={setOpen}>
        <ModelSelectorTrigger asChild>
          {variant === "settings" ? (
            <button
              disabled={isLoading}
              className={cn(
                "flex items-center gap-2 px-2.5 py-1.5 -mr-2",
                "rounded-lg hover:bg-muted/50 transition-colors",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {selectedModelInfo ? (
                <>
                  <ModelSelectorLogo
                    provider={selectedModelInfo.providerID as any}
                    className="size-4"
                  />
                  <span className="text-sm text-muted-foreground max-w-[140px] truncate">
                    {selectedModelInfo.name}
                  </span>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">Select</span>
              )}
              <AltArrowDown size={14} className="text-muted-foreground/50" />
            </button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className={cn(selectorStyles)}
              disabled={isLoading}
            >
              {selectedModelInfo ? (
                <>
                  <ModelSelectorLogo
                    provider={selectedModelInfo.providerID as any}
                    className="size-3.5 text-muted-foreground"
                  />
                  <span className="max-w-[100px] truncate font-medium">
                    {selectedModelInfo.name}
                  </span>
                </>
              ) : (
                <span className="font-medium text-muted-foreground">Select model</span>
              )}
              <AltArrowDown size={14} className="opacity-50" />
            </Button>
          )}
        </ModelSelectorTrigger>
        <ModelSelectorContent title="Select Model" header={header}>
          <ModelSelectorInput placeholder="Search models..." />
          <ModelSelectorList>
            <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
            {Object.entries(groupedModels).map(
              ([providerID, { name: providerName, models: providerModels }]) => {
                const isConnected = connectedProviders.includes(providerID);
                return (
                <ModelSelectorGroup
                  key={providerID}
                  heading={
                    <span className="flex items-center gap-2">
                      <span className="flex items-center justify-center size-5 rounded bg-muted/60 ring-1 ring-border/40">
                        <ModelSelectorLogo
                          provider={providerID as any}
                          className="size-3"
                        />
                      </span>
                      <span className="flex-1">{providerName}</span>
                      {isConnected && (
                        <div className="flex items-center gap-1.5 text-[10px] font-normal normal-case tracking-normal text-emerald-500/80 leading-none">
                          <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <div>Connected</div>
                        </div>
                      )}
                    </span>
                  }
                >
                  {providerModels.map((model) => (
                    <ModelSelectorItem
                      key={`${model.providerID}/${model.id}`}
                      value={`${model.providerID}/${model.id}`}
                      onSelect={() => {
                        selectModel(model.providerID, model.id);
                        setOpen(false);
                      }}
                      className="flex items-center justify-between gap-3 ml-7"
                    >
                      <span className="truncate">{model.name}</span>
                      {model.free && (
                        <span className="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/20">
                          Free
                        </span>
                      )}
                    </ModelSelectorItem>
                  ))}
                </ModelSelectorGroup>
              );
            })}
          </ModelSelectorList>
        </ModelSelectorContent>
      </ModelSelector>

      {/* Provider dialogs */}
      <DialogSelectProvider
        open={providerDialogState.type === "select-provider"}
        onOpenChange={(open) => {
          if (!open) handleCloseProviderDialog();
        }}
        onSelectProvider={handleSelectProvider}
      />

      {providerDialogState.type === "connect-provider" && (
        <DialogConnectProvider
          open={true}
          onOpenChange={(open) => {
            if (!open) handleCloseProviderDialog();
          }}
          providerId={providerDialogState.providerId}
          onBack={handleBackToSelect}
          onSuccess={handleCloseProviderDialog}
        />
      )}
    </>
  );
}
