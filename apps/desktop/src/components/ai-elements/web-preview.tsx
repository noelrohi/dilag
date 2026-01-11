"use client";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Maximize2,
  Minimize2,
  Monitor,
  Smartphone,
  Tablet,
  RotateCw,
} from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

// =============================================================================
// Types
// =============================================================================

export type WebViewport = "desktop" | "tablet" | "mobile";

export type ConsoleLog = {
  level: "log" | "warn" | "error" | "info";
  message: string;
  timestamp: Date;
};

export type WebPreviewContextValue = {
  // URL state
  url: string;
  setUrl: (url: string) => void;
  // Navigation history
  history: string[];
  historyIndex: number;
  canGoBack: boolean;
  canGoForward: boolean;
  goBack: () => void;
  goForward: () => void;
  navigate: (url: string) => void;
  refresh: () => void;
  refreshKey: number;
  // Viewport
  viewport: WebViewport;
  setViewport: (viewport: WebViewport) => void;
  // Full screen
  isFullScreen: boolean;
  toggleFullScreen: () => void;
  // Console
  consoleOpen: boolean;
  setConsoleOpen: (open: boolean) => void;
  logs: ConsoleLog[];
  addLog: (log: Omit<ConsoleLog, "timestamp">) => void;
  clearLogs: () => void;
  // Loading
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
};

export const VIEWPORT_SIZES: Record<WebViewport, { width: number; height: number }> = {
  desktop: { width: 1280, height: 800 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 667 },
};

// =============================================================================
// Context
// =============================================================================

const WebPreviewContext = createContext<WebPreviewContextValue | null>(null);

export const useWebPreview = () => {
  const context = useContext(WebPreviewContext);
  if (!context) {
    throw new Error("WebPreview components must be used within a WebPreview");
  }
  return context;
};

// =============================================================================
// WebPreview (Root)
// =============================================================================

export type WebPreviewProps = ComponentProps<"div"> & {
  defaultUrl?: string;
  defaultViewport?: WebViewport;
  onUrlChange?: (url: string) => void;
  onViewportChange?: (viewport: WebViewport) => void;
};

export const WebPreview = ({
  className,
  children,
  defaultUrl = "",
  defaultViewport = "desktop",
  onUrlChange,
  onViewportChange,
  ...props
}: WebPreviewProps) => {
  // URL and navigation state
  const [history, setHistory] = useState<string[]>(defaultUrl ? [defaultUrl] : []);
  const [historyIndex, setHistoryIndex] = useState(defaultUrl ? 0 : -1);
  const [refreshKey, setRefreshKey] = useState(0);

  // Viewport state
  const [viewport, setViewportState] = useState<WebViewport>(defaultViewport);

  // UI state
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [logs, setLogs] = useState<ConsoleLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const url = historyIndex >= 0 ? history[historyIndex] : "";

  const setUrl = useCallback((newUrl: string) => {
    if (historyIndex >= 0 && history[historyIndex] === newUrl) return;
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newUrl);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    onUrlChange?.(newUrl);
  }, [history, historyIndex, onUrlChange]);

  const navigate = useCallback((newUrl: string) => {
    setUrl(newUrl);
  }, [setUrl]);

  const goBack = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      onUrlChange?.(history[historyIndex - 1]);
    }
  }, [historyIndex, history, onUrlChange]);

  const goForward = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      onUrlChange?.(history[historyIndex + 1]);
    }
  }, [historyIndex, history, onUrlChange]);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const setViewport = useCallback((v: WebViewport) => {
    setViewportState(v);
    onViewportChange?.(v);
  }, [onViewportChange]);

  const toggleFullScreen = useCallback(() => {
    setIsFullScreen((prev) => !prev);
  }, []);

  const addLog = useCallback((log: Omit<ConsoleLog, "timestamp">) => {
    setLogs((prev) => [...prev, { ...log, timestamp: new Date() }]);
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const contextValue: WebPreviewContextValue = {
    url,
    setUrl,
    history,
    historyIndex,
    canGoBack: historyIndex > 0,
    canGoForward: historyIndex < history.length - 1,
    goBack,
    goForward,
    navigate,
    refresh,
    refreshKey,
    viewport,
    setViewport,
    isFullScreen,
    toggleFullScreen,
    consoleOpen,
    setConsoleOpen,
    logs,
    addLog,
    clearLogs,
    isLoading,
    setIsLoading,
  };

  return (
    <WebPreviewContext.Provider value={contextValue}>
      <div
        className={cn(
          "flex size-full flex-col rounded-lg border bg-card overflow-hidden",
          isFullScreen && "fixed inset-0 z-50 rounded-none",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </WebPreviewContext.Provider>
  );
};

// =============================================================================
// WebPreviewNavigation
// =============================================================================

export type WebPreviewNavigationProps = ComponentProps<"div">;

export const WebPreviewNavigation = ({
  className,
  children,
  ...props
}: WebPreviewNavigationProps) => (
  <div
    className={cn(
      "flex items-center gap-2 border-b bg-muted/30 px-3 py-2",
      className
    )}
    {...props}
  >
    {children}
  </div>
);

// =============================================================================
// WebPreviewNavigationButton
// =============================================================================

export type WebPreviewNavigationButtonProps = ComponentProps<typeof Button> & {
  tooltip?: string;
};

export const WebPreviewNavigationButton = ({
  onClick,
  disabled,
  tooltip,
  children,
  className,
  ...props
}: WebPreviewNavigationButtonProps) => (
  <TooltipProvider delayDuration={300}>
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          className={cn("size-8 p-0", className)}
          disabled={disabled}
          onClick={onClick}
          size="sm"
          variant="ghost"
          {...props}
        >
          {children}
        </Button>
      </TooltipTrigger>
      {tooltip && (
        <TooltipContent side="bottom">
          <p>{tooltip}</p>
        </TooltipContent>
      )}
    </Tooltip>
  </TooltipProvider>
);

// =============================================================================
// WebPreviewNavigationButtons (Back/Forward)
// =============================================================================

export const WebPreviewNavigationButtons = () => {
  const { canGoBack, canGoForward, goBack, goForward } = useWebPreview();

  return (
    <div className="flex items-center">
      <WebPreviewNavigationButton
        onClick={goBack}
        disabled={!canGoBack}
        tooltip="Go back"
      >
        <ArrowLeft className="size-4" />
      </WebPreviewNavigationButton>
      <WebPreviewNavigationButton
        onClick={goForward}
        disabled={!canGoForward}
        tooltip="Go forward"
      >
        <ArrowRight className="size-4" />
      </WebPreviewNavigationButton>
    </div>
  );
};

// =============================================================================
// WebPreviewRefresh
// =============================================================================

export const WebPreviewRefresh = () => {
  const { refresh, isLoading } = useWebPreview();

  return (
    <WebPreviewNavigationButton
      onClick={refresh}
      disabled={isLoading}
      tooltip="Refresh"
    >
      <RotateCw className={cn("size-4", isLoading && "animate-spin")} />
    </WebPreviewNavigationButton>
  );
};

// =============================================================================
// WebPreviewUrl
// =============================================================================

export type WebPreviewUrlProps = ComponentProps<typeof Input>;

export const WebPreviewUrl = ({
  value,
  onChange,
  onKeyDown,
  className,
  ...props
}: WebPreviewUrlProps) => {
  const { url, navigate } = useWebPreview();
  const [inputValue, setInputValue] = useState(url);

  useEffect(() => {
    setInputValue(url);
  }, [url]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
    onChange?.(event);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      navigate(inputValue);
    }
    onKeyDown?.(event);
  };

  return (
    <Input
      className={cn(
        "h-8 flex-1 bg-background/50 text-sm font-mono",
        className
      )}
      onChange={onChange ?? handleChange}
      onKeyDown={handleKeyDown}
      placeholder="Enter URL..."
      value={value ?? inputValue}
      {...props}
    />
  );
};

// =============================================================================
// WebPreviewViewportSelector
// =============================================================================

export const WebPreviewViewportSelector = () => {
  const { viewport, setViewport } = useWebPreview();

  const options: { id: WebViewport; icon: typeof Monitor; label: string }[] = [
    { id: "desktop", icon: Monitor, label: "Desktop" },
    { id: "tablet", icon: Tablet, label: "Tablet" },
    { id: "mobile", icon: Smartphone, label: "Mobile" },
  ];

  return (
    <div className="flex items-center gap-0.5 rounded-md bg-muted p-0.5">
      {options.map(({ id, icon: Icon, label }) => (
        <WebPreviewNavigationButton
          key={id}
          onClick={() => setViewport(id)}
          tooltip={label}
          variant={viewport === id ? "secondary" : "ghost"}
          className={cn(
            "size-7",
            viewport === id && "bg-background shadow-sm"
          )}
        >
          <Icon className="size-3.5" />
        </WebPreviewNavigationButton>
      ))}
    </div>
  );
};

// =============================================================================
// WebPreviewFullScreenToggle
// =============================================================================

export const WebPreviewFullScreenToggle = () => {
  const { isFullScreen, toggleFullScreen } = useWebPreview();

  return (
    <WebPreviewNavigationButton
      onClick={toggleFullScreen}
      tooltip={isFullScreen ? "Exit full screen" : "Full screen"}
    >
      {isFullScreen ? (
        <Minimize2 className="size-4" />
      ) : (
        <Maximize2 className="size-4" />
      )}
    </WebPreviewNavigationButton>
  );
};

// =============================================================================
// WebPreviewBody
// =============================================================================

export type WebPreviewBodyProps = ComponentProps<"div"> & {
  src?: string;
  loading?: ReactNode;
  emptyState?: ReactNode;
  iframeProps?: ComponentProps<"iframe">;
};

export const WebPreviewBody = ({
  className,
  loading,
  emptyState,
  src,
  iframeProps,
  children,
  ...props
}: WebPreviewBodyProps) => {
  const { url, refreshKey, viewport, setIsLoading, isLoading } = useWebPreview();
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const currentSize = VIEWPORT_SIZES[viewport];
  const iframeSrc = src ?? url;

  // Calculate scale to fit viewport in container
  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return;
      const padding = 48;
      const maxWidth = containerRef.current.clientWidth - padding;
      const maxHeight = containerRef.current.clientHeight - padding;
      const scaleX = maxWidth / currentSize.width;
      const scaleY = maxHeight / currentSize.height;
      setScale(Math.min(scaleX, scaleY, 1));
    };

    updateScale();
    const resizeObserver = new ResizeObserver(updateScale);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    return () => resizeObserver.disconnect();
  }, [currentSize.width, currentSize.height]);

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  if (!iframeSrc && emptyState) {
    return (
      <div
        ref={containerRef}
        className={cn(
          "flex-1 flex items-center justify-center bg-muted/20",
          className
        )}
        {...props}
      >
        {emptyState}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex-1 flex items-center justify-center overflow-hidden bg-muted/20 relative",
        className
      )}
      {...props}
    >
      {iframeSrc && (
        <div
          className="bg-background rounded-lg shadow-2xl overflow-hidden transition-all duration-300"
          style={{
            width: Math.floor(currentSize.width * scale),
            height: Math.floor(currentSize.height * scale),
          }}
        >
          <iframe
            key={refreshKey}
            src={iframeSrc}
            className="border-none outline-none origin-top-left block"
            style={{
              width: currentSize.width + 20,
              height: currentSize.height,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
            title="Web Preview"
            onLoad={handleIframeLoad}
            {...iframeProps}
          />
        </div>
      )}
      {isLoading && loading}
      {children}
    </div>
  );
};

// =============================================================================
// WebPreviewConsole
// =============================================================================

export type WebPreviewConsoleProps = ComponentProps<"div"> & {
  maxHeight?: number;
};

export const WebPreviewConsole = ({
  className,
  maxHeight = 200,
  children,
  ...props
}: WebPreviewConsoleProps) => {
  const { consoleOpen, setConsoleOpen, logs, clearLogs } = useWebPreview();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs appear
  useEffect(() => {
    if (scrollRef.current && consoleOpen) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, consoleOpen]);

  const errorCount = logs.filter((l) => l.level === "error").length;
  const warnCount = logs.filter((l) => l.level === "warn").length;

  return (
    <Collapsible
      className={cn("border-t bg-muted/30", className)}
      onOpenChange={setConsoleOpen}
      open={consoleOpen}
      {...props}
    >
      <CollapsibleTrigger asChild>
        <button className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-2">
            <span className="font-medium">Console</span>
            {(errorCount > 0 || warnCount > 0) && (
              <div className="flex items-center gap-1.5 text-xs">
                {errorCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">
                    {errorCount} error{errorCount !== 1 && "s"}
                  </span>
                )}
                {warnCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-600">
                    {warnCount} warning{warnCount !== 1 && "s"}
                  </span>
                )}
              </div>
            )}
          </div>
          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground transition-transform duration-200",
              consoleOpen && "rotate-180"
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t">
          <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/20">
            <span className="text-xs text-muted-foreground">
              {logs.length} message{logs.length !== 1 && "s"}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearLogs}
              className="h-6 px-2 text-xs"
              disabled={logs.length === 0}
            >
              Clear
            </Button>
          </div>
          <div
            ref={scrollRef}
            className="overflow-y-auto font-mono text-xs"
            style={{ maxHeight }}
          >
            {logs.length === 0 ? (
              <p className="px-3 py-4 text-muted-foreground text-center">
                No console output
              </p>
            ) : (
              <div className="divide-y divide-border/50">
                {logs.map((log, index) => (
                  <div
                    key={`${log.timestamp.getTime()}-${index}`}
                    className={cn(
                      "px-3 py-1.5 flex gap-2",
                      log.level === "error" && "bg-destructive/5 text-destructive",
                      log.level === "warn" && "bg-yellow-500/5 text-yellow-600",
                      log.level === "info" && "text-blue-600"
                    )}
                  >
                    <span className="text-muted-foreground shrink-0">
                      {log.timestamp.toLocaleTimeString()}
                    </span>
                    <span className="break-all">{log.message}</span>
                  </div>
                ))}
              </div>
            )}
            {children}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

// =============================================================================
// WebPreviewViewportInfo
// =============================================================================

export const WebPreviewViewportInfo = ({ className }: { className?: string }) => {
  const { viewport } = useWebPreview();
  const size = VIEWPORT_SIZES[viewport];

  return (
    <span className={cn("text-xs text-muted-foreground tabular-nums", className)}>
      {size.width} × {size.height}
    </span>
  );
};
