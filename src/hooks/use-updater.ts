import { useState, useEffect, useCallback } from "react";
import { check, type Update, type DownloadEvent } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export interface UpdateInfo {
  version: string;
  currentVersion: string;
  body?: string;
}

export interface UpdaterState {
  checking: boolean;
  updateAvailable: boolean;
  updateInfo: UpdateInfo | null;
  downloading: boolean;
  downloadProgress: number;
  error: string | null;
}

export function useUpdater() {
  const [state, setState] = useState<UpdaterState>({
    checking: false,
    updateAvailable: false,
    updateInfo: null,
    downloading: false,
    downloadProgress: 0,
    error: null,
  });

  const [update, setUpdate] = useState<Update | null>(null);

  const checkForUpdates = useCallback(async () => {
    setState((prev) => ({ ...prev, checking: true, error: null }));

    try {
      const updateResult = await check();

      if (updateResult) {
        setUpdate(updateResult);
        setState((prev) => ({
          ...prev,
          checking: false,
          updateAvailable: true,
          updateInfo: {
            version: updateResult.version,
            currentVersion: updateResult.currentVersion,
            body: updateResult.body ?? undefined,
          },
        }));
      } else {
        setState((prev) => ({
          ...prev,
          checking: false,
          updateAvailable: false,
        }));
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        checking: false,
        error: error instanceof Error ? error.message : "Failed to check for updates",
      }));
    }
  }, []);

  const installUpdate = useCallback(async () => {
    if (!update) return;

    setState((prev) => ({ ...prev, downloading: true, downloadProgress: 0 }));

    try {
      let downloaded = 0;
      let contentLength = 0;

      await update.downloadAndInstall((event: DownloadEvent) => {
        switch (event.event) {
          case "Started":
            contentLength = event.data.contentLength ?? 0;
            break;
          case "Progress":
            downloaded += event.data.chunkLength;
            const progress = contentLength > 0 ? (downloaded / contentLength) * 100 : 0;
            setState((prev) => ({ ...prev, downloadProgress: Math.round(progress) }));
            break;
          case "Finished":
            setState((prev) => ({ ...prev, downloadProgress: 100 }));
            break;
        }
      });

      // Relaunch the app after update
      await relaunch();
    } catch (error) {
      setState((prev) => ({
        ...prev,
        downloading: false,
        error: error instanceof Error ? error.message : "Failed to install update",
      }));
    }
  }, [update]);

  const dismissUpdate = useCallback(() => {
    setState((prev) => ({
      ...prev,
      updateAvailable: false,
      updateInfo: null,
    }));
    setUpdate(null);
  }, []);

  // Check for updates on mount (with delay to not block app startup)
  useEffect(() => {
    const timer = setTimeout(() => {
      checkForUpdates();
    }, 3000); // Check after 3 seconds

    return () => clearTimeout(timer);
  }, [checkForUpdates]);

  return {
    ...state,
    checkForUpdates,
    installUpdate,
    dismissUpdate,
  };
}
