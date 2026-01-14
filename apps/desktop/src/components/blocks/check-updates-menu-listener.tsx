import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useUpdaterContext } from "@/context/updater-context";

interface CheckUpdatesMenuListenerProps {
  silent?: boolean;
}

export function CheckUpdatesMenuListener({
  silent = false,
}: CheckUpdatesMenuListenerProps) {
  const { checkForUpdates } = useUpdaterContext();

  useEffect(() => {
    const unlisten = listen<string>("menu-event", (event) => {
      if (event.payload === "check-updates") {
        checkForUpdates(silent);
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [checkForUpdates, silent]);

  return null;
}