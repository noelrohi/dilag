import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSDK } from "@/context/global-events";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// Providers that use OAuth (no API key needed)
const OAUTH_PROVIDERS = ["anthropic", "google", "github-copilot", "openai"] as const;
type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

export interface Model {
  id: string;
  name: string;
  providerID: string;
  providerName: string;
}

interface ModelState {
  selectedModel: { providerID: string; modelID: string } | null;
  setSelectedModel: (model: { providerID: string; modelID: string } | null) => void;
}

export const useModelStore = create<ModelState>()(
  persist(
    (set) => ({
      selectedModel: { providerID: "anthropic", modelID: "claude-sonnet-4-20250514" },
      setSelectedModel: (model) => set({ selectedModel: model }),
    }),
    {
      name: "dilag-model-store",
      storage: createJSONStorage(() => localStorage),
    }
  )
);

/**
 * Query key factory for models
 */
export const modelKeys = {
  all: ["models"] as const,
  providers: () => [...modelKeys.all, "providers"] as const,
};

/**
 * Transform raw provider data into filtered, sorted Model array
 */
function transformProviderData(
  all: Array<{ id: string; name: string; models: Record<string, { id?: string; name: string }> }>,
  connected: string[]
): { models: Model[]; connectedProviders: string[] } {
  const filteredModels: Model[] = [];

  for (const provider of all) {
    // Only include our target OAuth providers
    if (!OAUTH_PROVIDERS.includes(provider.id as OAuthProvider)) continue;

    // Only include if connected
    if (!connected.includes(provider.id)) continue;

    // Extract models
    for (const [key, model] of Object.entries(provider.models)) {
      const modelID = model.id || key;

      // Filter specific models based on provider
      if (provider.id === "anthropic") {
        if (!modelID.includes("claude")) continue;
      } else if (provider.id === "google") {
        if (!modelID.includes("gemini")) continue;
      } else if (provider.id === "github-copilot") {
        if (!modelID.includes("codex") && !modelID.includes("gpt")) continue;
      } else if (provider.id === "openai") {
        if (!modelID.includes("gpt") && !modelID.includes("codex") && !modelID.includes("o1") && !modelID.includes("o3")) continue;
      }

      filteredModels.push({
        id: modelID,
        name: model.name,
        providerID: provider.id,
        providerName: provider.name,
      });
    }
  }

  // Sort models: Claude first, then Gemini, then OpenAI, then GitHub Copilot
  filteredModels.sort((a, b) => {
    const providerOrder = ["anthropic", "google", "openai", "github-copilot"];
    const aOrder = providerOrder.indexOf(a.providerID);
    const bOrder = providerOrder.indexOf(b.providerID);
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.name.localeCompare(b.name);
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
    [setSelectedModel]
  );

  const selectedModelInfo = useMemo(() => {
    if (!selectedModel) return null;
    return models.find(
      (m) => m.providerID === selectedModel.providerID && m.id === selectedModel.modelID
    ) ?? null;
  }, [selectedModel, models]);

  return {
    models,
    selectedModel,
    selectedModelInfo,
    isLoading,
    error: error?.message ?? null,
    connectedProviders,
    selectModel,
    refreshModels: () => { refetch(); },
  };
}
