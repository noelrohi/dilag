import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router"
import { useEffect, useState, useCallback, useRef } from "react"
import type { ImperativePanelHandle } from "react-resizable-panels"
import { useQueryClient } from "@tanstack/react-query"
import { useSessions } from "@/hooks/use-sessions"
import { useSessionMutations } from "@/hooks/use-session-data"
import { useSessionDesigns, designKeys, type DesignFile } from "@/hooks/use-designs"
import { usePngGenerator } from "@/hooks/use-png-generator"
import { useChatWidth } from "@/hooks/use-chat-width"
import {
  useScreenPositions,
  useSessionStore,
  useIsWritingScreen,
  useSessionStatus,
  usePromptQueue,
  type ScreenPosition,
} from "@/context/session-store"
import { Button } from "@dilag/ui/button"
import { ButtonGroup } from "@dilag/ui/button-group"
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
  IconDownload as Download,
  IconFolder as Folder,
  IconChevronDown as AltArrowDown,
  IconCode as Code,
  IconPhoto as Gallery,
  IconLayoutSidebarRight as SidebarRight,
  IconArrowsDiagonal as ArrowsExpand,
  IconArrowsDiagonalMinimize2 as ArrowsCollapse,
} from "@tabler/icons-react"
import { IconDots as Ellipsis } from "@tabler/icons-react"
import { DilagIcon } from "@/components/blocks/branding/dilag-icon"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@dilag/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@dilag/ui/dialog"
import {
  copyFilePath,
  exportHtmlDesigns,
  exportImages,
  exportImagesAndHtml,
} from "@/lib/design-export"
import { AttachmentBridgeProvider } from "@/context/attachment-bridge"
import { useMenuEvents } from "@/context/menu-events"
import { ScreenCaptureProvider, useScreenCaptureContext } from "@/context/screen-capture-context"
import { toast } from "sonner"
import { bridge } from "@/lib/bridge"
import { cn } from "@/lib/utils"
import { findMissingScreenPositions } from "@/lib/screen-layout"
import { isEditableShortcutTarget } from "@/lib/shortcut-target"
import { getCanonicalGeneratedScreenPath } from "@dilag/desktop-bridge"

export const Route = createFileRoute("/studio/$sessionId")({
  component: StudioRoutePage,
})

interface DeleteTarget {
  filename: string
  title: string
}

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
  const [deleteTargets, setDeleteTargets] = useState<DeleteTarget[]>([])
  const [canvasOpen, setCanvasOpen] = useState(true)
  const [chatCollapsed, setChatCollapsed] = useState(false)
  const [selectedScreenIds, setSelectedScreenIds] = useState<Set<string>>(new Set())

  const chatPanelRef = useRef<ImperativePanelHandle>(null)
  const canvasPanelRef = useRef<ImperativePanelHandle>(null)
  const { size: chatSize, updateSize, minSize } = useChatWidth()
  const { registerChatToggle } = useMenuEvents()

  const { selectSession, sessions, isLoading, isLoadingSessions, forkSessionDesignsOnly } =
    useSessions()
  const { updateSession } = useSessionMutations()

  const currentSession = sessions.find((s: { id: string }) => s.id === sessionId)
  const { data: designs = [], isLoading: isLoadingDesigns } = useSessionDesigns(currentSession?.cwd)
  const isWritingScreen = useIsWritingScreen(currentSession?.id ?? null)

  // Busy gating for manual screen edits: block Edit/Rename/Duplicate while Pi is
  // actively streaming or has queued steering/follow-up prompts (design doc §1).
  const sessionStatus = useSessionStatus(sessionId)
  const promptQueue = usePromptQueue(sessionId)
  const isSessionBusy =
    sessionStatus === "running" ||
    sessionStatus === "busy" ||
    promptQueue.steering.length > 0 ||
    promptQueue.followUp.length > 0

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

  // Animate panel sizes only for button/menu toggles, never while dragging the
  // handle — a transition during drag would make resizing feel laggy.
  const [isPanelAnimating, setIsPanelAnimating] = useState(false)
  const panelAnimationTimeout = useRef<number | null>(null)

  const animatePanels = useCallback(() => {
    setIsPanelAnimating(true)
    if (panelAnimationTimeout.current) {
      window.clearTimeout(panelAnimationTimeout.current)
    }
    panelAnimationTimeout.current = window.setTimeout(() => setIsPanelAnimating(false), 300)
  }, [])

  useEffect(
    () => () => {
      if (panelAnimationTimeout.current) {
        window.clearTimeout(panelAnimationTimeout.current)
      }
    },
    [],
  )

  const panelAnimationClass = isPanelAnimating
    ? "transition-[flex-grow] duration-[250ms] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
    : undefined

  const toggleChatPanel = useCallback(() => {
    const panel = chatPanelRef.current
    if (!panel) return

    animatePanels()

    if (panel.isCollapsed()) {
      panel.expand(minSize)
      requestAnimationFrame(() => panel.resize(Math.max(chatSize, minSize)))
      return
    }

    // Collapsing the chat while the canvas is hidden would leave an empty window.
    if (!canvasOpen) return

    const currentSize = panel.getSize()
    if (currentSize > 0) {
      updateSize(currentSize)
    }
    panel.collapse()
  }, [chatSize, minSize, updateSize, canvasOpen, animatePanels])

  const toggleCanvasPanel = useCallback(() => {
    const canvasPanel = canvasPanelRef.current
    if (!canvasPanel) return

    animatePanels()

    if (canvasOpen) {
      const chatPanel = chatPanelRef.current
      if (chatPanel?.isCollapsed()) {
        chatPanel.expand(minSize)
      }
      canvasPanel.collapse()
      return
    }

    const nextChatSize = Math.min(Math.max(chatSize, minSize), 50)
    canvasPanel.expand(100 - nextChatSize)
    requestAnimationFrame(() => canvasPanel.resize(100 - nextChatSize))
  }, [canvasOpen, chatSize, minSize, animatePanels])

  // Expand the canvas to full width (collapsing the chat), or restore the chat.
  const toggleExpandCanvas = useCallback(() => {
    const chatPanel = chatPanelRef.current
    const canvasPanel = canvasPanelRef.current
    if (!chatPanel || !canvasPanel) return

    animatePanels()

    if (chatPanel.isCollapsed()) {
      chatPanel.expand(minSize)
      requestAnimationFrame(() => chatPanel.resize(Math.max(Math.min(chatSize, 50), minSize)))
      return
    }

    const currentSize = chatPanel.getSize()
    if (currentSize > 0) {
      updateSize(currentSize)
    }
    if (canvasPanel.isCollapsed()) {
      canvasPanel.expand()
    }
    chatPanel.collapse()
  }, [chatSize, minSize, updateSize, animatePanels])

  useEffect(() => registerChatToggle(toggleChatPanel), [registerChatToggle, toggleChatPanel])

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

  const handleDeleteScreens = useCallback(async () => {
    if (deleteTargets.length === 0 || !currentSession?.cwd) return

    const targetsWithPaths = deleteTargets.map((target) => {
      const design = designs.find((item) => item.filename === target.filename)
      return {
        ...target,
        filePath:
          design?.file_path ?? getCanonicalGeneratedScreenPath(currentSession.cwd, target.filename),
      }
    })

    const results = await Promise.allSettled(
      targetsWithPaths.map(async (target) => {
        await bridge.designs.delete({ filePath: target.filePath })
        return target
      }),
    )
    const deletedTargets = results.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : [],
    )
    const failedCount = results.length - deletedTargets.length

    if (deletedTargets.length > 0) {
      const deletedIds = new Set(deletedTargets.map((target) => target.filename))
      setScreenPositions(
        sessionId,
        screenPositions.filter((p) => !deletedIds.has(p.id)),
      )
      setSelectedScreenIds((previous) => {
        const next = new Set(previous)
        deletedIds.forEach((id) => next.delete(id))
        return next
      })
      queryClient.invalidateQueries({
        queryKey: designKeys.session(currentSession.cwd),
      })
      toast.success(
        deletedTargets.length === 1
          ? `Deleted ${deletedTargets[0].title}`
          : `Deleted ${deletedTargets.length} screens`,
      )
    }

    if (failedCount > 0) {
      toast.error(
        failedCount === 1 ? "Failed to delete 1 screen" : `Failed to delete ${failedCount} screens`,
      )
    }

    setDeleteTargets([])
  }, [
    deleteTargets,
    currentSession?.cwd,
    designs,
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
        setDeleteTargets([{ filename, title: design.title }])
      }
    },
    [designs],
  )

  const handleRenameScreen = useCallback(
    async (from: string, to: string) => {
      if (!currentSession?.cwd) return

      const result = await bridge.designs.rename({ sessionCwd: currentSession.cwd, from, to })
      if (!result.ok) {
        toast.error(result.reason)
        return
      }

      setScreenPositions(
        sessionId,
        screenPositions.map((p) => (p.id === from ? { ...p, id: result.filename } : p)),
      )
      setSelectedScreenIds((previous) => {
        if (!previous.has(from)) return previous
        const next = new Set(previous)
        next.delete(from)
        next.add(result.filename)
        return next
      })

      queryClient.invalidateQueries({ queryKey: designKeys.session(currentSession.cwd) })
      useSessionStore.getState().bumpDesignRefresh()
      toast.success(`Renamed to ${result.filename}`)
    },
    [currentSession?.cwd, sessionId, screenPositions, setScreenPositions, queryClient],
  )

  const handleDuplicateScreen = useCallback(
    async (filename: string) => {
      if (!currentSession?.cwd) return

      const result = await bridge.designs.duplicate({ sessionCwd: currentSession.cwd, filename })
      if (!result.ok) {
        toast.error(result.reason)
        return
      }

      queryClient.invalidateQueries({ queryKey: designKeys.session(currentSession.cwd) })
      useSessionStore.getState().bumpDesignRefresh()
      toast.success(`Duplicated as ${result.filename}`)
    },
    [currentSession?.cwd, queryClient],
  )

  const handleDesignsMutated = useCallback(() => {
    if (!currentSession?.cwd) return
    queryClient.invalidateQueries({ queryKey: designKeys.session(currentSession.cwd) })
    useSessionStore.getState().bumpDesignRefresh()
  }, [currentSession?.cwd, queryClient])

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

  const handleExportDesigns = useCallback(
    (format: "html" | "png" | "pngAndHtml") => {
      const toExport =
        selectedScreenIds.size > 0
          ? designs.filter((d) => selectedScreenIds.has(d.filename))
          : designs
      const options = {
        designs: toExport,
        sessionName: currentSession?.name ?? "designs",
        platform: currentSession?.platform ?? "mobile",
      } as const

      if (format === "html") {
        void exportHtmlDesigns(options)
      } else if (format === "png") {
        void exportImages(options)
      } else {
        void exportImagesAndHtml(options)
      }
    },
    [currentSession?.name, currentSession?.platform, designs, selectedScreenIds],
  )

  // Keyboard shortcuts for selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger canvas shortcuts when typing, composing, or when a focused
      // widget/dialog has already claimed the shortcut.
      if (e.defaultPrevented || e.isComposing || isEditableShortcutTarget(e.target)) {
        return
      }

      // Cmd/Ctrl + A: Select all
      if ((e.metaKey || e.ctrlKey) && e.key === "a" && designs.length > 0) {
        e.preventDefault()
        setSelectedScreenIds(new Set(designs.map((d) => d.filename)))
      }

      // Escape: Clear selection
      if (e.key === "Escape") {
        setSelectedScreenIds(new Set())
      }

      // Cmd/Ctrl + Delete/Backspace: Delete selected screens.
      if (
        (e.metaKey || e.ctrlKey) &&
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedScreenIds.size > 0
      ) {
        e.preventDefault()
        const selectedDesigns = designs.filter((d) => selectedScreenIds.has(d.filename))
        if (selectedDesigns.length > 0) {
          setDeleteTargets(
            selectedDesigns.map((design) => ({
              filename: design.filename,
              title: design.title,
            })),
          )
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [designs, selectedScreenIds])

  return (
    <AttachmentBridgeProvider>
      <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-background">
        {/* Main content */}
        <ResizablePanelGroup
          direction="horizontal"
          className="flex-1 min-h-0 overflow-hidden"
          onLayout={(sizes) => {
            if (canvasOpen && sizes.length > 1 && sizes[0] > 0) {
              updateSize(sizes[0])
            }
          }}
        >
          {/* Chat pane - collapsible and resizable, owns the page header */}
          <ResizablePanel
            id="chat"
            order={1}
            ref={chatPanelRef}
            defaultSize={Math.min(chatSize, 50)}
            minSize={minSize}
            maxSize={100}
            collapsible
            collapsedSize={0}
            onCollapse={() => setChatCollapsed(true)}
            onExpand={() => setChatCollapsed(false)}
            className={cn("overflow-hidden", panelAnimationClass)}
          >
            <div className="flex h-full min-h-0 flex-col">
              <PageHeader>
                <PageHeaderLeft>
                  <Folder size={14} className="shrink-0 text-muted-foreground" />
                  <span className="text-sm font-medium truncate max-w-[200px]">
                    {currentSession?.name ?? "Untitled chat"}
                  </span>
                  <DropdownMenu>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label="Chat actions"
                            className="flex items-center justify-center size-6 hover:bg-muted rounded"
                          >
                            <Ellipsis size={16} className="text-muted-foreground" />
                          </button>
                        </DropdownMenuTrigger>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">Chat actions</TooltipContent>
                    </Tooltip>
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

                {/* Reserve space for the pinned panel controls when the chat is full width. */}
                <PageHeaderRight className={cn(!canvasOpen && "pr-16")}>
                  <ButtonGroup>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      className="size-7"
                      onClick={() => handleExportDesigns("html")}
                      disabled={designs.length === 0}
                      aria-label="Export HTML"
                    >
                      <Download size={14} />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon-sm"
                          className="size-7 px-0"
                          disabled={designs.length === 0}
                          aria-label="Export options"
                        >
                          <AltArrowDown size={14} className="text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-max">
                        <DropdownMenuGroup>
                          <DropdownMenuItem
                            className="whitespace-nowrap"
                            onClick={() => handleExportDesigns("png")}
                          >
                            <Gallery size={16} />
                            Export PNG
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="whitespace-nowrap"
                            onClick={() => handleExportDesigns("pngAndHtml")}
                          >
                            <Code size={16} />
                            Export PNG + HTML
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </ButtonGroup>
                </PageHeaderRight>
              </PageHeader>

              <div className="flex-1 min-h-0">
                <ChatView />
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle disabled={!canvasOpen} className={canvasOpen ? undefined : "hidden"} />

          {/* Keep the panel registered while collapsed. Dynamically adding it back causes
              react-resizable-panels to briefly resize against a stale one-panel layout. */}
          <ResizablePanel
            id="canvas"
            order={2}
            ref={canvasPanelRef}
            defaultSize={100 - Math.min(chatSize, 50)}
            minSize={50}
            collapsible
            collapsedSize={0}
            onCollapse={() => setCanvasOpen(false)}
            onExpand={() => setCanvasOpen(true)}
            className={cn("overflow-hidden", panelAnimationClass)}
          >
            {canvasOpen && (
              <div className="h-full min-h-0">
                <div className="h-full min-h-0 overflow-hidden bg-muted/20">
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
                        readOnlyDesigns={isSessionBusy}
                        onPositionsChange={handlePositionsChange}
                        onSelectionChange={setSelectedScreenIds}
                        onDeleteScreen={handleRequestDelete}
                        onRenameScreen={handleRenameScreen}
                        onDuplicateScreen={handleDuplicateScreen}
                        onDesignsMutated={handleDesignsMutated}
                      />
                    </ScreenCaptureProvider>
                  )}
                </div>
              </div>
            )}
          </ResizablePanel>
        </ResizablePanelGroup>

        {/* Panel controls - pinned to the app's top-right corner */}
        <div className="absolute top-0 right-3 z-40 flex h-[44px] items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className={cn(
                  "size-7 text-muted-foreground hover:text-foreground",
                  chatCollapsed && "bg-muted text-foreground",
                )}
                onClick={toggleExpandCanvas}
                aria-label={chatCollapsed ? "Restore chat" : "Expand canvas"}
                aria-pressed={chatCollapsed}
              >
                {chatCollapsed ? <ArrowsCollapse size={14} /> : <ArrowsExpand size={14} />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {chatCollapsed ? "Restore chat" : "Expand canvas"}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className={cn(
                  "size-7 text-muted-foreground hover:text-foreground",
                  canvasOpen && "bg-muted text-foreground",
                )}
                onClick={toggleCanvasPanel}
                aria-label={canvasOpen ? "Hide canvas" : "Show canvas"}
                aria-pressed={canvasOpen}
              >
                <SidebarRight size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {canvasOpen ? "Hide canvas" : "Show canvas"}
            </TooltipContent>
          </Tooltip>
        </div>

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
        <AlertDialog
          open={deleteTargets.length > 0}
          onOpenChange={(open) => {
            if (!open) setDeleteTargets([])
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {deleteTargets.length === 1 ? "Delete screen?" : "Delete screens?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {deleteTargets.length === 1
                  ? `Are you sure you want to delete "${deleteTargets[0]?.title}"? This action cannot be undone.`
                  : `Are you sure you want to delete ${deleteTargets.length} screens? This action cannot be undone.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteScreens}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteTargets.length === 1 ? "Delete" : `Delete ${deleteTargets.length}`}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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
  designs: DesignFile[]
  platform: "mobile" | "web"
  positions: ScreenPosition[]
  sessionCwd?: string
  selectedIds: Set<string>
  isLoading?: boolean
  readOnlyDesigns?: boolean
  onPositionsChange: (positions: ScreenPosition[]) => void
  onSelectionChange: (ids: Set<string>) => void
  onDeleteScreen: (filename: string) => void
  onRenameScreen?: (from: string, to: string) => void
  onDuplicateScreen?: (filename: string) => void
  onDesignsMutated?: () => void
}

function ConnectedCanvas({
  designs,
  platform,
  positions,
  sessionCwd,
  selectedIds,
  isLoading,
  readOnlyDesigns,
  onPositionsChange,
  onSelectionChange,
  onDeleteScreen,
  onRenameScreen,
  onDuplicateScreen,
  onDesignsMutated,
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
      readOnlyDesigns={readOnlyDesigns}
      onPositionsChange={onPositionsChange}
      onSelectionChange={onSelectionChange}
      onDeleteScreen={onDeleteScreen}
      onCaptureScreen={captureAndAttach}
      onEditElementWithAI={captureElementAndAttach}
      onRenameScreen={onRenameScreen}
      onDuplicateScreen={onDuplicateScreen}
      onDesignsMutated={onDesignsMutated}
    />
  )
}
