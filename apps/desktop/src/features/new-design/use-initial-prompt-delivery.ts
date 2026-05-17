import { useEffect } from "react"
import type { FileUIPart } from "ai"
import { NEW_DESIGN_STORAGE_KEYS } from "./use-new-design-flow"

export interface InitialPromptStorage {
  getItem(key: string): string | null
  removeItem(key: string): void
}

export interface UseInitialPromptDeliveryArgs {
  isServerReady: boolean
  routeSessionId: string
  selectedSessionId: string | null
  hasRouteSession: boolean
  sendMessage: (text: string, files?: FileUIPart[]) => void | Promise<unknown>
  storage?: InitialPromptStorage
}

export function useInitialPromptDelivery({
  isServerReady,
  routeSessionId,
  selectedSessionId,
  hasRouteSession,
  sendMessage,
  storage = window.localStorage,
}: UseInitialPromptDeliveryArgs) {
  useEffect(() => {
    if (!isServerReady || !hasRouteSession || selectedSessionId !== routeSessionId) return

    const initialPrompt = storage.getItem(NEW_DESIGN_STORAGE_KEYS.initialPrompt)
    const initialFilesJson = storage.getItem(NEW_DESIGN_STORAGE_KEYS.initialFiles)
    if (!initialPrompt && !initialFilesJson) return

    storage.removeItem(NEW_DESIGN_STORAGE_KEYS.initialPrompt)
    storage.removeItem(NEW_DESIGN_STORAGE_KEYS.initialFiles)
    storage.removeItem(NEW_DESIGN_STORAGE_KEYS.initialPlatform)

    const files = initialFilesJson ? (JSON.parse(initialFilesJson) as FileUIPart[]) : undefined
    void sendMessage(initialPrompt || "", files)
  }, [isServerReady, hasRouteSession, selectedSessionId, routeSessionId, sendMessage, storage])
}
