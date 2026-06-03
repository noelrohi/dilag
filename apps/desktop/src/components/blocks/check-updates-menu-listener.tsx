import { useCallback, useEffect } from "react"
import { toast } from "sonner"
import { useUpdaterContext } from "@/context/updater-context"
import { bridge } from "@/lib/bridge"

interface CheckUpdatesMenuListenerProps {
  silent?: boolean
}

export function CheckUpdatesMenuListener({ silent = false }: CheckUpdatesMenuListenerProps) {
  const { checkForUpdates } = useUpdaterContext()

  const checkWithFeedback = useCallback(async () => {
    if (silent) {
      await checkForUpdates(true)
      return
    }

    const toastId = toast.loading("Checking for updates…")
    const result = await checkForUpdates(false)

    if (result.status === "available") {
      toast.success(`Dilag ${result.updateInfo.version} is available`, { id: toastId })
      return
    }

    if (result.status === "up-to-date") {
      toast.success("Dilag is up to date", { id: toastId })
      return
    }

    toast.error(result.error, { id: toastId })
  }, [checkForUpdates, silent])

  useEffect(() => {
    void bridge.menu
      .setState({ context: "setup", rendererReady: true })
      .catch((error) => console.error("Failed to update native menu state:", error))
  }, [])

  useEffect(() => {
    const unsubscribe = bridge.menu.onEvent((eventId) => {
      if (eventId === "check-updates") {
        void checkWithFeedback()
      }
    })

    return unsubscribe
  }, [checkWithFeedback])

  return null
}
