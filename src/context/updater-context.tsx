import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { check, type Update, type DownloadEvent } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { toast } from "sonner";

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

interface UpdaterContextValue extends UpdaterState {
  checkForUpdates: () => Promise<void>;
  installUpdate: () => Promise<void>;
  dismissUpdate: () => void;
}

const UpdaterContext = createContext<UpdaterContextValue | null>(null);

interface UpdaterProviderProps {
  children: ReactNode;
}

export function UpdaterProvider({ children }: UpdaterProviderProps) {
  const [state, setState] = useState<UpdaterState>({
    checking: false,
    updateAvailable: false,
    updateInfo: null,
    downloading: false,
    downloadProgress: 0,
    error: null,
  });

  const [update, setUpdate] = useState<Update | null>(null);
  const updateRef = useRef<Update | null>(null);
  const hasCheckedRef = useRef(false);

  const checkForUpdates = useCallback(async () => {
    setState((prev) => ({ ...prev, checking: true, error: null }));

    try {
      const updateResult = await check();

      if (updateResult) {
        setUpdate(updateResult);
        updateRef.current = updateResult;
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

        // Show toast notification for available update
        toast(`Update v${updateResult.version} available`, {
          description: "A new version is ready to install",
          duration: Infinity,
          action: {
            label: "Update Now",
            onClick: async () => {
              const currentUpdate = updateRef.current;
              if (!currentUpdate) return;

              try {
                let downloaded = 0;
                let contentLength = 0;

                setState((prev) => ({ ...prev, downloading: true, downloadProgress: 0 }));

                await currentUpdate.downloadAndInstall((event: DownloadEvent) => {
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

                await relaunch();
              } catch (error) {
                setState((prev) => ({ ...prev, downloading: false }));
                toast.error("Failed to install update");
              }
            },
          },
        });
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

      await relaunch();
    } catch (error) {
      setState((prev) => ({
        ...prev,
        downloading: false,
        error: error instanceof Error ? error.message : "Failed to install update",
      }));
      toast.error("Failed to install update");
    }
  }, [update]);

  const dismissUpdate = useCallback(() => {
    setState((prev) => ({
      ...prev,
      updateAvailable: false,
      updateInfo: null,
    }));
    setUpdate(null);
    updateRef.current = null;
  }, []);

  // Check for updates once on mount (with delay to not block app startup)
  useEffect(() => {
    if (hasCheckedRef.current) return;
    hasCheckedRef.current = true;

    const timer = setTimeout(() => {
      checkForUpdates();
    }, 3000);

    return () => clearTimeout(timer);
  }, [checkForUpdates]);

  const value: UpdaterContextValue = {
    ...state,
    checkForUpdates,
    installUpdate,
    dismissUpdate,
  };

  return (
    <UpdaterContext.Provider value={value}>
      {children}
    </UpdaterContext.Provider>
  );
}

export function useUpdaterContext() {
  const context = useContext(UpdaterContext);
  if (!context) {
    throw new Error("useUpdaterContext must be used within an UpdaterProvider");
  }
  return context;
}
