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
import { useProjectMutations, useProjectsList } from "@/hooks/use-projects"
import { useSessions } from "@/hooks/use-sessions"
import { cn } from "@/lib/utils"
import { ArrowUp, Monitor, Smartphone } from "@solar-icons/react"
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router"
import type { FileUIPart } from "ai"

export const Route = createFileRoute("/project/$projectId")({
  component: ProjectComposerPage,
})

function ProjectComposerPage() {
  const { projectId } = useParams({ from: "/project/$projectId" })
  const navigate = useNavigate()
  const { data: projects = [] } = useProjectsList()
  const { updateProject, touchProject } = useProjectMutations()
  const { createSessionInProject, isServerReady } = useSessions()
  const project = projects.find((item) => item.id === projectId)

  const handleSubmit = async (text: string, files?: FileUIPart[]) => {
    if (!project || (!text.trim() && (!files || files.length === 0))) return
    localStorage.setItem("dilag-initial-prompt", text)
    localStorage.setItem("dilag-initial-platform", project.platform)
    if (files && files.length > 0) {
      localStorage.setItem("dilag-initial-files", JSON.stringify(files))
    } else {
      localStorage.removeItem("dilag-initial-files")
    }

    await touchProject(project.id)
    const sessionId = await createSessionInProject(project)
    if (sessionId) {
      navigate({
        to: "/project/$projectId/session/$sessionId",
        params: { projectId: project.id, sessionId },
      })
    }
  }

  if (!project) {
    return (
      <div className="h-full flex flex-col bg-background">
        <PageHeader />
        <main className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          Project not found
        </main>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-background relative overflow-hidden">
      <PageHeader />
      <main className="relative flex-1 flex flex-col overflow-auto">
        <div className="flex-1 flex items-center justify-center px-6 py-16">
          <div className="w-full max-w-2xl">
            <div className="text-center mb-10">
              <h1 className="text-[34px] md:text-[40px] font-medium leading-[1.1] tracking-[-0.03em] text-balance">
                What should we design in {project.name}?
              </h1>
            </div>

            <PlatformToggle
              value={project.platform}
              onChange={(platform) => updateProject({ id: project.id, updates: { platform } })}
            />

            <PromptInputProvider>
              <ComposerInput onSubmit={handleSubmit} disabled={!isServerReady} />
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
  onSubmit: (text: string, files?: FileUIPart[]) => void
  disabled: boolean
}) {
  const { textInput } = usePromptInputController()
  const hasInput = textInput.value.trim().length > 0

  return (
    <PromptInput
      onSubmit={async ({ text, files }) => onSubmit(text, files)}
      className="border border-border bg-card transition-colors duration-200 focus-within:border-primary/50"
    >
      <PromptInputAttachments>
        {(attachment) => <PromptInputAttachment data={attachment} />}
      </PromptInputAttachments>
      <PromptInputBody>
        <PromptInputTextarea
          placeholder="Describe your app..."
          disabled={disabled}
          className="min-h-[100px] max-h-[200px]"
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
              "size-9 rounded-xl transition-all duration-200",
              hasInput && !disabled
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                : "bg-muted text-muted-foreground",
            )}
          >
            <ArrowUp size={16} />
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
      <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-muted/50 border border-border/30">
        <button
          onClick={() => onChange("web")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200",
            value === "web"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Monitor size={16} />
          Web
        </button>
        <button
          onClick={() => onChange("mobile")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200",
            value === "mobile"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Smartphone size={16} />
          Mobile
        </button>
      </div>
    </div>
  )
}
