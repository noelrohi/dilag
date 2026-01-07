import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useSessions } from "@/hooks/use-sessions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChatView } from "@/components/blocks/chat-view";
import { BrowserFrame } from "@/components/blocks/browser-frame";
import { PanelLeftClose, PanelLeftOpen, Copy, ChevronDown, GitFork } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { copyFilePath } from "@/lib/design-export";

export const Route = createFileRoute("/studio/$sessionId")({
  component: StudioPage,
});

function StudioPage() {
  const { sessionId } = useParams({ from: "/studio/$sessionId" });
  const navigate = useNavigate();
  const [chatOpen, setChatOpen] = useState(true);

  const { selectSession, sendMessage, sessions, isServerReady, forkSessionDesignsOnly } = useSessions();

  // Initialize session on mount
  useEffect(() => {
    selectSession(sessionId);
  }, [sessionId, selectSession]);

  const handleForkSession = useCallback(async () => {
    const newSessionId = await forkSessionDesignsOnly();
    if (newSessionId) {
      navigate({ to: "/studio/$sessionId", params: { sessionId: newSessionId } });
    }
  }, [forkSessionDesignsOnly, navigate]);

  const currentSession = sessions.find((s: { id: string }) => s.id === sessionId);

  // Auto-send initial prompt if stored
  useEffect(() => {
    if (!isServerReady || !currentSession) return;

    const initialPrompt = localStorage.getItem("dilag-initial-prompt");
    const initialFilesJson = localStorage.getItem("dilag-initial-files");
    if (initialPrompt || initialFilesJson) {
      localStorage.removeItem("dilag-initial-prompt");
      localStorage.removeItem("dilag-initial-files");
      
      const files = initialFilesJson ? JSON.parse(initialFilesJson) : undefined;
      sendMessage(initialPrompt || "", files);
    }
  }, [isServerReady, currentSession, sendMessage]);

  return (
    <div className="h-dvh flex flex-col bg-background">
      {/* Title bar drag region */}
      <div
        data-tauri-drag-region
        className="h-[38px] shrink-0 flex items-center select-none relative"
      >
        {/* Left controls - chat toggle */}
        <div className="absolute left-0 top-0 h-full flex items-center pl-3 gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => setChatOpen(!chatOpen)}
          >
            {chatOpen ? (
              <PanelLeftClose className="size-3.5" />
            ) : (
              <PanelLeftOpen className="size-3.5" />
            )}
          </Button>
          <span className="text-sm font-medium truncate max-w-[200px]">
            {currentSession?.name ?? "Untitled"}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center justify-center size-6 hover:bg-muted rounded">
                <ChevronDown className="size-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={handleForkSession}>
                <GitFork className="size-4 mr-2" />
                Fork to new session
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => currentSession?.cwd && copyFilePath(currentSession.cwd)}
                disabled={!currentSession?.cwd}
              >
                <Copy className="size-4 mr-2" />
                Copy session path
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Border */}
      <div className="h-px bg-border" />

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat pane - collapsible */}
        <div
          className={cn(
            "border-r overflow-hidden transition-all duration-300 ease-in-out",
            chatOpen ? "w-[360px]" : "w-0"
          )}
        >
          <div className="w-[360px] h-full">
            <ChatView />
          </div>
        </div>

        {/* Preview area - always BrowserFrame */}
        <div className="flex-1 bg-muted/20">
          {currentSession?.cwd ? (
            <BrowserFrame sessionCwd={currentSession.cwd} />
          ) : (
            <EmptyState />
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center">
        <p className="text-[13px] text-muted-foreground/50">
          Describe your app to get started
        </p>
      </div>
    </div>
  );
}
