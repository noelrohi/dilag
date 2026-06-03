import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react"
import type { UpdateDownloadEvent } from "@dilag/desktop-bridge"
import { bridge } from "@/lib/bridge"

export interface UpdateInfo {
  version: string
  currentVersion: string
  body?: string
}

export interface UpdaterState {
  checking: boolean
  updateAvailable: boolean
  updateInfo: UpdateInfo | null
  downloading: boolean
  downloadProgress: number
  updateReady: boolean
  upToDate: boolean
  error: string | null
}

export type UpdateCheckResult =
  | { status: "available"; updateInfo: UpdateInfo }
  | { status: "up-to-date" }
  | { status: "error"; error: string }

interface UpdaterContextValue extends UpdaterState {
  checkForUpdates: (silent?: boolean) => Promise<UpdateCheckResult>
  installUpdate: () => Promise<void>
  dismissUpdate: () => void
}

const UpdaterContext = createContext<UpdaterContextValue | null>(null)

const MOCK_UPDATE_INFO: UpdateInfo = {
  version: "9.9.9-dev",
  currentVersion: "0.0.0-dev",
  body: "Development updater mock",
}

function shouldUseMockUpdater() {
  return import.meta.env.DEV && window.localStorage.getItem("dilag:mock-updater") === "1"
}

const updaterBridge = {
  async check() {
    if (shouldUseMockUpdater()) {
      await new Promise((resolve) => setTimeout(resolve, 600))
      return MOCK_UPDATE_INFO
    }

    return bridge.updater.check()
  },
  async download(listener: (event: UpdateDownloadEvent) => void) {
    if (!shouldUseMockUpdater()) {
      await bridge.updater.download(listener)
      return
    }

    listener({ event: "Started", data: { contentLength: 100 } })
    for (const percent of [12, 29, 47, 68, 84, 100]) {
      await new Promise((resolve) => setTimeout(resolve, 450))
      listener({ event: "Progress", data: { chunkLength: percent, percent } })
    }
    listener({ event: "Finished" })
  },
  async install() {
    if (shouldUseMockUpdater()) {
      console.info("[dilag] mock updater install")
      return
    }

    await bridge.updater.install()
  },
}

interface UpdaterProviderProps {
  children: ReactNode
}

export function UpdaterProvider({ children }: UpdaterProviderProps) {
  const [state, setState] = useState<UpdaterState>({
    checking: false,
    updateAvailable: false,
    updateInfo: null,
    downloading: false,
    downloadProgress: 0,
    updateReady: false,
    upToDate: false,
    error: null,
  })

  const updateRef = useRef<UpdateInfo | null>(null)
  const hasCheckedRef = useRef(false)
  const downloadPromiseRef = useRef<Promise<void> | null>(null)
  const updateReadyRef = useRef(false)

  const downloadUpdate = useCallback(async ({ installAfterDownload = false } = {}) => {
    const update = updateRef.current
    if (!update) return

    if (updateReadyRef.current) {
      if (installAfterDownload) {
        await updaterBridge.install()
      }
      return
    }

    if (!downloadPromiseRef.current) {
      downloadPromiseRef.current = (async () => {
        setState((prev) => ({
          ...prev,
          downloading: true,
          downloadProgress: 0,
          updateReady: false,
          error: null,
          upToDate: false,
        }))

        let downloaded = 0
        let contentLength = 0

        try {
          await updaterBridge.download((event: UpdateDownloadEvent) => {
            switch (event.event) {
              case "Started":
                downloaded = 0
                contentLength = event.data.contentLength ?? 0
                setState((prev) => ({ ...prev, downloadProgress: 0 }))
                break
              case "Progress": {
                downloaded += event.data.chunkLength
                const progress =
                  typeof event.data.percent === "number"
                    ? event.data.percent
                    : contentLength > 0
                      ? (downloaded / contentLength) * 100
                      : 0
                setState((prev) => ({ ...prev, downloadProgress: Math.round(progress) }))
                break
              }
              case "Finished":
                setState((prev) => ({ ...prev, downloadProgress: 100 }))
                break
            }
          })

          updateReadyRef.current = true
          setState((prev) => ({
            ...prev,
            downloading: false,
            downloadProgress: 100,
            updateReady: true,
          }))
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to download update"
          setState((prev) => ({
            ...prev,
            downloading: false,
            updateReady: false,
            error: message,
          }))
          throw error
        } finally {
          downloadPromiseRef.current = null
        }
      })()
    }

    await downloadPromiseRef.current

    if (installAfterDownload) {
      await updaterBridge.install()
    }
  }, [])

  const checkForUpdates = useCallback(
    async (silent = false): Promise<UpdateCheckResult> => {
      setState((prev) => ({ ...prev, checking: true, error: null }))

      try {
        const updateResult = await updaterBridge.check()
        if (updateResult) {
          const updateInfo = {
            version: updateResult.version,
            currentVersion: updateResult.currentVersion,
            body: updateResult.body ?? undefined,
          }

          updateRef.current = updateResult
          updateReadyRef.current = false
          setState((prev) => ({
            ...prev,
            checking: false,
            updateAvailable: true,
            updateReady: false,
            upToDate: false,
            downloadProgress: 0,
            updateInfo,
          }))

          void downloadUpdate().catch(() => {
            // Error state is set by downloadUpdate and rendered inline where needed.
          })

          return { status: "available", updateInfo }
        }

        updateRef.current = null
        updateReadyRef.current = false
        setState((prev) => ({
          ...prev,
          checking: false,
          updateAvailable: false,
          updateReady: false,
          upToDate: !silent,
          downloadProgress: 0,
        }))
        return { status: "up-to-date" }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to check for updates"
        setState((prev) => ({
          ...prev,
          checking: false,
          error: message,
        }))
        return { status: "error", error: message }
      }
    },
    [downloadUpdate],
  )

  const installUpdate = useCallback(async () => {
    if (!updateRef.current) return

    try {
      if (updateReadyRef.current) {
        await updaterBridge.install()
        return
      }

      await downloadUpdate({ installAfterDownload: true })
    } catch (error) {
      setState((prev) => ({
        ...prev,
        downloading: false,
        error: error instanceof Error ? error.message : "Failed to install update",
      }))
    }
  }, [downloadUpdate])

  const dismissUpdate = useCallback(() => {
    setState((prev) => ({
      ...prev,
      updateAvailable: false,
      updateInfo: null,
      updateReady: false,
      upToDate: false,
      downloadProgress: 0,
    }))
    updateRef.current = null
    updateReadyRef.current = false
  }, [])

  // Check for updates once on mount (with delay to not block app startup).
  // Use silent mode to avoid showing "up to date" status on every app launch.
  useEffect(() => {
    if (hasCheckedRef.current) return
    hasCheckedRef.current = true

    const timer = setTimeout(() => {
      checkForUpdates(true) // silent = true for auto-check
    }, 3000)

    return () => clearTimeout(timer)
  }, [checkForUpdates])

  const value: UpdaterContextValue = {
    ...state,
    checkForUpdates,
    installUpdate,
    dismissUpdate,
  }

  return <UpdaterContext.Provider value={value}>{children}</UpdaterContext.Provider>
}

export function useUpdaterContext() {
  const context = useContext(UpdaterContext)
  if (!context) {
    throw new Error("useUpdaterContext must be used within an UpdaterProvider")
  }
  return context
}
