import { useCallback, useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import { bridge } from "@/lib/bridge"
import type { AgentThinkingLevel } from "@dilag/desktop-bridge"

export interface Model {
  id: string
  name: string
  providerID: string
  providerName: string
  releaseDate?: string
  family?: string
  hot?: boolean
  free?: boolean
  latest?: boolean
  cost?: { input?: number; output?: number }
  variants?: Record<AgentThinkingLevel, Record<string, unknown>>
}

interface ModelState {
  selectedModel: { providerID: string; modelID: string } | null
  setSelectedModel: (model: { providerID: string; modelID: string } | null) => void
  // Variant state: key is "providerID/modelID", value is variant name
  variants: Record<string, AgentThinkingLevel | undefined>
  setVariant: (modelKey: string, variant: AgentThinkingLevel | undefined) => void
}

export const useModelStore = create<ModelState>()(
  persist(
    (set) => ({
      selectedModel: null,
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
)

/**
 * Query key factory for models
 */
export const modelKeys = {
  all: ["models"] as const,
  providers: () => [...modelKeys.all, "providers"] as const,
}

/**
 * Hook to fetch provider/model data
 */
export function useProviderData() {
  return useQuery({
    queryKey: modelKeys.providers(),
    queryFn: async () => {
      const response = await bridge.agent.getProviderData()
      return {
        models: response.models,
        connectedProviders: response.connectedProviders,
        defaultModel: response.defaultModel,
      }
    },
    staleTime: 1000 * 60 * 5, // 5 minutes - models don't change often
  })
}

/**
 * Hook that provides model selection with data fetching
 */
export function useModels() {
  const { data, isLoading, error, refetch } = useProviderData()
  const { selectedModel, setSelectedModel, variants, setVariant } = useModelStore()
  const queryClient = useQueryClient()
  const [isRestarting, setIsRestarting] = useState(false)

  const models = data?.models ?? []
  const connectedProviders = data?.connectedProviders ?? []
  const effectiveSelectedModel = selectedModel ?? data?.defaultModel ?? null

  const selectModel = useCallback(
    (providerID: string, modelID: string) => {
      setSelectedModel({ providerID, modelID })
    },
    [setSelectedModel],
  )

  const selectedModelInfo = useMemo(() => {
    if (!effectiveSelectedModel) return null
    return (
      models.find(
        (m: Model) =>
          m.providerID === effectiveSelectedModel.providerID &&
          m.id === effectiveSelectedModel.modelID,
      ) ?? null
    )
  }, [effectiveSelectedModel, models])

  // Get the model key for variant storage
  const modelKey = useMemo(() => {
    if (!effectiveSelectedModel) return null
    return `${effectiveSelectedModel.providerID}/${effectiveSelectedModel.modelID}`
  }, [effectiveSelectedModel])

  // Get available variants for current model
  const variantList = useMemo(() => {
    if (!selectedModelInfo?.variants) return []
    return Object.keys(selectedModelInfo.variants) as AgentThinkingLevel[]
  }, [selectedModelInfo])

  // Get current variant for selected model
  const currentVariant = useMemo(() => {
    if (!modelKey) return undefined
    return variants[modelKey]
  }, [modelKey, variants])

  // Set variant for current model
  const setCurrentVariant = useCallback(
    (variant: AgentThinkingLevel | undefined) => {
      if (!modelKey) return
      setVariant(modelKey, variant)
    },
    [modelKey, setVariant],
  )

  // Cycle through variants: undefined -> variant[0] -> variant[1] -> ... -> undefined
  const cycleVariant = useCallback(() => {
    if (variantList.length === 0) return

    const currentIndex = currentVariant ? variantList.indexOf(currentVariant) : -1

    if (currentIndex === -1) {
      // No variant selected, select first
      setCurrentVariant(variantList[0])
    } else if (currentIndex === variantList.length - 1) {
      // Last variant, cycle back to undefined (default)
      setCurrentVariant(undefined)
    } else {
      // Select next variant
      setCurrentVariant(variantList[currentIndex + 1])
    }
  }, [variantList, currentVariant, setCurrentVariant])

  const restartServerAndRefresh = useCallback(async () => {
    setIsRestarting(true)
    try {
      console.log("[useModels] Restarting agent runtime...")
      await bridge.agent.restart()
      // Force refetch by invalidating and refetching
      console.log("[useModels] Refetching models...")
      await queryClient.resetQueries({ queryKey: modelKeys.all })
      await refetch()
      console.log("[useModels] Models refetched")
    } catch (error) {
      console.error("[useModels] Failed to restart server:", error)
    } finally {
      setIsRestarting(false)
    }
  }, [queryClient, refetch])

  return {
    models,
    connectedProviders,
    selectedModel: effectiveSelectedModel,
    selectedModelInfo,
    isLoading,
    isRestarting,
    error: error?.message ?? null,
    selectModel,
    refreshModels: () => {
      refetch()
    },
    restartServerAndRefresh,
    // Variant-related
    variantList,
    currentVariant,
    setCurrentVariant,
    cycleVariant,
  }
}
