import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSDK } from "@/context/global-events";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { invoke } from "@tauri-apps/api/core";

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
  cost?: { input?: number; output?: number };
  variants?: Record<string, Record<string, unknown>>;
}

interface ModelState {
  selectedModel: { providerID: string; modelID: string } | null;
  setSelectedModel: (
    model: { providerID: string; modelID: string } | null,
  ) => void;
  // Variant state: key is "providerID/modelID", value is variant name
  variants: Record<string, string | undefined>;
  setVariant: (modelKey: string, variant: string | undefined) => void;
}

export const useModelStore = create<ModelState>()(
  persist(
    (set) => ({
      // Default to Big Pickle
      selectedModel: { providerID: "opencode", modelID: "big-pickle" },
      setSelectedModel: (model) => set({ selectedModel: model }),
      variants: {},
      setVariant: (modelKey, variant) =>
        set((state) => ({
          variants: { ...state.variants, [modelKey]: variant },
        })),
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
 * Check if a model is marked as latest based on its name
 */
function isModelLatest(modelName: string): boolean {
  return modelName.toLowerCase().includes("(latest)");
}

/**
 * Check if a model is free based on cost data (matching simon pattern)
 */
function isModelFree(
  providerID: string,
  cost?: { input?: number; output?: number },
): boolean {
  if (providerID !== "opencode") return false;
  if (!cost) return true;
  return (cost.input ?? 0) === 0 && (cost.output ?? 0) === 0;
}

/**
 * Transform raw provider data into Model array with hot/free flags
 */
function transformProviderData(
  providers: Array<{
    id: string;
    name: string;
    models: Record<
      string,
      {
        id?: string;
        name: string;
        release_date?: string;
        family?: string;
        cost?: { input?: number; output?: number };
        variants?: Record<string, Record<string, unknown>>;
      }
    >;
  }>,
): Model[] {
  const models: Model[] = [];
  const seenModels = new Set<string>();

  for (const provider of providers) {
    for (const [key, model] of Object.entries(provider.models)) {
      const modelID = model.id || key;
      const dedupeKey = `${provider.id}:${modelID}`;
      if (seenModels.has(dedupeKey)) continue;
      seenModels.add(dedupeKey);

      models.push({
        id: modelID,
        name: model.name.replace(/\s*\(latest\)\s*/i, "").trim(),
        providerID: provider.id,
        providerName: provider.name,
        releaseDate: model.release_date,
        family: model.family,
        hot: isHotModel(modelID),
        free: isModelFree(provider.id, model.cost),
        latest: isModelLatest(model.name),
        cost: model.cost,
        variants: model.variants,
      });
    }
  }

  models.sort((a, b) => {
    if (a.hot && !b.hot) return -1;
    if (!a.hot && b.hot) return 1;
    return a.name.localeCompare(b.name);
  });

  return models;
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
      const connectedProviders = response.data.connected ?? [];
      const connectedSet = new Set(connectedProviders);
      const connected = response.data.all.filter((p) => connectedSet.has(p.id));
      return {
        models: transformProviderData(connected),
        connectedProviders,
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
  const { selectedModel, setSelectedModel, variants, setVariant } =
    useModelStore();
  const queryClient = useQueryClient();
  const [isRestarting, setIsRestarting] = useState(false);

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

  // Get the model key for variant storage
  const modelKey = useMemo(() => {
    if (!selectedModel) return null;
    return `${selectedModel.providerID}/${selectedModel.modelID}`;
  }, [selectedModel]);

  // Get available variants for current model
  const variantList = useMemo(() => {
    if (!selectedModelInfo?.variants) return [];
    return Object.keys(selectedModelInfo.variants);
  }, [selectedModelInfo]);

  // Get current variant for selected model
  const currentVariant = useMemo(() => {
    if (!modelKey) return undefined;
    return variants[modelKey];
  }, [modelKey, variants]);

  // Set variant for current model
  const setCurrentVariant = useCallback(
    (variant: string | undefined) => {
      if (!modelKey) return;
      setVariant(modelKey, variant);
    },
    [modelKey, setVariant],
  );

  // Cycle through variants: undefined -> variant[0] -> variant[1] -> ... -> undefined
  const cycleVariant = useCallback(() => {
    if (variantList.length === 0) return;

    const currentIndex = currentVariant
      ? variantList.indexOf(currentVariant)
      : -1;

    if (currentIndex === -1) {
      // No variant selected, select first
      setCurrentVariant(variantList[0]);
    } else if (currentIndex === variantList.length - 1) {
      // Last variant, cycle back to undefined (default)
      setCurrentVariant(undefined);
    } else {
      // Select next variant
      setCurrentVariant(variantList[currentIndex + 1]);
    }
  }, [variantList, currentVariant, setCurrentVariant]);

  const restartServerAndRefresh = useCallback(async () => {
    setIsRestarting(true);
    try {
      console.log("[useModels] Restarting OpenCode server...");
      const port = await invoke<number>("restart_opencode_server");
      console.log("[useModels] Server restarted on port:", port);
      // Poll for server readiness (up to 10s)
      for (let i = 0; i < 20; i++) {
        try {
          const res = await fetch(`http://127.0.0.1:${port}/health`);
          if (res.ok) break;
        } catch {
          await new Promise((r) => setTimeout(r, 500));
        }
      }
      // Force refetch by invalidating and refetching
      console.log("[useModels] Refetching models...");
      await queryClient.resetQueries({ queryKey: modelKeys.all });
      await refetch();
      console.log("[useModels] Models refetched");
    } catch (error) {
      console.error("[useModels] Failed to restart server:", error);
    } finally {
      setIsRestarting(false);
    }
  }, [queryClient, refetch]);

  return {
    models,
    connectedProviders,
    selectedModel,
    selectedModelInfo,
    isLoading,
    isRestarting,
    error: error?.message ?? null,
    selectModel,
    refreshModels: () => {
      refetch();
    },
    restartServerAndRefresh,
    // Variant-related
    variantList,
    currentVariant,
    setCurrentVariant,
    cycleVariant,
  };
}
