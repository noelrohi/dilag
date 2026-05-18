import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router"
import { useEffect, useState, useCallback, useRef } from "react"
import type { ImperativePanelHandle } from "react-resizable-panels"
import { useQueryClient } from "@tanstack/react-query"
import { useSessions } from "@/hooks/use-sessions"
import { useSessionMutations } from "@/hooks/use-session-data"
import { useSessionDesigns, designKeys } from "@/hooks/use-designs"
import { usePngGenerator } from "@/hooks/use-png-generator"
import { useChatWidth } from "@/hooks/use-chat-width"
import {
  useScreenPositions,
  useSessionStore,
  useIsWritingScreen,
  type ScreenPosition,
} from "@/context/session-store"
import { Button } from "@dilag/ui/button"
import { Input } from "@dilag/ui/input"
import { Tooltip, TooltipContent, TooltipTrigger } from "@dilag/ui/tooltip"
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@dilag/ui/resizable"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@dilag/ui/alert-dialog"
import { ChatView } from "@/components/blocks/chat/chat-view"
import { PageHeader, PageHeaderLeft, PageHeaderRight } from "@/components/blocks/layout/page-header"
import { DesignCanvas } from "@/components/canvas"
import {
  IconCopy as Copy,
  IconGitBranch as BranchingPathsUp,
  IconPencil as Pen,
  IconPalette as Palette,
  IconPlayerPlay as Play,
  IconDownload as Download,
} from "@tabler/icons-react"
import { IconDots as Ellipsis } from "@tabler/icons-react"
import { DilagIcon } from "@/components/blocks/branding/dilag-icon"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@dilag/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@dilag/ui/dialog"
import { copyFilePath, exportImages } from "@/lib/design-export"
import { PreviewCarousel } from "@/components/blocks/preview/preview-carousel"
import { AttachmentBridgeProvider } from "@/context/attachment-bridge"
import { ScreenCaptureProvider, useScreenCaptureContext } from "@/context/screen-capture-context"
import { toast } from "sonner"
import { bridge } from "@/lib/bridge"
import { findMissingScreenPositions } from "@/lib/screen-layout"
import { getCanonicalGeneratedScreenPath } from "@dilag/desktop-bridge"

export const Route = createFileRoute("/studio/$sessionId")({
  component: StudioRoutePage,
})

function StudioRoutePage() {
  const { sessionId } = useParams({ from: "/studio/$sessionId" })
  return <StudioPageContent sessionId={sessionId} />
}

export function StudioPageContent({
  sessionId,
  projectId,
}: {
  sessionId: string
  projectId?: string
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [renameOpen, setRenameOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<{
    filename: string
    title: string
  } | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [selectedScreenIds, setSelectedScreenIds] = useState<Set<string>>(new Set())

  const chatPanelRef = useRef<ImperativePanelHandle>(null)
  const { size: chatSize, updateSize, minSize } = useChatWidth()

  const { selectSession, sessions, isLoading, isLoadingSessions, forkSessionDesignsOnly } =
    useSessions()
  const { updateSession } = useSessionMutations()

  const currentSession = sessions.find((s: { id: string }) => s.id === sessionId)
  const { data: designs = [], isLoading: isLoadingDesigns } = useSessionDesigns(currentSession?.cwd)
  const isWritingScreen = useIsWritingScreen(currentSession?.id ?? null)

  // Show canvas loading when session/design metadata is hydrating, the AI is actively
  // running, or a write/edit tool is pending. This avoids flashing the "No screens yet"
  // empty state while existing screens are still being loaded from disk.
  const isHydratingCanvas =
    isLoadingSessions || (!!currentSession?.cwd && isLoadingDesigns && designs.length === 0)
  const isCanvasLoading = isHydratingCanvas || isLoading || isWritingScreen

  // Auto-generate PNG assets for designs
  usePngGenerator(designs, currentSession?.cwd, currentSession?.platform)

  // Screen positions from store
  const screenPositions = useScreenPositions(sessionId)
  const setScreenPositions = useSessionStore((s) => s.setScreenPositions)

  // Initialize session on mount
  useEffect(() => {
    selectSession(sessionId)
  }, [sessionId, selectSession])

  // Persist positions for newly discovered designs. Rendering does not depend on this:
  // DesignCanvas reconciles temporary positions while storage/session state hydrates.
  useEffect(() => {
    if (designs.length === 0) return

    const missingPositions = findMissingScreenPositions({
      designs,
      persistedPositions: screenPositions,
      platform: currentSession?.platform ?? "web",
    })

    if (missingPositions.length > 0) {
      setScreenPositions(sessionId, [...screenPositions, ...missingPositions])
    }
  }, [designs, screenPositions, sessionId, setScreenPositions, currentSession?.platform])

  const handlePositionsChange = useCallback(
    (positions: ScreenPosition[]) => {
      setScreenPositions(sessionId, positions)
    },
    [sessionId, setScreenPositions],
  )

  const handleDeleteScreen = useCallback(async () => {
    if (!deleteTarget || !currentSession?.cwd) return

    const design = designs.find((item) => item.filename === deleteTarget.filename)
    const filePath =
      design?.file_path ??
      getCanonicalGeneratedScreenPath(currentSession.cwd, deleteTarget.filename)
    try {
      await bridge.designs.delete({ filePath })
      // Remove from positions
      setScreenPositions(
        sessionId,
        screenPositions.filter((p) => p.id !== deleteTarget.filename),
      )
      // Invalidate query to refresh designs
      queryClient.invalidateQueries({
        queryKey: designKeys.session(currentSession.cwd),
      })
      toast.success(`Deleted ${deleteTarget.title}`)
    } catch (err) {
      toast.error(`Failed to delete: ${err}`)
    }
    setDeleteTarget(null)
  }, [
    deleteTarget,
    currentSession?.cwd,
    sessionId,
    screenPositions,
    setScreenPositions,
    queryClient,
  ])

  const handleForkSession = useCallback(async () => {
    const newSessionId = await forkSessionDesignsOnly()
    if (newSessionId) {
      if (projectId ?? currentSession?.projectId) {
        navigate({
          to: "/project/$projectId/session/$sessionId",
          params: {
            projectId: projectId ?? currentSession?.projectId ?? "",
            sessionId: newSessionId,
          },
        })
      } else {
        navigate({ to: "/studio/$sessionId", params: { sessionId: newSessionId } })
      }
    }
  }, [forkSessionDesignsOnly, navigate, projectId, currentSession?.projectId])

  const handleRequestDelete = useCallback(
    (filename: string) => {
      const design = designs.find((d) => d.filename === filename)
      if (design) {
        setDeleteTarget({ filename, title: design.title })
      }
    },
    [designs],
  )

  const handleRename = useCallback(async () => {
    if (!currentSession || !newName.trim()) return

    if (currentSession.projectId) {
      await bridge.agent.renameSession({
        sessionID: sessionId,
        name: newName.trim(),
        directory: currentSession.cwd,
      })
      queryClient.invalidateQueries({ queryKey: ["sessions", "list"] })
    } else {
      await updateSession({
        id: sessionId,
        updates: { name: newName.trim() },
      })

      await bridge.agent.renameSession({ sessionID: sessionId, name: newName.trim() })
    }

    setRenameOpen(false)
  }, [currentSession, newName, sessionId, updateSession, queryClient])

  // Keyboard shortcuts for selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      // Cmd/Ctrl + A: Select all
      if ((e.metaKey || e.ctrlKey) && e.key === "a" && designs.length > 0) {
        e.preventDefault()
        setSelectedScreenIds(new Set(designs.map((d) => d.filename)))
      }

      // Escape: Clear selection (only when preview is not open)
      if (e.key === "Escape" && !previewOpen) {
        setSelectedScreenIds(new Set())
      }

      // Delete/Backspace: Delete selected (show confirmation)
      if ((e.key === "Delete" || e.key === "Backspace") && selectedScreenIds.size > 0) {
        e.preventDefault()
        // If multiple selected, set deleteTarget to first for now
        // (Could enhance to batch delete later)
        const firstSelectedId = Array.from(selectedScreenIds)[0]
        const design = designs.find((d) => d.filename === firstSelectedId)
        if (design) {
          setDeleteTarget({ filename: design.filename, title: design.title })
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [designs, selectedScreenIds, previewOpen])

  return (
    <AttachmentBridgeProvider>
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
        <PageHeader>
          <PageHeaderLeft>
            <span className="text-sm font-medium truncate max-w-[200px]">
              {currentSession?.name ?? "Untitled chat"}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Session actions"
                  className="flex items-center justify-center size-6 hover:bg-muted rounded"
                >
                  <Ellipsis size={16} className="text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem
                  onClick={() => {
                    setNewName(currentSession?.name ?? "")
                    setRenameOpen(true)
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
                  Copy project path
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    if (currentSession?.id) {
                      navigator.clipboard.writeText(currentSession.id)
                      toast.success("Session ID copied to clipboard")
                    }
                  }}
                  disabled={!currentSession?.id}
                >
                  <Copy size={16} className="mr-2" />
                  Copy chat ID
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </PageHeaderLeft>

          <PageHeaderRight>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-7"
                  onClick={() => setPreviewOpen(true)}
                  disabled={designs.length === 0}
                  aria-label="Preview designs"
                >
                  <Play size={14} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Preview</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-7"
                  onClick={() => {
                    const toExport =
                      selectedScreenIds.size > 0
                        ? designs.filter((d) => selectedScreenIds.has(d.filename))
                        : designs
                    exportImages({
                      designs: toExport,
                      sessionName: currentSession?.name ?? "designs",
                      platform: currentSession?.platform ?? "mobile",
                    })
                  }}
                  disabled={designs.length === 0}
                  aria-label="Export designs"
                >
                  <Download size={14} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Export</TooltipContent>
            </Tooltip>
          </PageHeaderRight>
        </PageHeader>

        {/* Main content */}
        <ResizablePanelGroup
          direction="horizontal"
          className="flex-1 min-h-0 overflow-hidden"
          onLayout={(sizes) => {
            if (sizes[0] > 0) {
              updateSize(sizes[0])
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
            className="overflow-hidden"
          >
            <div className="h-full min-h-0">
              <ChatView />
            </div>
          </ResizablePanel>

          <ResizableHandle />

          {/* Canvas area */}
          <ResizablePanel defaultSize={100 - chatSize} className="bg-muted/20 overflow-hidden">
            {designs.length === 0 ? (
              <CanvasEmptyState isLoading={isCanvasLoading} />
            ) : (
              <ScreenCaptureProvider platform={currentSession?.platform ?? "web"}>
                <ConnectedCanvas
                  designs={designs}
                  platform={currentSession?.platform ?? "web"}
                  positions={screenPositions}
                  sessionCwd={currentSession?.cwd}
                  selectedIds={selectedScreenIds}
                  isLoading={isCanvasLoading}
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
              <DialogTitle>Rename chat</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleRename()
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
  )
}

function CanvasEmptyState({ isLoading }: { isLoading?: boolean }) {
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="relative size-20 rounded-2xl bg-primary/10 mx-auto flex items-center justify-center mb-4">
            <div className="absolute inset-0 rounded-2xl bg-primary/5 animate-pulse" />
            <DilagIcon animated className="size-10 text-primary" />
          </div>
          <h3 className="font-semibold text-lg">Designing your screens...</h3>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Your screens will appear here as they&apos;re created
          </p>
          <div className="flex gap-1.5 justify-center pt-1">
            <span className="size-1.5 rounded-full bg-primary/50 animate-pulse [animation-delay:0ms]" />
            <span className="size-1.5 rounded-full bg-primary/50 animate-pulse [animation-delay:300ms]" />
            <span className="size-1.5 rounded-full bg-primary/50 animate-pulse [animation-delay:600ms]" />
          </div>
        </div>
      </div>
    )
  }

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
  )
}

// Wrapper that connects ScreenCaptureContext to DesignCanvas
interface ConnectedCanvasProps {
  designs: import("@/hooks/use-designs").DesignFile[]
  platform: "mobile" | "web"
  positions: ScreenPosition[]
  sessionCwd?: string
  selectedIds: Set<string>
  isLoading?: boolean
  onPositionsChange: (positions: ScreenPosition[]) => void
  onSelectionChange: (ids: Set<string>) => void
  onDeleteScreen: (filename: string) => void
}

function ConnectedCanvas({
  designs,
  platform,
  positions,
  sessionCwd,
  selectedIds,
  isLoading,
  onPositionsChange,
  onSelectionChange,
  onDeleteScreen,
}: ConnectedCanvasProps) {
  const { captureAndAttach, captureElementAndAttach } = useScreenCaptureContext()

  return (
    <DesignCanvas
      designs={designs}
      platform={platform}
      positions={positions}
      sessionCwd={sessionCwd}
      selectedIds={selectedIds}
      isLoading={isLoading}
      onPositionsChange={onPositionsChange}
      onSelectionChange={onSelectionChange}
      onDeleteScreen={onDeleteScreen}
      onCaptureScreen={captureAndAttach}
      onEditElementWithAI={captureElementAndAttach}
    />
  )
}
