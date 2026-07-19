import {
  PromptInput,
  PromptInputAddAttachmentButton,
  PromptInputAttachment,
  PromptInputAttachments,
  PromptInputBody,
  PromptInputFooter,
  PromptInputProvider,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputController,
} from "@/components/blocks/chat/prompt-input"
import { PageHeader } from "@/components/blocks/layout/page-header"
import { PanelControls } from "@/components/blocks/layout/panel-controls"
import { CanvasEmptyState } from "@/components/canvas/canvas-empty-state"
import { DesignCanvas, type ScreenPosition } from "@/components/canvas"
import { useStudioPanelLayout } from "@/hooks/use-studio-panels"
import { useSessionDesigns } from "@/hooks/use-designs"
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@dilag/ui/resizable"
import { RecentSessions } from "@/components/blocks/layout/recent-sessions"
import { AgentSelectorButton } from "@/components/blocks/selectors/agent-selector-button"
import { ModelSelectorButton } from "@/components/blocks/selectors/model-selector-button"
import { ThinkingModeSelector } from "@/components/blocks/selectors/thinking-mode-selector"
import { useNewDesignFlow } from "@/features/new-design/use-new-design-flow"
import { getDefaultProject, useProjectMutations, useProjectsList } from "@/hooks/use-projects"
import { useSessions } from "@/hooks/use-sessions"
import { bridge } from "@/lib/bridge"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@dilag/ui/dropdown-menu"
import {
  IconArrowUp as ArrowUp,
  IconChevronDown as ChevronDown,
  IconCircleCheck as CheckCircle,
  IconCircleX as CloseCircle,
  IconClipboardText as ClipboardText,
  IconDeviceDesktop as Monitor,
  IconDeviceMobile as Smartphone,
  IconFolder as Folder,
} from "@tabler/icons-react"
import { createFileRoute, Outlet, useMatch, useNavigate, useParams } from "@tanstack/react-router"
import type { FileUIPart } from "ai"
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react"
import { toast } from "sonner"

export const Route = createFileRoute("/project/$projectId")({
  component: ProjectComposerPage,
})

function ProjectComposerPage() {
  const navigate = useNavigate()
  const { projectId } = useParams({ from: "/project/$projectId" })
  const sessionRouteMatch = useMatch({
    from: "/project/$projectId/session/$sessionId",
    shouldThrow: false,
  })
  const { data: projects = [], isLoading: isLoadingProjects } = useProjectsList()
  const { touchProject } = useProjectMutations()
  const { createSessionInProject, isServerReady, sessions } = useSessions()
  const { rememberProject, submitProjectComposer } = useNewDesignFlow({
    projects,
    touchProject,
    createSessionInProject,
  })
  const project = projects.find((item) => item.id === projectId)
  const { data: designs = [], isLoading: isLoadingDesigns } = useSessionDesigns(project?.path)
  const [targetPlatform, setTargetPlatform] = useState<"web" | "mobile">("web")
  const [screenPositions, setScreenPositions] = useState<ScreenPosition[]>([])
  const {
    chatPanelRef,
    canvasPanelRef,
    canvasOpen,
    chatCollapsed,
    setCanvasOpen,
    setChatCollapsed,
    updateSize,
    minSize,
    panelAnimationClass,
    toggleCanvasPanel,
    toggleExpandCanvas,
    chatDefaultSize,
    canvasDefaultSize,
  } = useStudioPanelLayout()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isSubmittingRef = useRef(false)

  useEffect(() => {
    if (project) {
      rememberProject(project.id)
      setTargetPlatform(project.platform)
    }
  }, [project, rememberProject])

  useEffect(() => {
    if (isLoadingProjects || project) return

    localStorage.removeItem("dilag-last-project-id")
    const fallbackProject = getDefaultProject(projects)

    if (fallbackProject) {
      navigate({
        to: "/project/$projectId",
        params: { projectId: fallbackProject.id },
        replace: true,
      })
      return
    }

    navigate({ to: "/", replace: true })
  }, [isLoadingProjects, navigate, project, projects])

  const handleSubmit = useCallback(
    async (text: string, files?: FileUIPart[]) => {
      if (!project || isSubmittingRef.current) return

      isSubmittingRef.current = true
      setIsSubmitting(true)
      try {
        await submitProjectComposer(project, targetPlatform, text, files)
      } finally {
        isSubmittingRef.current = false
        setIsSubmitting(false)
      }
    },
    [project, submitProjectComposer, targetPlatform],
  )

  if (sessionRouteMatch) {
    return <Outlet />
  }

  if (!project) {
    return (
      <div className="h-full flex flex-col bg-background">
        <PageHeader className="border-b-0" />
        <main className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          {isLoadingProjects ? "Opening your workspace…" : "Project not found"}
        </main>
      </div>
    )
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <ResizablePanelGroup
        direction="horizontal"
        className="flex-1 min-h-0 overflow-hidden"
        onLayout={(sizes) => {
          if (canvasOpen && sizes.length > 1 && sizes[0] > 0) {
            updateSize(sizes[0])
          }
        }}
      >
        {/* Composer pane - stands in for the studio's chat pane until a session exists */}
        <ResizablePanel
          id="chat"
          order={1}
          ref={chatPanelRef}
          defaultSize={chatDefaultSize}
          minSize={minSize}
          maxSize={100}
          collapsible
          collapsedSize={0}
          onCollapse={() => setChatCollapsed(true)}
          onExpand={() => setChatCollapsed(false)}
          className={cn("overflow-hidden", panelAnimationClass)}
        >
          {/* Width floor so the collapsing pane clips its content instead of
              squishing it; the fade masks the residual reflow. */}
          <div
            className={cn(
              "flex h-full min-h-0 min-w-96 flex-col transition-opacity ease-out motion-reduce:transition-none",
              chatCollapsed ? "opacity-0 duration-150" : "opacity-100 duration-200 delay-75",
            )}
          >
            <PageHeader className="border-b-0" />
            <main className="relative flex-1 flex flex-col overflow-auto">
              <div className="flex-1 flex items-center justify-center px-6 py-16">
                <div className="w-full max-w-2xl">
                  <div className="text-center mb-10">
                    <h1 className="text-[26px] md:text-[28px] font-normal leading-snug tracking-[-0.01em] text-balance">
                      What should we design in {project.name}?
                    </h1>
                  </div>

                  <ComposerContextTray
                    projectName={project.name}
                    platform={targetPlatform}
                    onPlatformChange={setTargetPlatform}
                  />

                  <div className="relative z-10">
                    <PromptInputProvider>
                      <ComposerInput
                        onSubmit={handleSubmit}
                        disabled={!isServerReady || isSubmitting}
                        projectPath={project.path}
                      />
                    </PromptInputProvider>
                  </div>

                  <RecentSessions sessions={sessions} projectId={project.id} />
                </div>
              </div>
            </main>
          </div>
        </ResizablePanel>

        <ResizableHandle disabled={!canvasOpen} className={canvasOpen ? undefined : "hidden"} />

        <ResizablePanel
          id="canvas"
          order={2}
          ref={canvasPanelRef}
          defaultSize={canvasDefaultSize}
          minSize={50}
          collapsible
          collapsedSize={0}
          onCollapse={() => setCanvasOpen(false)}
          onExpand={() => setCanvasOpen(true)}
          className={cn("overflow-hidden", panelAnimationClass)}
        >
          {canvasOpen && (
            <div className="relative h-full min-h-0 overflow-hidden bg-muted/20">
              <DesignCanvas
                designs={designs}
                platform={targetPlatform}
                positions={screenPositions}
                sessionCwd={project.path}
                readOnlyDesigns
                onPositionsChange={setScreenPositions}
              />
              {designs.length === 0 && (
                <div className="pointer-events-none absolute inset-0 z-10">
                  <CanvasEmptyState isLoading={isLoadingDesigns} />
                </div>
              )}
            </div>
          )}
        </ResizablePanel>
      </ResizablePanelGroup>

      <PanelControls
        chatCollapsed={chatCollapsed}
        canvasOpen={canvasOpen}
        onToggleExpandCanvas={toggleExpandCanvas}
        onToggleCanvas={toggleCanvasPanel}
      />
    </div>
  )
}

type FileMention = { start: number; end: number; query: string }
type MentionedFile = { id: string; path: string; displayName: string }

const FILE_MENTION_SEARCH_LIMIT = 8
const FILE_MENTION_MAX_COUNT = 10
const FILE_MENTION_MAX_SIZE_BYTES = 200 * 1024

function getFileDisplayName(path: string): string {
  return path.split(/[\\/]/).pop() || path
}

function flattenFileNodes(
  nodes: Array<{ id: string; isDir?: boolean; children?: any[] }>,
): string[] {
  const files: string[] = []
  const visit = (node: { id: string; isDir?: boolean; children?: any[] }) => {
    if (node.isDir) return node.children?.forEach(visit)
    files.push(node.id)
  }
  nodes.forEach(visit)
  return files
}

function findActiveFileMention(text: string, caretPosition: number): FileMention | null {
  let start = caretPosition - 1
  while (start >= 0 && !/\s/.test(text[start])) start--
  start += 1
  let end = caretPosition
  while (end < text.length && !/\s/.test(text[end])) end++
  const token = text.slice(start, end)
  if (!token.startsWith("@") || !/^@[\w./-]*$/.test(token)) return null
  return { start, end, query: text.slice(start + 1, caretPosition) }
}

function removeMentionToken(text: string, mention: FileMention) {
  const prefix = text.slice(0, mention.start)
  let suffix = text.slice(mention.end)
  if (/\s$/.test(prefix) && /^\s/.test(suffix)) suffix = suffix.slice(1)
  return { text: `${prefix}${suffix}`, caretPosition: prefix.length }
}

function buildFileDataUrl(content: string, mimeType = "text/plain") {
  return `data:${mimeType};base64,${btoa(unescape(encodeURIComponent(content)))}`
}

function ComposerInput({
  onSubmit,
  disabled,
  projectPath,
}: {
  onSubmit: (text: string, files?: FileUIPart[]) => Promise<void>
  disabled: boolean
  projectPath: string
}) {
  const textareaId = useId()
  const { textInput } = usePromptInputController()
  const [caretPosition, setCaretPosition] = useState(0)
  const [activeMention, setActiveMention] = useState<FileMention | null>(null)
  const [mentionOpen, setMentionOpen] = useState(false)
  const [isSearchingMentions, setIsSearchingMentions] = useState(false)
  const [mentionSearchResults, setMentionSearchResults] = useState<MentionedFile[]>([])
  const [highlightedMentionIndex, setHighlightedMentionIndex] = useState(0)
  const [mentionedFiles, setMentionedFiles] = useState<MentionedFile[]>([])
  const searchRequestRef = useRef(0)
  const hasInput = textInput.value.trim().length > 0
  const hasSubmittableInput = hasInput || mentionedFiles.length > 0

  useEffect(() => {
    const mention = findActiveFileMention(textInput.value, caretPosition)
    setActiveMention(mention)
    setMentionOpen(!!mention)
    if (!mention) setMentionSearchResults([])
  }, [caretPosition, textInput.value])

  useEffect(() => {
    if (!mentionOpen || !activeMention) return
    const requestId = ++searchRequestRef.current
    setIsSearchingMentions(true)
    const timer = window.setTimeout(async () => {
      try {
        const files = flattenFileNodes(await bridge.project.listFiles({ sessionCwd: projectPath }))
        const query = activeMention.query.trim().toLowerCase()
        if (requestId !== searchRequestRef.current) return
        setMentionSearchResults(
          files
            .filter((path) => !query || path.toLowerCase().includes(query))
            .slice(0, FILE_MENTION_SEARCH_LIMIT)
            .map((path) => ({ id: path, path, displayName: getFileDisplayName(path) })),
        )
        setHighlightedMentionIndex(0)
      } catch {
        if (requestId === searchRequestRef.current) setMentionSearchResults([])
      } finally {
        if (requestId === searchRequestRef.current) setIsSearchingMentions(false)
      }
    }, 150)
    return () => window.clearTimeout(timer)
  }, [activeMention, mentionOpen, projectPath])

  const selectMentionResult = useCallback(
    (result: MentionedFile) => {
      if (!activeMention) return
      if (mentionedFiles.some((file) => file.path === result.path))
        toast.info(`"${result.displayName}" is already mentioned`)
      else if (mentionedFiles.length >= FILE_MENTION_MAX_COUNT)
        toast.warning(`You can mention up to ${FILE_MENTION_MAX_COUNT} files per message`)
      else setMentionedFiles((prev) => [...prev, result])
      const next = removeMentionToken(textInput.value, activeMention)
      textInput.setInput(next.text)
      setCaretPosition(next.caretPosition)
      setMentionOpen(false)
      requestAnimationFrame(() => {
        const textarea = document.getElementById(textareaId) as HTMLTextAreaElement | null
        textarea?.focus()
        textarea?.setSelectionRange(next.caretPosition, next.caretPosition)
      })
    },
    [activeMention, mentionedFiles, textInput, textareaId],
  )

  const handleKeyDownCapture = useCallback(
    (event: KeyboardEvent<HTMLFormElement>) => {
      if (!mentionOpen) return
      if (event.key === "Escape") {
        event.preventDefault()
        setMentionOpen(false)
        return
      }
      if (event.key === "ArrowDown") {
        event.preventDefault()
        setHighlightedMentionIndex((prev) =>
          mentionSearchResults.length ? (prev + 1) % mentionSearchResults.length : 0,
        )
        return
      }
      if (event.key === "ArrowUp") {
        event.preventDefault()
        setHighlightedMentionIndex((prev) =>
          mentionSearchResults.length
            ? (prev - 1 + mentionSearchResults.length) % mentionSearchResults.length
            : 0,
        )
        return
      }
      if ((event.key === "Enter" && !event.shiftKey) || event.key === "Tab") {
        event.preventDefault()
        const selected =
          mentionSearchResults[Math.min(highlightedMentionIndex, mentionSearchResults.length - 1)]
        if (selected) selectMentionResult(selected)
      }
    },
    [highlightedMentionIndex, mentionOpen, mentionSearchResults, selectMentionResult],
  )

  const handleSubmit = async (text: string, files?: FileUIPart[]) => {
    const resolvedFiles: FileUIPart[] = [...(files ?? [])]
    for (const file of mentionedFiles) {
      const content = await bridge.project.readFile({
        sessionCwd: projectPath,
        filePath: file.path,
      })
      if (new TextEncoder().encode(content).length > FILE_MENTION_MAX_SIZE_BYTES) {
        toast.warning(`Skipped ${file.displayName}; file is over 200KB`)
        continue
      }
      resolvedFiles.push({
        type: "file",
        filename: file.path,
        mediaType: "text/plain",
        url: buildFileDataUrl(content),
      })
    }
    await onSubmit(text, resolvedFiles.length ? resolvedFiles : undefined)
    setMentionedFiles([])
  }

  return (
    <div className="relative">
      {mentionOpen && (
        <div className="absolute inset-x-0 bottom-full z-20 mb-3 overflow-hidden rounded-[1.35rem] border border-sidebar-border/90 bg-sidebar/95 p-2 shadow-2xl shadow-black/20 backdrop-blur-xl animate-slide-up">
          <div className="px-3 pb-1 pt-1 text-sm text-muted-foreground">Files</div>
          <div className="max-h-64 overflow-y-auto">
            {isSearchingMentions ? (
              <div className="px-3 py-3 text-sm text-muted-foreground">Searching files…</div>
            ) : mentionSearchResults.length === 0 ? (
              <div className="px-3 py-3 text-sm text-muted-foreground">No files found</div>
            ) : (
              mentionSearchResults.map((result, index) => (
                <button
                  key={result.path}
                  type="button"
                  className={cn(
                    "group flex min-h-10 w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-sidebar-accent/80",
                    index === highlightedMentionIndex && "bg-sidebar-accent",
                  )}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectMentionResult(result)}
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <ClipboardText size={15} />
                  </span>
                  <span className="flex min-w-0 items-baseline gap-2">
                    <span className="shrink-0 text-sm font-medium text-sidebar-foreground">
                      {result.displayName}
                    </span>
                    <span className="truncate text-sm text-muted-foreground">{result.path}</span>
                  </span>
                </button>
              ))
            )}
          </div>
          <div className="border-t border-sidebar-border/50 px-3 pb-2 pt-3 text-sm text-muted-foreground">
            Type to search for files
          </div>
        </div>
      )}
      <PromptInput
        onSubmit={({ text, files }) => handleSubmit(text, files)}
        onKeyDownCapture={handleKeyDownCapture}
      >
        <PromptInputAttachments>
          {(attachment) => <PromptInputAttachment data={attachment} />}
        </PromptInputAttachments>
        {mentionedFiles.length > 0 && (
          <div className="flex w-full flex-wrap items-start justify-start gap-1.5 px-3 pt-2">
            {mentionedFiles.map((file) => (
              <div
                key={file.id}
                className="group inline-flex h-6 items-center gap-1 rounded-[5px] bg-foreground/[0.05] pl-1.5 pr-1 ring-1 ring-inset ring-foreground/[0.08]"
              >
                <ClipboardText size={10} className="text-foreground/45" />
                <span className="max-w-[220px] truncate text-[12px] font-medium text-foreground/70">
                  {file.path}
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${file.displayName}`}
                  className="ml-0.5 flex size-4 items-center justify-center rounded opacity-0 transition-opacity group-hover:opacity-100 hover:bg-foreground/10"
                  onClick={() =>
                    setMentionedFiles((prev) => prev.filter((item) => item.id !== file.id))
                  }
                >
                  <CloseCircle size={10} className="text-foreground/50" />
                </button>
              </div>
            ))}
          </div>
        )}
        <PromptInputBody>
          <PromptInputTextarea
            id={textareaId}
            placeholder="Describe your app..."
            disabled={disabled}
            className="min-h-[56px] max-h-[200px]"
            onChange={(event) =>
              setCaretPosition(
                event.currentTarget.selectionStart ?? event.currentTarget.value.length,
              )
            }
            onClick={(event) =>
              setCaretPosition(
                event.currentTarget.selectionStart ?? event.currentTarget.value.length,
              )
            }
            onKeyUp={(event) =>
              setCaretPosition(
                event.currentTarget.selectionStart ?? event.currentTarget.value.length,
              )
            }
            onSelect={(event) =>
              setCaretPosition((event.currentTarget as HTMLTextAreaElement).selectionStart ?? 0)
            }
          />
        </PromptInputBody>
        <PromptInputFooter className="border-t-0">
          <PromptInputTools>
            <AgentSelectorButton />
            <ModelSelectorButton />
            <ThinkingModeSelector />
          </PromptInputTools>
          <div className="flex-1" />
          <div className="flex items-center gap-1">
            <PromptInputAddAttachmentButton />
            <PromptInputSubmit
              disabled={!hasSubmittableInput || disabled}
              className={cn(
                "size-9 rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition-all duration-200 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none",
              )}
            >
              <ArrowUp size={16} className="text-primary-foreground" />
            </PromptInputSubmit>
          </div>
        </PromptInputFooter>
      </PromptInput>
    </div>
  )
}

const PLATFORM_OPTIONS = [
  { value: "web", label: "Web", icon: Monitor },
  { value: "mobile", label: "Mobile", icon: Smartphone },
] as const

function ComposerContextTray({
  projectName,
  platform,
  onPlatformChange,
}: {
  projectName: string
  platform: "web" | "mobile"
  onPlatformChange: (platform: "web" | "mobile") => void
}) {
  const active = PLATFORM_OPTIONS.find((option) => option.value === platform) ?? PLATFORM_OPTIONS[0]
  const ActiveIcon = active.icon
  return (
    // Tray fuses behind the composer: its bottom padding hides under the
    // composer card, which sits above it via the z-10 wrapper. mx-4 insets it
    // to where the composer's rounded-2xl top corners end on both sides.
    <div className="relative mx-4 rounded-t-2xl bg-muted/30 shadow-lg shadow-black/20 px-2 pt-1.5 pb-6 -mb-4">
      <div className="flex items-center gap-1">
        <span className="inline-flex h-8 min-w-0 items-center gap-2 rounded-lg px-2.5 text-sm text-muted-foreground">
          <Folder size={16} className="shrink-0 opacity-70" />
          <span className="max-w-56 truncate">{projectName}</span>
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="inline-flex h-8 shrink-0 items-center gap-2 rounded-lg px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground">
              <ActiveIcon size={16} className="opacity-70" />
              {active.label}
              <ChevronDown size={13} className="opacity-50" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {PLATFORM_OPTIONS.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={() => onPlatformChange(option.value)}
                className="gap-2"
              >
                <option.icon size={15} />
                <span className="flex-1">{option.label} app</span>
                {platform === option.value && <CheckCircle size={15} className="text-primary" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
