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
import { toast } from "sonner"
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
  error: string | null
}

interface UpdaterContextValue extends UpdaterState {
  checkForUpdates: (silent?: boolean) => Promise<void>
  installUpdate: () => Promise<void>
  dismissUpdate: () => void
}

const UpdaterContext = createContext<UpdaterContextValue | null>(null)

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
    error: null,
  })

  const updateRef = useRef<UpdateInfo | null>(null)
  const hasCheckedRef = useRef(false)
  const downloadPromiseRef = useRef<Promise<void> | null>(null)
  const updateReadyRef = useRef(false)
  const installUpdateRef = useRef<(() => Promise<void>) | null>(null)

  const downloadUpdate = useCallback(
    async ({ installAfterDownload = false, notifyWhenReady = false } = {}) => {
      const update = updateRef.current
      if (!update) return

      if (updateReadyRef.current) {
        if (installAfterDownload) {
          await bridge.updater.install()
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
          }))

          let downloaded = 0
          let contentLength = 0

          try {
            await bridge.updater.download((event: UpdateDownloadEvent) => {
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

            if (notifyWhenReady) {
              toast.success(`Update v${update.version} ready`, {
                description: "Restart Dilag to finish installing.",
                duration: Infinity,
                action: {
                  label: "Restart & Update",
                  onClick: () => {
                    installUpdateRef.current?.()
                  },
                },
              })
            }
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
        await bridge.updater.install()
      }
    },
    [],
  )

  const checkForUpdates = useCallback(
    async (silent = false) => {
      setState((prev) => ({ ...prev, checking: true, error: null }))

      try {
        const updateResult = await bridge.updater.check()

        if (updateResult) {
          updateRef.current = updateResult
          updateReadyRef.current = false
          setState((prev) => ({
            ...prev,
            checking: false,
            updateAvailable: true,
            updateReady: false,
            downloadProgress: 0,
            updateInfo: {
              version: updateResult.version,
              currentVersion: updateResult.currentVersion,
              body: updateResult.body ?? undefined,
            },
          }))

          if (!silent) {
            toast(`Downloading update v${updateResult.version}`, {
              description: "The update button will appear when it is ready.",
            })
          }

          void downloadUpdate({ notifyWhenReady: !silent }).catch((error) => {
            if (!silent) {
              const message = error instanceof Error ? error.message : "Failed to download update"
              toast.error(message)
            }
          })
        } else {
          updateRef.current = null
          updateReadyRef.current = false
          setState((prev) => ({
            ...prev,
            checking: false,
            updateAvailable: false,
            updateReady: false,
            downloadProgress: 0,
          }))

          // Show feedback only when manually checking (not silent)
          if (!silent) {
            toast.success("You're on the latest version")
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to check for updates"
        setState((prev) => ({
          ...prev,
          checking: false,
          error: message,
        }))

        // Show error feedback only when manually checking (not silent)
        if (!silent) {
          toast.error(message)
        }
      }
    },
    [downloadUpdate],
  )

  const installUpdate = useCallback(async () => {
    if (!updateRef.current) return

    try {
      if (updateReadyRef.current) {
        await bridge.updater.install()
        return
      }

      await downloadUpdate({ installAfterDownload: true })
    } catch (error) {
      setState((prev) => ({
        ...prev,
        downloading: false,
        error: error instanceof Error ? error.message : "Failed to install update",
      }))
      toast.error("Failed to install update")
    }
  }, [downloadUpdate])

  const dismissUpdate = useCallback(() => {
    setState((prev) => ({
      ...prev,
      updateAvailable: false,
      updateInfo: null,
      updateReady: false,
      downloadProgress: 0,
    }))
    updateRef.current = null
    updateReadyRef.current = false
  }, [])

  // Keep installUpdateRef in sync with installUpdate for toast callbacks.
  useEffect(() => {
    installUpdateRef.current = installUpdate
  }, [installUpdate])

  // Check for updates once on mount (with delay to not block app startup)
  // Use silent mode to avoid showing "up to date" toast on every app launch.
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
