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
} from "@/components/ai-elements/prompt-input"
import { PageHeader } from "@/components/blocks/layout/page-header"
import { AgentSelectorButton } from "@/components/blocks/selectors/agent-selector-button"
import { ModelSelectorButton } from "@/components/blocks/selectors/model-selector-button"
import { ThinkingModeSelector } from "@/components/blocks/selectors/thinking-mode-selector"
import { useNewDesignFlow } from "@/features/new-design/use-new-design-flow"
import { getDefaultProject, useProjectMutations, useProjectsList } from "@/hooks/use-projects"
import { useSessions } from "@/hooks/use-sessions"
import { bridge } from "@/lib/bridge"
import { cn } from "@/lib/utils"
import {
  IconArrowUp as ArrowUp,
  IconCircleX as CloseCircle,
  IconClipboardText as ClipboardText,
  IconDeviceDesktop as Monitor,
  IconDeviceMobile as Smartphone,
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
  const { createSessionInProject, isServerReady } = useSessions()
  const { rememberProject, submitProjectComposer } = useNewDesignFlow({
    projects,
    touchProject,
    createSessionInProject,
  })
  const project = projects.find((item) => item.id === projectId)
  const [targetPlatform, setTargetPlatform] = useState<"web" | "mobile">("web")
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
    <div className="h-full flex flex-col bg-background relative overflow-hidden">
      <PageHeader className="border-b-0" />
      <main className="relative flex-1 flex flex-col overflow-auto">
        <div className="flex-1 flex items-center justify-center px-6 py-16">
          <div className="w-full max-w-2xl">
            <div className="text-center mb-10">
              <h1 className="text-[26px] md:text-[28px] font-normal leading-snug tracking-[-0.01em] text-balance">
                What should we design in {project.name}?
              </h1>
            </div>

            <PlatformToggle value={targetPlatform} onChange={setTargetPlatform} />

            <PromptInputProvider>
              <ComposerInput
                onSubmit={handleSubmit}
                disabled={!isServerReady || isSubmitting}
                projectPath={project.path}
              />
            </PromptInputProvider>
          </div>
        </div>
      </main>
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
  let prefix = text.slice(0, mention.start)
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
        className="rounded-2xl bg-sidebar text-sidebar-foreground transition-colors duration-200 [&_[data-slot=input-group]]:rounded-2xl [&_[data-slot=input-group]]:border-sidebar-border focus-within:[&_[data-slot=input-group]]:border-primary/50"
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

function PlatformToggle({
  value,
  onChange,
}: {
  value: "web" | "mobile"
  onChange: (platform: "web" | "mobile") => void
}) {
  return (
    <div className="flex justify-center mb-6">
      <div className="inline-flex items-center gap-0.5 p-0.5 rounded-md bg-muted/50 border border-border/30">
        <button
          onClick={() => onChange("web")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-[5px] text-xs font-medium transition-all duration-200",
            value === "web"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Monitor size={14} />
          Web
        </button>
        <button
          onClick={() => onChange("mobile")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-[5px] text-xs font-medium transition-all duration-200",
            value === "mobile"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Smartphone size={14} />
          Mobile
        </button>
      </div>
    </div>
  )
}
