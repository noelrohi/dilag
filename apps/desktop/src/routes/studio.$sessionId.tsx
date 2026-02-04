import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef } from "react";
import type { ImperativePanelHandle } from "react-resizable-panels";
import { invoke } from "@tauri-apps/api/core";
import { useQueryClient } from "@tanstack/react-query";
import { useSessions } from "@/hooks/use-sessions";
import { useSessionMutations } from "@/hooks/use-session-data";
import { useSessionDesigns, designKeys } from "@/hooks/use-designs";
import { usePngGenerator } from "@/hooks/use-png-generator";
import { useSDK } from "@/context/global-events";
import { useChatWidth } from "@/hooks/use-chat-width";
import {
  useScreenPositions,
  useSessionStore,
  type ScreenPosition,
} from "@/context/session-store";
import { cn } from "@/lib/utils";
import { Button } from "@dilag/ui/button";
import { Input } from "@dilag/ui/input";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@dilag/ui/resizable";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@dilag/ui/alert-dialog";
import { ChatView } from "@/components/blocks/chat/chat-view";
import { PageHeader, PageHeaderLeft, PageHeaderRight } from "@/components/blocks/layout/page-header";
import { DesignCanvas } from "@/components/canvas";
import { Copy, AltArrowDown, BranchingPathsUp, Pen, Palette, Play, Download } from "@solar-icons/react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@dilag/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@dilag/ui/dialog";
import { copyFilePath, exportImages } from "@/lib/design-export";
import { PreviewCarousel } from "@/components/blocks/preview/preview-carousel";
import { AttachmentBridgeProvider } from "@/context/attachment-bridge";
import { ScreenCaptureProvider, useScreenCaptureContext } from "@/context/screen-capture-context";
import { toast } from "sonner";

export const Route = createFileRoute("/studio/$sessionId")({
  component: StudioPage,
});

// Layout constants
const MOBILE_WIDTH = 280;
const MOBILE_HEIGHT = 572;
const WEB_WIDTH = 640;
const WEB_HEIGHT = 400;
const GAP = 60;
const START_X = 100;
const START_Y = 40;
const MOBILE_COLUMNS = 4;
const WEB_COLUMNS = 2;

function StudioPage() {
  const { sessionId } = useParams({ from: "/studio/$sessionId" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [chatOpen, setChatOpen] = useState(true);
  const [renameOpen, setRenameOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{
    filename: string;
    title: string;
  } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedScreenIds, setSelectedScreenIds] = useState<Set<string>>(new Set());

  const chatPanelRef = useRef<ImperativePanelHandle>(null);
  const { size: chatSize, updateSize, minSize } = useChatWidth();

  const { selectSession, sendMessage, sessions, isServerReady, forkSessionDesignsOnly } =
    useSessions();
  const { updateSession } = useSessionMutations();
  const sdk = useSDK();

  const currentSession = sessions.find((s: { id: string }) => s.id === sessionId);
  const { data: designs = [] } = useSessionDesigns(currentSession?.cwd);

  // Auto-generate PNG assets for designs
  usePngGenerator(designs, currentSession?.cwd, currentSession?.platform);

  // Screen positions from store
  const screenPositions = useScreenPositions(sessionId);
  const setScreenPositions = useSessionStore((s) => s.setScreenPositions);

  // Initialize session on mount
  useEffect(() => {
    selectSession(sessionId);
  }, [sessionId, selectSession]);

  // Sync screen positions when designs change
  useEffect(() => {
    if (designs.length === 0) return;

    const existingIds = screenPositions.map((p) => p.id);
    const newDesigns = designs.filter((d) => !existingIds.includes(d.filename));

    if (newDesigns.length > 0) {
      // Position new screens in grid after existing ones
      const startIndex = existingIds.length;
      const isMobile = currentSession?.platform === "mobile";
      const width = isMobile ? MOBILE_WIDTH : WEB_WIDTH;
      const height = isMobile ? MOBILE_HEIGHT : WEB_HEIGHT;
      const columns = isMobile ? MOBILE_COLUMNS : WEB_COLUMNS;

      const newPositions = newDesigns.map((design, i) => {
        const index = startIndex + i;
        const col = index % columns;
        const row = Math.floor(index / columns);

        return {
          id: design.filename,
          x: START_X + col * (width + GAP),
          y: START_Y + row * (height + GAP),
        };
      });

      setScreenPositions(sessionId, [...screenPositions, ...newPositions]);
    }
  }, [designs, screenPositions, sessionId, setScreenPositions, currentSession?.platform]);

  const handlePositionsChange = useCallback(
    (positions: ScreenPosition[]) => {
      setScreenPositions(sessionId, positions);
    },
    [sessionId, setScreenPositions]
  );

  const handleDeleteScreen = useCallback(async () => {
    if (!deleteTarget || !currentSession?.cwd) return;

    const filePath = `${currentSession.cwd}/screens/${deleteTarget.filename}`;
    try {
      await invoke("delete_design", { filePath });
      // Remove from positions
      setScreenPositions(
        sessionId,
        screenPositions.filter((p) => p.id !== deleteTarget.filename)
      );
      // Invalidate query to refresh designs
      queryClient.invalidateQueries({
        queryKey: designKeys.session(currentSession.cwd),
      });
      toast.success(`Deleted ${deleteTarget.title}`);
    } catch (err) {
      toast.error(`Failed to delete: ${err}`);
    }
    setDeleteTarget(null);
  }, [deleteTarget, currentSession?.cwd, sessionId, screenPositions, setScreenPositions, queryClient]);

  const handleForkSession = useCallback(async () => {
    const newSessionId = await forkSessionDesignsOnly();
    if (newSessionId) {
      navigate({ to: "/studio/$sessionId", params: { sessionId: newSessionId } });
    }
  }, [forkSessionDesignsOnly, navigate]);

  const handleRequestDelete = useCallback(
    (filename: string) => {
      const design = designs.find((d) => d.filename === filename);
      if (design) {
        setDeleteTarget({ filename, title: design.title });
      }
    },
    [designs]
  );

  const handleRename = useCallback(async () => {
    if (!currentSession || !newName.trim()) return;

    await updateSession({
      id: sessionId,
      updates: { name: newName.trim() },
    });

    await sdk.session.update({
      sessionID: sessionId,
      title: newName.trim(),
      directory: currentSession.cwd,
    });

    setRenameOpen(false);
  }, [currentSession, newName, sessionId, updateSession, sdk]);

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

  // Keyboard shortcuts for selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Cmd/Ctrl + A: Select all
      if ((e.metaKey || e.ctrlKey) && e.key === "a" && designs.length > 0) {
        e.preventDefault();
        setSelectedScreenIds(new Set(designs.map((d) => d.filename)));
      }

      // Escape: Clear selection (only when preview is not open)
      if (e.key === "Escape" && !previewOpen) {
        setSelectedScreenIds(new Set());
      }

      // Delete/Backspace: Delete selected (show confirmation)
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedScreenIds.size > 0
      ) {
        e.preventDefault();
        // If multiple selected, set deleteTarget to first for now
        // (Could enhance to batch delete later)
        const firstSelectedId = Array.from(selectedScreenIds)[0];
        const design = designs.find((d) => d.filename === firstSelectedId);
        if (design) {
          setDeleteTarget({ filename: design.filename, title: design.title });
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [designs, selectedScreenIds, previewOpen]);



  return (
    <AttachmentBridgeProvider>
    <div className="h-full flex flex-col bg-background overflow-hidden">
      <PageHeader>
        <PageHeaderLeft>
          <span className="text-sm font-medium truncate max-w-[200px]">
            {currentSession?.name ?? "Untitled"}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center justify-center size-6 hover:bg-muted rounded">
                <AltArrowDown size={14} className="text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                onClick={() => {
                  setNewName(currentSession?.name ?? "");
                  setRenameOpen(true);
                }}
              >
                <Pen size={16} className="mr-2" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleForkSession}>
                <BranchingPathsUp size={16} className="mr-2" />
                Fork to new session
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => currentSession?.cwd && copyFilePath(currentSession.cwd)}
                disabled={!currentSession?.cwd}
              >
                <Copy size={16} className="mr-2" />
                Copy session path
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  if (currentSession?.id) {
                    navigator.clipboard.writeText(currentSession.id);
                    toast.success("Session ID copied to clipboard");
                  }
                }}
                disabled={!currentSession?.id}
              >
                <Copy size={16} className="mr-2" />
                Copy session ID
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </PageHeaderLeft>

        <PageHeaderRight>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2.5 text-xs gap-1.5"
            onClick={() => setPreviewOpen(true)}
            disabled={designs.length === 0}
          >
            <Play size={14} />
            Preview
            {selectedScreenIds.size > 0 && (
              <span className="text-muted-foreground">({selectedScreenIds.size})</span>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2.5 text-xs gap-1.5"
            onClick={() => {
              const toExport = selectedScreenIds.size > 0
                ? designs.filter((d) => selectedScreenIds.has(d.filename))
                : designs;
              exportImages({
                designs: toExport,
                sessionName: currentSession?.name ?? "designs",
                platform: currentSession?.platform ?? "mobile",
              });
            }}
            disabled={designs.length === 0}
          >
            <Download size={14} />
            Export
            {selectedScreenIds.size > 0 && (
              <span className="text-muted-foreground">({selectedScreenIds.size})</span>
            )}
          </Button>
        </PageHeaderRight>
      </PageHeader>

      {/* Main content */}
      <ResizablePanelGroup
        direction="horizontal"
        className="flex-1 overflow-hidden"
        onLayout={(sizes) => {
          if (sizes[0] > 0) {
            updateSize(sizes[0]);
          }
        }}
      >
        {/* Chat pane - collapsible and resizable */}
        <ResizablePanel
          ref={chatPanelRef}
          defaultSize={chatSize}
          minSize={minSize}
          maxSize={50}
          collapsible
          collapsedSize={0}
          onCollapse={() => setChatOpen(false)}
          onExpand={() => setChatOpen(true)}
          className="overflow-hidden"
        >
          <div className="h-full">
            <ChatView />
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle={chatOpen} className={cn(!chatOpen && "hidden")} />

        {/* Canvas area */}
        <ResizablePanel defaultSize={100 - chatSize} className="bg-muted/20 overflow-hidden">
          {designs.length === 0 ? (
            <CanvasEmptyState />
          ) : (
            <ScreenCaptureProvider platform={currentSession?.platform ?? "web"}>
              <ConnectedCanvas
                designs={designs}
                platform={currentSession?.platform ?? "web"}
                positions={screenPositions}
                sessionCwd={currentSession?.cwd}
                selectedIds={selectedScreenIds}
                onPositionsChange={handlePositionsChange}
                onSelectionChange={setSelectedScreenIds}
                onDeleteScreen={handleRequestDelete}
              />
            </ScreenCaptureProvider>
          )}
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Rename Dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Rename Session</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleRename();
            }}
          >
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Session name"
              autoFocus
            />
            <DialogFooter className="mt-4">
              <Button type="button" variant="ghost" onClick={() => setRenameOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!newName.trim()}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete screen?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.title}"? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteScreen}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Preview Carousel */}
      <PreviewCarousel
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        designs={
          selectedScreenIds.size > 0
            ? designs.filter((d) => selectedScreenIds.has(d.filename))
            : designs
        }
        platform={currentSession?.platform}
      />
    </div>
    </AttachmentBridgeProvider>
  );
}

function CanvasEmptyState() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="size-20 rounded-2xl bg-primary/10 mx-auto flex items-center justify-center mb-4">
          <Palette size={40} className="text-primary/60" />
        </div>
        <h3 className="font-semibold text-lg">No screens yet</h3>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          Describe what you want to design in the chat and screens will appear here
        </p>
      </div>
    </div>
  );
}

// Wrapper that connects ScreenCaptureContext to DesignCanvas
interface ConnectedCanvasProps {
  designs: import("@/hooks/use-designs").DesignFile[];
  platform: "mobile" | "web";
  positions: ScreenPosition[];
  sessionCwd?: string;
  selectedIds: Set<string>;
  onPositionsChange: (positions: ScreenPosition[]) => void;
  onSelectionChange: (ids: Set<string>) => void;
  onDeleteScreen: (filename: string) => void;
}

function ConnectedCanvas({
  designs,
  platform,
  positions,
  sessionCwd,
  selectedIds,
  onPositionsChange,
  onSelectionChange,
  onDeleteScreen,
}: ConnectedCanvasProps) {
  const { captureAndAttach, captureElementAndAttach } = useScreenCaptureContext();

  return (
    <DesignCanvas
      designs={designs}
      platform={platform}
      positions={positions}
      sessionCwd={sessionCwd}
      selectedIds={selectedIds}
      onPositionsChange={onPositionsChange}
      onSelectionChange={onSelectionChange}
      onDeleteScreen={onDeleteScreen}
      onCaptureScreen={captureAndAttach}
      onEditElementWithAI={captureElementAndAttach}
    />
  );
}
