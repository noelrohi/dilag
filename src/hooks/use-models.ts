import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSDK } from "@/context/global-events";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// Supported providers (OAuth + API key)
const SUPPORTED_PROVIDERS = [
  "anthropic",
  "google",
  "openai",
  "github-copilot",
  "zen",
] as const;
type SupportedProvider = (typeof SUPPORTED_PROVIDERS)[number];

// Curated model whitelist per provider
// null = allow all models from that provider
const MODEL_WHITELIST: Record<SupportedProvider, string[] | null> = {
  anthropic: ["claude-opus-4-5", "claude-sonnet-4-5", "claude-haiku-4-5"],
  google: ["gemini-3-pro", "gemini-3-flash"],
  openai: ["gpt-5.2", "gpt-5.1-codex", "gpt-5.1-codex-mini"],
  "github-copilot": [
    "gpt-5.2",
    "gpt-5.1-codex",
    "gpt-5.1-codex-mini",
    "claude-sonnet-4.5",
    "claude-opus-4.5",
    "claude-haiku-4.5",
  ],
  // Zen provider - allow all models it provides (uses API key)
  zen: null,
};

export interface Model {
  id: string;
  name: string;
  providerID: string;
  providerName: string;
}

interface ModelState {
  selectedModel: { providerID: string; modelID: string } | null;
  setSelectedModel: (
    model: { providerID: string; modelID: string } | null,
  ) => void;
}

export const useModelStore = create<ModelState>()(
  persist(
    (set) => ({
      // Default to Big Pickle
      selectedModel: { providerID: "anthropic", modelID: "big-pickle" },
      setSelectedModel: (model) => set({ selectedModel: model }),
    }),
    {
      name: "dilag-model-store",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

/**
 * Query key factory for models
 */
export const modelKeys = {
  all: ["models"] as const,
  providers: () => [...modelKeys.all, "providers"] as const,
};

/**
 * Check if a model ID matches any pattern in the whitelist
 */
function matchesWhitelist(modelID: string, whitelist: string[]): string | null {
  // Exact match first
  if (whitelist.includes(modelID)) return modelID;

  // Partial match (model ID contains whitelist pattern)
  for (const pattern of whitelist) {
    if (modelID.includes(pattern) || modelID.startsWith(pattern)) {
      return pattern;
    }
  }
  return null;
}

/**
 * Transform raw provider data into filtered, sorted Model array
 */
function transformProviderData(
  all: Array<{
    id: string;
    name: string;
    models: Record<string, { id?: string; name: string }>;
  }>,
  connected: string[],
): { models: Model[]; connectedProviders: string[] } {
  const filteredModels: Model[] = [];
  const seenModels = new Set<string>();

  for (const provider of all) {
    // Only include supported providers
    if (!SUPPORTED_PROVIDERS.includes(provider.id as SupportedProvider))
      continue;

    // Only include if connected
    if (!connected.includes(provider.id)) continue;

    const whitelist = MODEL_WHITELIST[provider.id as SupportedProvider];

    // Extract models
    for (const [key, model] of Object.entries(provider.models)) {
      const modelID = model.id || key;

      // If whitelist is null, allow all models from this provider
      if (whitelist === null) {
        const dedupeKey = `${provider.id}:${modelID}`;
        if (seenModels.has(dedupeKey)) continue;
        seenModels.add(dedupeKey);

        filteredModels.push({
          id: modelID,
          name: model.name,
          providerID: provider.id,
          providerName: provider.name,
        });
        continue;
      }

      const matchedPattern = matchesWhitelist(modelID, whitelist);

      if (!matchedPattern) continue;

      // Dedupe by pattern (e.g., only one "claude-sonnet-4" variant)
      const dedupeKey = `${provider.id}:${matchedPattern}`;
      if (seenModels.has(dedupeKey)) continue;
      seenModels.add(dedupeKey);

      filteredModels.push({
        id: modelID,
        name: model.name.replace("(latest)", ""),
        providerID: provider.id,
        providerName: provider.name,
      });
    }
  }

  // Sort models by provider, then by model priority within provider
  const modelOrder: Record<string, number> = {
    "claude-opus-4": 1,
    "claude-sonnet-4": 2,
    "claude-haiku-4": 3,
    "big-pickle": 4,
    "gemini-3-pro": 1,
    "gemini-3-flash": 2,
    "gpt-5.2": 1,
    "codex-5.2": 1,
    "gpt-5.2-mini": 2,
    "codex-5.2-mini": 2,
    zen: 1,
  };

  filteredModels.sort((a, b) => {
    const providerOrder = [
      "anthropic",
      "google",
      "openai",
      "github-copilot",
      "zen",
    ];
    const aProviderIdx = providerOrder.indexOf(a.providerID);
    const bProviderIdx = providerOrder.indexOf(b.providerID);
    if (aProviderIdx !== bProviderIdx) return aProviderIdx - bProviderIdx;

    // Find matching pattern for ordering
    const aPattern =
      Object.keys(modelOrder).find((p) => a.id.includes(p)) || a.id;
    const bPattern =
      Object.keys(modelOrder).find((p) => b.id.includes(p)) || b.id;
    const aOrder = modelOrder[aPattern] ?? 99;
    const bOrder = modelOrder[bPattern] ?? 99;
    return aOrder - bOrder;
  });

  return { models: filteredModels, connectedProviders: connected };
}

/**
 * Hook to fetch provider/model data
 */
export function useProviderData() {
  const sdk = useSDK();

  return useQuery({
    queryKey: modelKeys.providers(),
    queryFn: async () => {
      const response = await sdk.provider.list();
      if (!response.data) {
        throw new Error("No provider data received");
      }
      return transformProviderData(response.data.all, response.data.connected);
    },
    staleTime: 1000 * 60 * 5, // 5 minutes - models don't change often
  });
}

/**
 * Hook that provides model selection with data fetching
 */
export function useModels() {
  const { data, isLoading, error, refetch } = useProviderData();
  const { selectedModel, setSelectedModel } = useModelStore();

  const models = data?.models ?? [];
  const connectedProviders = data?.connectedProviders ?? [];

  const selectModel = useCallback(
    (providerID: string, modelID: string) => {
      setSelectedModel({ providerID, modelID });
    },
    [setSelectedModel],
  );

  const selectedModelInfo = useMemo(() => {
    if (!selectedModel) return null;
    return (
      models.find(
        (m) =>
          m.providerID === selectedModel.providerID &&
          m.id === selectedModel.modelID,
      ) ?? null
    );
  }, [selectedModel, models]);

  return {
    models,
    selectedModel,
    selectedModelInfo,
    isLoading,
    error: error?.message ?? null,
    connectedProviders,
    selectModel,
    refreshModels: () => {
      refetch();
    },
  };
}
