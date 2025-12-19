import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSDK } from "@/context/global-events";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// Hot models to feature
const HOT_MODELS = [
  "gemini-3-pro-preview",
  "claude-opus-4-5",
  "gpt-5.2",
] as const;

export interface Model {
  id: string;
  name: string;
  providerID: string;
  providerName: string;
  releaseDate?: string;
  family?: string;
  hot?: boolean;
  free?: boolean;
  latest?: boolean;
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
      selectedModel: { providerID: "opencode", modelID: "big-pickle" },
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
 * Check if a model is hot (featured)
 */
function isHotModel(modelID: string): boolean {
  return HOT_MODELS.some(
    (hot) => modelID.includes(hot) || modelID.startsWith(hot),
  );
}

/**
 * Check if a model is free
 */
function isFreeModel(modelID: string): boolean {
  return modelID.includes("big-pickle");
}

/**
 * Filter to latest models (within 6 months, most recent per provider+family)
 */
function filterLatestModels(models: Model[]): Model[] {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  // Group by provider + family, keep most recent
  const grouped = new Map<string, Model>();
  for (const model of models) {
    if (!model.releaseDate) continue;
    const releaseDate = new Date(model.releaseDate);
    if (releaseDate < sixMonthsAgo) continue;

    const key = `${model.providerID}:${model.family || model.id}`;
    const existing = grouped.get(key);
    if (!existing || new Date(model.releaseDate) > new Date(existing.releaseDate!)) {
      grouped.set(key, model);
    }
  }

  // Mark filtered models as latest
  const latestModels = Array.from(grouped.values());
  return latestModels.map((m) => ({ ...m, latest: true }));
}

/**
 * Transform raw provider data into Model array with hot/free flags
 */
function transformProviderData(
  all: Array<{
    id: string;
    name: string;
    models: Record<
      string,
      {
        id?: string;
        name: string;
        release_date?: string;
        family?: string;
      }
    >;
  }>,
): Model[] {
  const models: Model[] = [];
  const seenModels = new Set<string>();

  for (const provider of all) {
    // Extract all models from provider
    for (const [key, model] of Object.entries(provider.models)) {
      const modelID = model.id || key;
      const dedupeKey = `${provider.id}:${modelID}`;
      if (seenModels.has(dedupeKey)) continue;
      seenModels.add(dedupeKey);

      models.push({
        id: modelID,
        name: model.name.replace("(latest)", "").trim(),
        providerID: provider.id,
        providerName: provider.name,
        releaseDate: model.release_date,
        family: model.family,
        hot: isHotModel(modelID),
        free: isFreeModel(modelID),
      });
    }
  }

  // Filter to latest models only, then sort
  const latestModels = filterLatestModels(models);

  // Sort: hot models first, then alphabetically by name
  latestModels.sort((a, b) => {
    if (a.hot && !b.hot) return -1;
    if (!a.hot && b.hot) return 1;
    return a.name.localeCompare(b.name);
  });

  return latestModels;
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
      return {
        models: transformProviderData(response.data.all),
        connectedProviders: response.data.connected ?? [],
      };
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
        (m: Model) =>
          m.providerID === selectedModel.providerID &&
          m.id === selectedModel.modelID,
      ) ?? null
    );
  }, [selectedModel, models]);

  return {
    models,
    connectedProviders,
    selectedModel,
    selectedModelInfo,
    isLoading,
    error: error?.message ?? null,
    selectModel,
    refreshModels: () => {
      refetch();
    },
  };
}
