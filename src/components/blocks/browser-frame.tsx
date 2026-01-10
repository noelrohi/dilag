import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useGlobalEvents } from "@/context/global-events";
import { isEventFileWatcherUpdated } from "@/lib/event-guards";
import { useSessionHasFiles, useTrackFileWrite, useSessionStatus } from "@/context/session-store";
import { ServerErrorOverlay } from "@/components/blocks/server-error-overlay";
import { useSendToChat } from "@/hooks/use-chat-interface";
import { PreviewTabs, type PreviewTab } from "@/components/blocks/preview-tabs";
import { CodePreview } from "@/components/blocks/code-preview";
import {
  Play,
  Square,
  Globe,
  Loader2,
  MessageSquare,
  ExternalLink,
  Code2,
} from "lucide-react";
import { DilagIcon } from "@/components/ui/dilag-icon";
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
  sessionId: string;
  sessionCwd: string;
  activeTab: PreviewTab;
  onTabChange: (tab: PreviewTab) => void;
  diffCount: number;
  className?: string;
}

export function BrowserFrame({ sessionId, sessionCwd, activeTab, onTabChange, diffCount, className }: BrowserFrameProps) {
  const [viteStatus, setViteStatus] = useState<ViteStatus | null>(null);
  const [projectReady, setProjectReady] = useState<boolean | null>(null);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track if any files have been written for this session.
  // We primarily rely on the file watcher, but also use a filesystem fallback
  // so the UI doesn't get stuck if events are missed.
  const hasFilesFromEvents = useSessionHasFiles(sessionCwd);
  const [hasFilesOnDisk, setHasFilesOnDisk] = useState<boolean | null>(null);
  const trackFileWrite = useTrackFileWrite();

  // Track session status for auto-start
  const sessionStatus = useSessionStatus(sessionId);
  const [hasAutoStarted, setHasAutoStarted] = useState(false);
  const prevSessionStatusRef = useRef<string | null>(null);

  // Send-to-chat for error overlay
  const sendToChat = useSendToChat();

  // Global events subscription for file tracking
  const { subscribe } = useGlobalEvents();

  const checkProjectReady = useCallback(async () => {
    try {
      const ready = await invoke<boolean>("check_project_ready", { sessionCwd });
      setProjectReady(ready);
    } catch (err) {
      console.error("Failed to check project:", err);
      setProjectReady(false);
    }
  }, [sessionCwd]);

  const checkProjectHasFiles = useCallback(async () => {
    try {
      const hasFiles = await invoke<boolean>("check_project_has_files", { sessionCwd });
      setHasFilesOnDisk(hasFiles);
    } catch (err) {
      console.error("Failed to check project files:", err);
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

  // Initial checks on mount
  useEffect(() => {
    checkProjectReady();
    checkViteStatus();
  }, [checkProjectReady, checkViteStatus]);

  // Filesystem fallback: if the project already exists (or events were missed),
  // derive "has files" from disk so the UI doesn't get stuck.
  useEffect(() => {
    if (!projectReady) return;
    checkProjectHasFiles();
  }, [projectReady, checkProjectHasFiles]);

  // While a project exists but no files are detected yet, keep polling briefly.
  // This covers slow writes and missed watcher events.
  useEffect(() => {
    if (!projectReady) return;
    if (hasFilesFromEvents || hasFilesOnDisk) return;

    const interval = setInterval(() => {
      checkProjectHasFiles();
    }, 1500);

    return () => clearInterval(interval);
  }, [projectReady, hasFilesFromEvents, hasFilesOnDisk, checkProjectHasFiles]);

  // Poll only for Vite server status (server state can change externally)
  // Project readiness is now event-driven via file watcher
  useEffect(() => {
    const interval = setInterval(() => {
      checkViteStatus();
    }, 3000);
    return () => clearInterval(interval);
  }, [checkViteStatus]);

  // Track file writes and project readiness via file watcher events
  // This is event-driven instead of polling for better responsiveness
  useEffect(() => {
    const unsubscribe = subscribe((event) => {
      if (!isEventFileWatcherUpdated(event)) return;

      const { file, event: changeType } = event.properties;

      // Only process add/change events
      if (changeType === "unlink") return;

      const normalizedFile = file.replaceAll("\\", "/");
      const normalizedCwd = sessionCwd.replaceAll("\\", "/").replace(/\/+$/, "");

      // Check if this file is within this session's cwd
      if (!normalizedFile.startsWith(`${normalizedCwd}/`)) return;

      // If package.json is created/changed, re-check project readiness
      if (normalizedFile.endsWith("package.json")) {
        console.debug("[BrowserFrame] package.json detected, checking project readiness");
        checkProjectReady();
        checkProjectHasFiles();
      }

      // Track all file writes for this session (trackFileWrite handles filtering)
      console.debug("[BrowserFrame] File write detected:", normalizedFile);
      trackFileWrite(sessionCwd, normalizedFile);

      if (
        !normalizedFile.endsWith("package.json") &&
        !normalizedFile.endsWith("bun.lockb") &&
        !normalizedFile.endsWith(".DS_Store")
      ) {
        setHasFilesOnDisk(true);
      }
    });

    return () => unsubscribe();
  }, [subscribe, sessionCwd, trackFileWrite, checkProjectReady, checkProjectHasFiles]);

  const isCurrentSession = viteStatus?.session_cwd === sessionCwd;
  const hasFiles = hasFilesFromEvents || !!hasFilesOnDisk;

  // Auto-switch to this project if Vite is running for a different session
  useEffect(() => {
    if (viteStatus?.running && !isCurrentSession && projectReady && hasFiles) {
      handleSwitchProject();
    }
  }, [sessionCwd, viteStatus?.running, isCurrentSession, projectReady, hasFiles]);

  // Auto-start server when session becomes idle and conditions are met
  useEffect(() => {
    const prevStatus = prevSessionStatusRef.current;
    prevSessionStatusRef.current = sessionStatus;

    const isNowIdle = sessionStatus === "idle";
    const becameIdle = prevStatus !== "idle" && isNowIdle;

    if (
      becameIdle &&
      !hasAutoStarted &&
      projectReady &&
      hasFiles &&
      !viteStatus?.running &&
      !starting
    ) {
      console.debug("[BrowserFrame] Session is idle, auto-starting server...");
      setHasAutoStarted(true);
      handleStart();
    }
  }, [sessionStatus, hasAutoStarted, projectReady, hasFiles, viteStatus?.running, starting]);

  // Reset auto-start state when session changes
  useEffect(() => {
    setHasAutoStarted(false);
    setHasFilesOnDisk(null);
    prevSessionStatusRef.current = null;
  }, [sessionCwd]);

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
    if (!projectReady) {
      setError("Project not ready yet. Wait for package.json to be created.");
      return;
    }

    if (!hasFiles) {
      setError("Project files not detected yet. Wait for generation to finish.");
      return;
    }

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

  // When showing code tab, render minimal UI
  if (activeTab === "code") {
    return (
      <div className={cn("flex flex-col h-full", className)}>
        {/* Minimal navigation for code view */}
        <div className="h-10 px-3 flex items-center border-b border-border bg-muted/30">
          <PreviewTabs
            activeTab={activeTab}
            onTabChange={onTabChange}
            codeCount={diffCount}
          />
        </div>
        <CodePreview
          sessionId={sessionId}
          sessionCwd={sessionCwd}
          className="flex-1 min-h-0"
        />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <WebPreview defaultUrl={iframeUrl} className="rounded-none border-0">
        <WebPreviewNavigation className="gap-3">
          {/* Preview/Code tabs */}
          <PreviewTabs
            activeTab={activeTab}
            onTabChange={onTabChange}
            codeCount={diffCount}
          />

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
                disabled={starting || !projectReady || !hasFiles}
                tooltip={
                  !projectReady
                    ? "No project yet"
                    : !hasFiles
                      ? "Waiting for files"
                      : "Start server"
                }
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
          sessionCwd={sessionCwd}
          iframeUrl={iframeUrl}
          isRunning={isRunning}
          isServerRunningElsewhere={!!(viteStatus?.running && !isCurrentSession)}
          projectReady={projectReady}
          hasFiles={hasFiles}
          starting={starting}
          error={error}
          onStart={handleStart}
          onSendToChat={sendToChat}
        />

        <WebPreviewConsole />
      </WebPreview>
    </div>
  );
}

// Separate component to use the WebPreview context
function PreviewContent({
  sessionCwd,
  iframeUrl,
  isRunning,
  isServerRunningElsewhere,
  projectReady,
  hasFiles,
  starting,
  error,
  onStart,
  onSendToChat,
}: {
  sessionCwd: string;
  iframeUrl: string;
  isRunning: boolean;
  isServerRunningElsewhere: boolean;
  projectReady: boolean | null;
  hasFiles: boolean;
  starting: boolean;
  error: string | null;
  onStart: () => void;
  onSendToChat: (errorText: string, prefix?: string) => void;
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

  // Listen for file changes to auto-refresh the preview (only when server is running)
  useEffect(() => {
    if (!isRunning) return;

    const unsubscribe = subscribe((event) => {
      if (!isEventFileWatcherUpdated(event)) return;

      const { file, event: changeType } = event.properties;
      const normalizedFile = file.replaceAll("\\", "/");
      const normalizedCwd = sessionCwd.replaceAll("\\", "/").replace(/\/+$/, "");

      // Only process add/change events (not unlink/delete)
      if (changeType === "unlink") return;

      // Only refresh for changes within this session
      if (!normalizedFile.startsWith(`${normalizedCwd}/`)) return;

      // Skip node_modules, .git, and other non-source files
      if (
        normalizedFile.includes("node_modules") ||
        normalizedFile.includes(".git") ||
        normalizedFile.includes("dist/") ||
        normalizedFile.includes(".next/") ||
        normalizedFile.endsWith(".log")
      ) {
        return;
      }

      // Debounce rapid file changes (e.g., from saves or build processes)
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }

      refreshTimeoutRef.current = setTimeout(() => {
        console.debug("[BrowserFrame] File changed, refreshing preview:", normalizedFile);
        refresh();
      }, 300); // 300ms debounce
    });

    return () => {
      unsubscribe();
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [isRunning, subscribe, refresh, sessionCwd]);

  // Loading: checking project
  if (projectReady === null) {
    return (
      <WebPreviewBody
        emptyState={
          <div className="flex flex-col items-center justify-center gap-4 text-muted-foreground">
            <div className="relative size-12 rounded-xl bg-muted/50 flex items-center justify-center">
              <DilagIcon animated className="size-6 text-muted-foreground" />
            </div>
            <p className="text-sm">Checking project...</p>
          </div>
        }
      />
    );
  }

  // No project yet (no package.json)
  if (!projectReady) {
    return (
      <WebPreviewBody
        emptyState={
          <div className="flex flex-col items-center justify-center gap-6 text-muted-foreground">
            <div className="relative size-16 rounded-2xl bg-muted/30 border border-border/50 flex items-center justify-center">
              <MessageSquare className="size-7 text-muted-foreground/70" />
            </div>
            <div className="text-center max-w-xs space-y-2">
              <p className="text-sm font-medium text-foreground">
                No project yet
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Describe your app in the chat and the AI will generate a project for you
              </p>
            </div>
          </div>
        }
      />
    );
  }

  // Project initialized but no files written yet
  if (!hasFiles) {
    return (
      <WebPreviewBody
        emptyState={
          <div className="flex flex-col items-center justify-center gap-6 text-muted-foreground">
            {/* Animated icon container */}
            <div className="relative">
              {/* Outer ring with pulse */}
              <div className="absolute -inset-4 rounded-full bg-primary/5 animate-pulse" />
              <div className="absolute -inset-2 rounded-full bg-primary/10 animate-pulse [animation-delay:150ms]" />

              {/* Main icon container */}
              <div className="relative size-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center shadow-lg">
                <DilagIcon animated className="size-8 text-primary" />
              </div>

              {/* Floating code brackets */}
              <div className="absolute -right-2 -top-2 text-primary/40 animate-bounce [animation-duration:2s]">
                <Code2 className="size-4" />
              </div>
              <div className="absolute -left-2 -bottom-2 text-primary/30 animate-bounce [animation-duration:2.5s] [animation-delay:500ms]">
                <Code2 className="size-3" />
              </div>
            </div>

            {/* Text content */}
            <div className="text-center space-y-2 max-w-xs">
              <p className="text-sm font-medium text-foreground">
                Building your app
              </p>
              <p className="text-xs text-muted-foreground">
                Writing files and setting up your project...
              </p>
              {error && (
                <p className="text-xs text-destructive">
                  {error}
                </p>
              )}
            </div>

            {/* Typing indicator dots */}
            <div className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-primary/60 animate-pulse [animation-delay:0ms]" />
              <span className="size-1.5 rounded-full bg-primary/60 animate-pulse [animation-delay:200ms]" />
              <span className="size-1.5 rounded-full bg-primary/60 animate-pulse [animation-delay:400ms]" />
            </div>
          </div>
        }
      />
    );
  }

  // Switching to this project (server is running for a DIFFERENT session)
  if (isServerRunningElsewhere) {
    return (
      <WebPreviewBody
        emptyState={
          <div className="flex flex-col items-center justify-center gap-4 text-muted-foreground">
            <Loader2 className="size-8 animate-spin" />
            <p className="text-sm">Starting dev server...</p>
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
    >
      <ServerErrorOverlay onSendToChat={onSendToChat} />
    </WebPreviewBody>
  );
}
