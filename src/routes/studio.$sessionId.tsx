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
import { PanelLeftClose, PanelLeftOpen, Home, Palette } from "lucide-react";

export const Route = createFileRoute("/studio/$sessionId")({
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
    if (initialPrompt) {
      localStorage.removeItem("dilag-initial-prompt");
      // Small delay to ensure session is ready
      setTimeout(() => {
        sendMessage(initialPrompt);
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
      {/* Header */}
      <header className="h-12 border-b flex items-center justify-between px-3 shrink-0 bg-card/50">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => navigate({ to: "/" })}
          >
            <Home className="size-4" />
          </Button>
          <div className="h-4 w-px bg-border" />
          <span className="text-sm font-medium truncate max-w-[200px]">
            {currentSession?.name ?? "Untitled"}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
          onClick={() => setChatOpen(!chatOpen)}
        >
          {chatOpen ? (
            <>
              <PanelLeftClose className="size-4" />
              <span className="text-xs">Hide Chat</span>
            </>
          ) : (
            <>
              <PanelLeftOpen className="size-4" />
              <span className="text-xs">Show Chat</span>
            </>
          )}
        </Button>
      </header>

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
