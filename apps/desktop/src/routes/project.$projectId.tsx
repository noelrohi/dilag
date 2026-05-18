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
import { cn } from "@/lib/utils"
import {
  IconArrowUp as ArrowUp,
  IconDeviceDesktop as Monitor,
  IconDeviceMobile as Smartphone,
} from "@tabler/icons-react"
import { createFileRoute, Outlet, useMatch, useNavigate, useParams } from "@tanstack/react-router"
import type { FileUIPart } from "ai"
import { useCallback, useEffect, useRef, useState } from "react"

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
              <ComposerInput onSubmit={handleSubmit} disabled={!isServerReady || isSubmitting} />
            </PromptInputProvider>
          </div>
        </div>
      </main>
    </div>
  )
}

function ComposerInput({
  onSubmit,
  disabled,
}: {
  onSubmit: (text: string, files?: FileUIPart[]) => Promise<void>
  disabled: boolean
}) {
  const { textInput } = usePromptInputController()
  const hasInput = textInput.value.trim().length > 0

  return (
    <PromptInput
      onSubmit={({ text, files }) => onSubmit(text, files)}
      className="rounded-2xl bg-sidebar text-sidebar-foreground transition-colors duration-200 [&_[data-slot=input-group]]:rounded-2xl [&_[data-slot=input-group]]:border-sidebar-border focus-within:[&_[data-slot=input-group]]:border-primary/50"
    >
      <PromptInputAttachments>
        {(attachment) => <PromptInputAttachment data={attachment} />}
      </PromptInputAttachments>
      <PromptInputBody>
        <PromptInputTextarea
          placeholder="Describe your app..."
          disabled={disabled}
          className="min-h-[56px] max-h-[200px]"
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
            disabled={!hasInput || disabled}
            className={cn(
              "size-9 rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition-all duration-200 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none",
            )}
          >
            <ArrowUp size={16} className="text-primary-foreground" />
          </PromptInputSubmit>
        </div>
      </PromptInputFooter>
    </PromptInput>
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
