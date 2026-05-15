import { useEffect } from "react"
import { useUpdaterContext } from "@/context/updater-context"
import { bridge } from "@/lib/bridge"

interface CheckUpdatesMenuListenerProps {
  silent?: boolean
}

export function CheckUpdatesMenuListener({ silent = false }: CheckUpdatesMenuListenerProps) {
  const { checkForUpdates } = useUpdaterContext()

  useEffect(() => {
    const unsubscribe = bridge.menu.onEvent((eventId) => {
      if (eventId === "check-updates") {
        checkForUpdates(silent)
      }
    })

    return unsubscribe
  }, [checkForUpdates, silent])

  return null
}
