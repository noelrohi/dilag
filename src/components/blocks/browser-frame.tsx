import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useGlobalEvents } from "@/context/global-events";
import { isEventFileWatcherUpdated } from "@/lib/event-guards";
import {
  Play,
  Square,
  Globe,
  Loader2,
  MessageSquare,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  WebPreview,
  WebPreviewNavigation,
  WebPreviewNavigationButtons,
  WebPreviewRefresh,
  WebPreviewViewportSelector,
  WebPreviewViewportInfo,
  WebPreviewFullScreenToggle,
  WebPreviewBody,
  WebPreviewConsole,
  WebPreviewNavigationButton,
  useWebPreview,
} from "@/components/ai-elements/web-preview";

interface ViteStatus {
  running: boolean;
  pid: number | null;
  port: number;
  session_cwd: string | null;
}

interface BrowserFrameProps {
  sessionCwd: string;
  className?: string;
}

export function BrowserFrame({ sessionCwd, className }: BrowserFrameProps) {
  const [viteStatus, setViteStatus] = useState<ViteStatus | null>(null);
  const [projectReady, setProjectReady] = useState<boolean | null>(null);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkProjectReady = useCallback(async () => {
    try {
      const ready = await invoke<boolean>("check_project_ready", { sessionCwd });
      setProjectReady(ready);
    } catch (err) {
      console.error("Failed to check project:", err);
      setProjectReady(false);
    }
  }, [sessionCwd]);

  const checkViteStatus = useCallback(async () => {
    try {
      const status = await invoke<ViteStatus>("get_vite_status");
      setViteStatus(status);
    } catch (err) {
      console.error("Failed to get Vite status:", err);
    }
  }, []);

  useEffect(() => {
    checkProjectReady();
    checkViteStatus();
    const interval = setInterval(() => {
      checkProjectReady();
      checkViteStatus();
    }, 3000);
    return () => clearInterval(interval);
  }, [checkProjectReady, checkViteStatus]);

  const isCurrentSession = viteStatus?.session_cwd === sessionCwd;

  // Auto-switch to this project if Vite is running for a different session
  useEffect(() => {
    if (viteStatus?.running && !isCurrentSession && projectReady) {
      handleSwitchProject();
    }
  }, [sessionCwd, viteStatus?.running, isCurrentSession, projectReady]);

  const handleSwitchProject = async () => {
    setStarting(true);
    setError(null);
    try {
      await invoke("stop_vite_server");
      await invoke("start_vite_server", { sessionCwd });
      await checkViteStatus();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setStarting(false);
    }
  };

  const handleStart = async () => {
    setStarting(true);
    setError(null);
    try {
      await invoke("start_vite_server", { sessionCwd });
      await checkViteStatus();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      console.error("Failed to start Vite:", err);
    } finally {
      setStarting(false);
    }
  };

  const handleStop = async () => {
    setStopping(true);
    setError(null);
    try {
      await invoke("stop_vite_server");
      await checkViteStatus();
    } catch (err) {
      console.error("Failed to stop Vite:", err);
    } finally {
      setStopping(false);
    }
  };

  const handleOpenExternal = async () => {
    if (viteStatus?.running && viteStatus.port) {
      await openUrl(`http://localhost:${viteStatus.port}`);
    }
  };

  const iframeUrl = viteStatus?.running && isCurrentSession
    ? `http://localhost:${viteStatus.port}`
    : "";

  const isRunning = !!(viteStatus?.running && isCurrentSession);

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <WebPreview defaultUrl={iframeUrl} className="rounded-none border-0">
        <WebPreviewNavigation className="gap-3">
          {/* Traffic lights */}
          <div className="flex items-center gap-1.5">
            <div className="size-3 rounded-full bg-red-500/80" />
            <div className="size-3 rounded-full bg-yellow-500/80" />
            <div className="size-3 rounded-full bg-green-500/80" />
          </div>

          {/* Navigation buttons */}
          <WebPreviewNavigationButtons />
          <WebPreviewRefresh />

          {/* URL bar */}
          <div className="flex-1 flex items-center">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-background/50 rounded-md border border-border/50 text-xs text-muted-foreground w-full max-w-md mx-auto">
              <Globe className="size-3 shrink-0" />
              <span className="font-mono truncate">
                {iframeUrl || "Not running"}
              </span>
            </div>
          </div>

          {/* Viewport controls */}
          <WebPreviewViewportSelector />
          <WebPreviewViewportInfo />

          {/* Server controls */}
          <div className="flex items-center gap-1">
            {isRunning && (
              <WebPreviewNavigationButton
                onClick={handleOpenExternal}
                tooltip="Open in browser"
              >
                <ExternalLink className="size-4" />
              </WebPreviewNavigationButton>
            )}

            {isRunning ? (
              <WebPreviewNavigationButton
                onClick={handleStop}
                disabled={stopping}
                tooltip="Stop server"
                className="text-destructive hover:text-destructive"
              >
                {stopping ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Square className="size-4" />
                )}
              </WebPreviewNavigationButton>
            ) : (
              <WebPreviewNavigationButton
                onClick={handleStart}
                disabled={starting || !projectReady}
                tooltip={projectReady ? "Start server" : "No project yet"}
                className="text-green-600 hover:text-green-600"
              >
                {starting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Play className="size-4" />
                )}
              </WebPreviewNavigationButton>
            )}

            <WebPreviewFullScreenToggle />
          </div>
        </WebPreviewNavigation>

        <PreviewContent
          iframeUrl={iframeUrl}
          isRunning={isRunning}
          isCurrentSession={isCurrentSession}
          projectReady={projectReady}
          starting={starting}
          error={error}
          onStart={handleStart}
        />

        <WebPreviewConsole />
      </WebPreview>
    </div>
  );
}

// Separate component to use the WebPreview context
function PreviewContent({
  iframeUrl,
  isRunning,
  isCurrentSession,
  projectReady,
  starting,
  error,
  onStart,
}: {
  iframeUrl: string;
  isRunning: boolean;
  isCurrentSession: boolean;
  projectReady: boolean | null;
  starting: boolean;
  error: string | null;
  onStart: () => void;
}) {
  const { navigate, refresh } = useWebPreview();
  const { subscribe } = useGlobalEvents();
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Update WebPreview URL when Vite URL changes
  useEffect(() => {
    if (iframeUrl) {
      navigate(iframeUrl);
    }
  }, [iframeUrl, navigate]);

  // Listen for file changes and auto-refresh the preview
  useEffect(() => {
    if (!isRunning) return;

    const unsubscribe = subscribe((event) => {
      if (!isEventFileWatcherUpdated(event)) return;

      const { file, event: changeType } = event.properties;

      // Only refresh for add/change events (not unlink/delete)
      if (changeType === "unlink") return;

      // Skip node_modules, .git, and other non-source files
      if (
        file.includes("node_modules") ||
        file.includes(".git") ||
        file.includes("dist/") ||
        file.includes(".next/") ||
        file.endsWith(".log")
      ) {
        return;
      }

      // Debounce rapid file changes (e.g., from saves or build processes)
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }

      refreshTimeoutRef.current = setTimeout(() => {
        console.debug("[BrowserFrame] File changed, refreshing preview:", file);
        refresh();
      }, 300); // 300ms debounce
    });

    return () => {
      unsubscribe();
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [isRunning, subscribe, refresh]);

  // Loading: switching projects
  if (!isCurrentSession && projectReady) {
    return (
      <WebPreviewBody
        emptyState={
          <div className="flex flex-col items-center justify-center gap-4 text-muted-foreground">
            <Loader2 className="size-8 animate-spin" />
            <p className="text-sm">Switching to this project...</p>
          </div>
        }
      />
    );
  }

  // Loading: checking project
  if (projectReady === null) {
    return (
      <WebPreviewBody
        emptyState={
          <div className="flex flex-col items-center justify-center gap-4 text-muted-foreground">
            <Loader2 className="size-8 animate-spin" />
            <p className="text-sm">Checking project...</p>
          </div>
        }
      />
    );
  }

  // No project yet
  if (!projectReady) {
    return (
      <WebPreviewBody
        emptyState={
          <div className="flex flex-col items-center justify-center gap-4 text-muted-foreground">
            <div className="size-16 rounded-full bg-muted/50 flex items-center justify-center">
              <MessageSquare className="size-8" />
            </div>
            <div className="text-center max-w-xs">
              <p className="text-sm font-medium text-foreground mb-1">
                No project yet
              </p>
              <p className="text-sm">
                Describe your app in the chat and the AI will generate a React
                project for you
              </p>
            </div>
          </div>
        }
      />
    );
  }

  // Project ready but server not running
  if (!isRunning) {
    return (
      <WebPreviewBody
        emptyState={
          <div className="flex flex-col items-center justify-center gap-4 text-muted-foreground">
            <div className="size-16 rounded-full bg-muted/50 flex items-center justify-center">
              <Globe className="size-8" />
            </div>
            <p className="text-sm">Start the dev server to preview your web app</p>
            {error && (
              <p className="text-sm text-destructive max-w-md text-center">
                {error}
              </p>
            )}
            <Button onClick={onStart} disabled={starting} size="sm">
              {starting ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Play className="size-4 mr-2" />
                  Start Server
                </>
              )}
            </Button>
          </div>
        }
      />
    );
  }

  // Server running - show iframe
  return (
    <WebPreviewBody
      src={iframeUrl}
      loading={
        <div className="absolute inset-0 flex items-center justify-center bg-background/80">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      }
    />
  );
}
