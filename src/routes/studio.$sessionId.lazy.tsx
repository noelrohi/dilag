import { createLazyFileRoute, useParams, useNavigate } from "@tanstack/react-router";
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
import { PanelLeftClose, PanelLeftOpen, ChevronRight, Palette } from "lucide-react";
import { DilagLogo } from "@/components/ui/dilag-logo";

export const Route = createLazyFileRoute("/studio/$sessionId")({
  component: StudioPage,
});

// Initial positions for new screens - stagger horizontally
function getInitialPositions(screenIds: string[]): ScreenPosition[] {
  const SCREEN_WIDTH = 280;
  const GAP = 60;
  const START_X = 100;
  const START_Y = 100;

  return screenIds.map((id, index) => ({
    id,
    x: START_X + (SCREEN_WIDTH + GAP) * index,
    y: START_Y,
  }));
}

function StudioPage() {
  const { sessionId } = useParams({ from: "/studio/$sessionId" });
  const navigate = useNavigate();
  const [chatOpen, setChatOpen] = useState(true);

  const { selectSession, sendMessage, sessions, isServerReady } = useSessions();
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
      // Calculate offset based on existing screens
      const maxX = screenPositions.length > 0
        ? Math.max(...screenPositions.map((p) => p.x))
        : 0;

      // Add positions for new screens
      const newPositions = newIds.map((id, index) => ({
        id,
        x: maxX + 340 + (280 + 60) * index,
        y: 100,
      }));

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

  const currentSession = sessions.find((s: { id: string }) => s.id === sessionId);

  return (
    <div className="h-dvh flex flex-col bg-background">
      {/* Title bar drag region */}
      <div
        data-tauri-drag-region
        className="h-[38px] shrink-0 flex items-center select-none relative"
      >
        {/* Left controls - sidebar trigger + breadcrumbs */}
        <div className="absolute left-0 top-0 h-full flex items-center pl-3 gap-2">
          {/* Sidebar toggle */}
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

          {/* Breadcrumbs: Dilag > Session Name */}
          <div className="flex items-center gap-1 text-[12px]">
            <button
              onClick={() => navigate({ to: "/" })}
              className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
            >
              <DilagLogo className="size-4" />
              <span>Dilag</span>
            </button>
            <ChevronRight className="size-3 text-muted-foreground/50" />
            <span className="font-medium text-foreground truncate max-w-[180px]">
              {currentSession?.name ?? "Untitled"}
            </span>
          </div>
        </div>
      </div>

      {/* Toolbar with border */}
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

                return (
                  <DraggableScreen
                    key={design.filename}
                    id={design.filename}
                    x={position.x}
                    y={position.y}
                  >
                    <MobileFrame title={design.title} status="success">
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
        <div className="size-20 rounded-2xl bg-purple-500/10 mx-auto flex items-center justify-center mb-4">
          <Palette className="size-10 text-purple-500/60" />
        </div>
        <h3 className="font-semibold text-lg">No screens yet</h3>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          Describe what you want to design in the chat and screens will appear here
        </p>
      </div>
    </div>
  );
}
