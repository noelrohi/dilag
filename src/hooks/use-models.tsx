import { useState, useEffect, useCallback } from "react";
import { useSDK } from "@/context/global-events";
import { create } from "zustand";

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

export const useModelStore = create<ModelState>((set) => ({
  selectedModel: { providerID: "anthropic", modelID: "claude-sonnet-4-20250514" },
  setSelectedModel: (model) => set({ selectedModel: model }),
}));

export function useModels() {
  const sdk = useSDK();
  const [models, setModels] = useState<Model[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectedProviders, setConnectedProviders] = useState<string[]>([]);

  const { selectedModel, setSelectedModel } = useModelStore();

  const loadModels = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await sdk.provider.list();
      if (!response.data) return;

      const { all, connected } = response.data;
      setConnectedProviders(connected);

      // Filter to only OAuth providers and extract models
      const filteredModels: Model[] = [];

      for (const provider of all) {
        // Only include our target OAuth providers
        if (!OAUTH_PROVIDERS.includes(provider.id as OAuthProvider)) continue;

        // Only include if connected
        if (!connected.includes(provider.id)) continue;

        // Extract models
        for (const [key, model] of Object.entries(provider.models)) {
          // Use model.id if available, otherwise use the key
          const modelID = model.id || key;

          // Filter specific models based on provider
          if (provider.id === "anthropic") {
            // Include Claude models
            if (!modelID.includes("claude")) continue;
          } else if (provider.id === "google") {
            // Include Gemini models
            if (!modelID.includes("gemini")) continue;
          } else if (provider.id === "github-copilot") {
            // Include Codex and GPT models
            if (!modelID.includes("codex") && !modelID.includes("gpt")) continue;
          } else if (provider.id === "openai") {
            // Include GPT and Codex models
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

      setModels(filteredModels);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load models");
    } finally {
      setIsLoading(false);
    }
  }, [sdk]);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  const selectModel = useCallback(
    (providerID: string, modelID: string) => {
      setSelectedModel({ providerID, modelID });
    },
    [setSelectedModel]
  );

  const getSelectedModelInfo = useCallback(() => {
    if (!selectedModel) return null;
    return models.find(
      (m) => m.providerID === selectedModel.providerID && m.id === selectedModel.modelID
    );
  }, [selectedModel, models]);

  return {
    models,
    selectedModel,
    selectedModelInfo: getSelectedModelInfo(),
    isLoading,
    error,
    connectedProviders,
    selectModel,
    refreshModels: loadModels,
  };
}
