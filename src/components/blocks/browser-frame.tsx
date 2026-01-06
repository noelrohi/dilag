import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Monitor, Tablet, Smartphone, RefreshCw, Play, Square, Globe, Loader2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useWebViewport, useSetWebViewport, VIEWPORT_SIZES, type WebViewport } from "@/context/design-mode-store";

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
  const viewport = useWebViewport();
  const setViewport = useSetWebViewport();
  const [viteStatus, setViteStatus] = useState<ViteStatus | null>(null);
  const [projectReady, setProjectReady] = useState<boolean | null>(null);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

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

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const viewportOptions: { id: WebViewport; icon: typeof Monitor; label: string }[] = [
    { id: "desktop", icon: Monitor, label: "Desktop" },
    { id: "tablet", icon: Tablet, label: "Tablet" },
    { id: "mobile", icon: Smartphone, label: "Mobile" },
  ];

  const currentSize = VIEWPORT_SIZES[viewport];
  const iframeUrl = viteStatus?.running ? `http://localhost:${viteStatus.port}` : "";
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const MAX_PREVIEW_WIDTH = 800;
  const MAX_PREVIEW_HEIGHT = 600;

  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return;
      const padding = 48;
      const maxWidth = Math.min(containerRef.current.clientWidth - padding, MAX_PREVIEW_WIDTH);
      const maxHeight = Math.min(containerRef.current.clientHeight - padding, MAX_PREVIEW_HEIGHT);
      const scaleX = maxWidth / currentSize.width;
      const scaleY = maxHeight / currentSize.height;
      setScale(Math.min(scaleX, scaleY, 1));
    };

    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [currentSize.width, currentSize.height]);

  const renderContent = () => {
    if (viteStatus?.running && isCurrentSession) {
      return (
        <div
          className="bg-background rounded-lg shadow-2xl overflow-hidden transition-all duration-300 border border-border/50"
          style={{
            width: currentSize.width * scale,
            height: currentSize.height * scale,
          }}
        >
          <iframe
            key={refreshKey}
            src={iframeUrl}
            className="border-0 origin-top-left"
            style={{
              width: currentSize.width,
              height: currentSize.height,
              transform: `scale(${scale})`,
            }}
            title="Web Preview"
          />
        </div>
      );
    }

    if (viteStatus?.running && !isCurrentSession) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
          <Loader2 className="size-8 animate-spin" />
          <p className="text-sm">Switching to this project...</p>
        </div>
      );
    }

    if (projectReady === null) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
          <Loader2 className="size-8 animate-spin" />
          <p className="text-sm">Checking project...</p>
        </div>
      );
    }

    if (!projectReady) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
          <div className="size-16 rounded-full bg-muted/50 flex items-center justify-center">
            <MessageSquare className="size-8" />
          </div>
          <div className="text-center max-w-xs">
            <p className="text-sm font-medium text-foreground mb-1">No project yet</p>
            <p className="text-sm">
              Describe your app in the chat and the AI will generate a React project for you
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
        <div className="size-16 rounded-full bg-muted/50 flex items-center justify-center">
          <Globe className="size-8" />
        </div>
        <p className="text-sm">Start the dev server to preview your web app</p>
        {error && (
          <p className="text-sm text-destructive max-w-md text-center">{error}</p>
        )}
        <Button onClick={handleStart} disabled={starting} size="sm">
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
    );
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <BrowserChrome
        url={iframeUrl}
        viewport={viewport}
        viewportOptions={viewportOptions}
        onViewportChange={setViewport}
        onRefresh={handleRefresh}
        viteRunning={viteStatus?.running ?? false}
        projectReady={projectReady ?? false}
        starting={starting}
        stopping={stopping}
        onStart={handleStart}
        onStop={handleStop}
      />

      <div ref={containerRef} className="flex-1 overflow-hidden bg-muted/20 flex items-center justify-center">
        {renderContent()}
      </div>
    </div>
  );
}

interface BrowserChromeProps {
  url: string;
  viewport: WebViewport;
  viewportOptions: { id: WebViewport; icon: typeof Monitor; label: string }[];
  onViewportChange: (viewport: WebViewport) => void;
  onRefresh: () => void;
  viteRunning: boolean;
  projectReady: boolean;
  starting: boolean;
  stopping: boolean;
  onStart: () => void;
  onStop: () => void;
}

function BrowserChrome({
  url,
  viewport,
  viewportOptions,
  onViewportChange,
  onRefresh,
  viteRunning,
  projectReady,
  starting,
  stopping,
  onStart,
  onStop,
}: BrowserChromeProps) {
  const currentSize = VIEWPORT_SIZES[viewport];

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-muted/50 border-b border-border/50">
      <div className="flex items-center gap-1.5">
        <div className="size-3 rounded-full bg-red-500/80" />
        <div className="size-3 rounded-full bg-yellow-500/80" />
        <div className="size-3 rounded-full bg-green-500/80" />
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-background/50 rounded-md border border-border/50 text-xs text-muted-foreground">
          <Globe className="size-3" />
          <span className="font-mono">{url || "Not running"}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 p-0.5 bg-muted rounded-md">
          {viewportOptions.map(({ id, icon: Icon, label }) => (
            <Button
              key={id}
              variant={viewport === id ? "secondary" : "ghost"}
              size="sm"
              onClick={() => onViewportChange(id)}
              className="h-7 px-2"
              title={label}
            >
              <Icon className="size-3.5" />
            </Button>
          ))}
        </div>

        <span className="text-xs text-muted-foreground tabular-nums min-w-[80px]">
          {currentSize.width} x {currentSize.height}
        </span>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={!viteRunning}
            className="h-7 w-7 p-0"
            title="Refresh"
          >
            <RefreshCw className="size-3.5" />
          </Button>

          {viteRunning ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onStop}
              disabled={stopping}
              className="h-7 px-2 text-destructive hover:text-destructive"
              title="Stop server"
            >
              {stopping ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Square className="size-3.5" />
              )}
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={onStart}
              disabled={starting || !projectReady}
              className="h-7 px-2 text-chart-2 hover:text-chart-2"
              title={projectReady ? "Start server" : "No project yet"}
            >
              {starting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Play className="size-3.5" />
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
