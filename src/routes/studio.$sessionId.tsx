import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useSessions } from "@/hooks/use-sessions";
import { useDesigns } from "@/hooks/use-designs";
import {
  useSessionStore,
  useScreenPositions,
  type ScreenPosition,
} from "@/context/session-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChatView } from "@/components/blocks/chat-view";
import { DesignCanvas } from "@/components/blocks/design-canvas";
import { DraggableScreen } from "@/components/blocks/draggable-screen";
import { MobileFrame } from "@/components/blocks/mobile-frame";
import { ScreenPreview } from "@/components/blocks/screen-preview";
import { PanelLeftClose, PanelLeftOpen, Palette, Copy, ChevronDown, GitFork } from "lucide-react";
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

// Grid layout constants for 4-column arrangement
const SCREEN_WIDTH = 280;
const SCREEN_HEIGHT = 572;
const GAP_X = 60;
const GAP_Y = 40;
const START_X = 100;
const START_Y = 100;
const COLUMNS = 4;

// Initial positions for screens - 4 column grid, oldest to newest
function getInitialPositions(screenIds: string[]): ScreenPosition[] {
  return screenIds.map((id, index) => ({
    id,
    x: START_X + (SCREEN_WIDTH + GAP_X) * (index % COLUMNS),
    y: START_Y + (SCREEN_HEIGHT + GAP_Y) * Math.floor(index / COLUMNS),
  }));
}

function StudioPage() {
  const { sessionId } = useParams({ from: "/studio/$sessionId" });
  const navigate = useNavigate();
  const [chatOpen, setChatOpen] = useState(true);

  const { selectSession, sendMessage, sessions, isServerReady, forkSessionDesignsOnly } = useSessions();
  const { designs } = useDesigns();
  const screenPositions = useScreenPositions(sessionId);
  const setScreenPositions = useSessionStore((s) => s.setScreenPositions);
  const setCurrentSessionId = useSessionStore((s) => s.setCurrentSessionId);

  // Initialize session on mount
  useEffect(() => {
    setCurrentSessionId(sessionId);
    selectSession(sessionId);
  }, [sessionId, selectSession, setCurrentSessionId]);

  // Check for initial prompt from landing page
  useEffect(() => {
    if (!isServerReady) return;

    const initialPrompt = localStorage.getItem("dilag-initial-prompt");
    const initialFilesJson = localStorage.getItem("dilag-initial-files");
    if (initialPrompt || initialFilesJson) {
      localStorage.removeItem("dilag-initial-prompt");
      localStorage.removeItem("dilag-initial-files");
      
      const files = initialFilesJson ? JSON.parse(initialFilesJson) : undefined;
      // Small delay to ensure session is ready
      setTimeout(() => {
        sendMessage(initialPrompt || "", files);
      }, 500);
    }
  }, [isServerReady, sendMessage]);

  // Sync screen positions when designs change
  useEffect(() => {
    if (designs.length === 0) return;

    const designIds = designs.map((d) => d.filename);
    const existingIds = screenPositions.map((p) => p.id);

    // Find new screens that need positions
    const newIds = designIds.filter((id) => !existingIds.includes(id));

    if (newIds.length > 0) {
      // Position new screens in grid based on their index in the full design array
      const newPositions = newIds.map((id) => {
        const index = designIds.indexOf(id);
        return {
          id,
          x: START_X + (SCREEN_WIDTH + GAP_X) * (index % COLUMNS),
          y: START_Y + (SCREEN_HEIGHT + GAP_Y) * Math.floor(index / COLUMNS),
        };
      });

      setScreenPositions(sessionId, [...screenPositions, ...newPositions]);
    }
  }, [designs, screenPositions, sessionId, setScreenPositions]);

  const handlePositionsChange = useCallback(
    (positions: ScreenPosition[]) => {
      setScreenPositions(sessionId, positions);
    },
    [sessionId, setScreenPositions]
  );

  const handleReset = useCallback(() => {
    const designIds = designs.map((d) => d.filename);
    setScreenPositions(sessionId, getInitialPositions(designIds));
  }, [designs, sessionId, setScreenPositions]);

  const handleForkSession = useCallback(async () => {
    const newSessionId = await forkSessionDesignsOnly();
    if (newSessionId) {
      navigate({ to: "/studio/$sessionId", params: { sessionId: newSessionId } });
    }
  }, [forkSessionDesignsOnly, navigate]);

  const currentSession = sessions.find((s: { id: string }) => s.id === sessionId);

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
              <DropdownMenuItem
                onClick={handleForkSession}
                disabled={designs.length === 0}
              >
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

        {/* Canvas area */}
        <div className="flex-1 bg-muted/20">
          {designs.length === 0 ? (
            <CanvasEmptyState />
          ) : (
            <DesignCanvas
              screenPositions={screenPositions}
              onPositionsChange={handlePositionsChange}
              onReset={handleReset}
            >
              {designs.map((design) => {
                const position = screenPositions.find(
                  (p) => p.id === design.filename
                );
                if (!position) return null;

                const filePath = currentSession?.cwd
                  ? `${currentSession.cwd}/screens/${design.filename}`
                  : design.filename;

                return (
                  <DraggableScreen
                    key={design.filename}
                    id={design.filename}
                    x={position.x}
                    y={position.y}
                  >
                    <MobileFrame
                      title={design.title}
                      status="success"
                      html={design.html}
                      filePath={filePath}
                    >
                      <ScreenPreview
                        screen={{
                          id: design.filename,
                          name: design.title,
                          html: design.html,
                          status: "success",
                        }}
                      />
                    </MobileFrame>
                  </DraggableScreen>
                );
              })}
            </DesignCanvas>
          )}
        </div>
      </div>
    </div>
  );
}

function CanvasEmptyState() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="size-20 rounded-2xl bg-primary/10 mx-auto flex items-center justify-center mb-4">
          <Palette className="size-10 text-primary/60" />
        </div>
        <h3 className="font-semibold text-lg">No screens yet</h3>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          Describe what you want to design in the chat and screens will appear here
        </p>
      </div>
    </div>
  );
}
