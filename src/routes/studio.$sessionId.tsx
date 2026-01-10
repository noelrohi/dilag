import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef } from "react";
import type { ImperativePanelHandle } from "react-resizable-panels";
import { useSessions } from "@/hooks/use-sessions";
import { useSessionMutations } from "@/hooks/use-session-data";
import { useSDK } from "@/context/global-events";
import { useSessionDiffs } from "@/context/session-store";
import { useChatWidth } from "@/hooks/use-chat-width";
import type { PreviewTab } from "@/components/blocks/preview-tabs";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { ChatView } from "@/components/blocks/chat-view";
import { BrowserFrame } from "@/components/blocks/browser-frame";
import { PanelLeftClose, PanelLeftOpen, Copy, ChevronDown, GitFork, Pencil } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { copyFilePath } from "@/lib/design-export";
import { toast } from "sonner";

export const Route = createFileRoute("/studio/$sessionId")({
  component: StudioPage,
});

function StudioPage() {
  const { sessionId } = useParams({ from: "/studio/$sessionId" });
  const navigate = useNavigate();
  const [chatOpen, setChatOpen] = useState(true);
  const [renameOpen, setRenameOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [activeTab, setActiveTab] = useState<PreviewTab>("preview");

  // Get file diffs for the code preview tab
  const diffs = useSessionDiffs(sessionId);
  const diffCount = diffs.length;

  const chatPanelRef = useRef<ImperativePanelHandle>(null);
  const { size: chatSize, updateSize, minSize } = useChatWidth();

  const { selectSession, sendMessage, sessions, isServerReady, forkSessionDesignsOnly } = useSessions();
  const { updateSession } = useSessionMutations();
  const sdk = useSDK();

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

  const handleRename = useCallback(async () => {
    if (!currentSession || !newName.trim()) return;

    // Update local metadata
    await updateSession({
      id: sessionId,
      updates: { name: newName.trim() },
    });

    // Sync to OpenCode
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
            onClick={() => {
              if (chatOpen) {
                chatPanelRef.current?.collapse();
              } else {
                chatPanelRef.current?.expand();
              }
            }}
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
                onClick={() => {
                  setNewName(currentSession?.name ?? "");
                  setRenameOpen(true);
                }}
              >
                <Pencil className="size-4 mr-2" />
                Rename
              </DropdownMenuItem>
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
              <DropdownMenuItem
                onClick={() => {
                  if (currentSession?.id) {
                    navigator.clipboard.writeText(currentSession.id);
                    toast.success("Session ID copied to clipboard");
                  }
                }}
                disabled={!currentSession?.id}
              >
                <Copy className="size-4 mr-2" />
                Copy session ID
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Border */}
      <div className="h-px bg-border" />

      {/* Main content */}
      <ResizablePanelGroup
        direction="horizontal"
        className="flex-1"
        onLayout={(sizes) => {
          // Only persist when chat is open and user is resizing
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

        <ResizableHandle
          withHandle={chatOpen}
          className={cn(!chatOpen && "hidden")}
        />

        {/* Preview area - always BrowserFrame */}
        <ResizablePanel defaultSize={100 - chatSize} className="bg-muted/20">
          {currentSession?.cwd ? (
            <BrowserFrame
              sessionId={currentSession.id}
              sessionCwd={currentSession.cwd}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              diffCount={diffCount}
            />
          ) : (
            <EmptyState />
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
