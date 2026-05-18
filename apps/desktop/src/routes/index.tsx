import { PageHeader } from "@/components/blocks/layout/page-header"
import {
  getDefaultProject,
  useLegacySessionsNotice,
  useProjectMutations,
  useProjectsList,
} from "@/hooks/use-projects"
import { DilagIcon } from "@/components/blocks/branding/dilag-icon"
import { bridge } from "@/lib/bridge"
import { IconCirclePlus as AddCircle, IconSquarePlus as AddSquare, IconHistory as History } from "@tabler/icons-react"
import { Button } from "@dilag/ui/button"
import { Input } from "@dilag/ui/input"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"

export const Route = createFileRoute("/")({
  component: HomePage,
})

function HomePage() {
  const navigate = useNavigate()
  const [projectName, setProjectName] = useState("")
  const { data: projects = [], isLoading: isLoadingProjects } = useProjectsList()
  const { createProject, addExistingProject, dismissLegacyNotice } = useProjectMutations()
  const { data: legacyNotice } = useLegacySessionsNotice(projects.length === 0)

  useEffect(() => {
    if (isLoadingProjects) return

    const cachedProjectId = localStorage.getItem("dilag-last-project-id")
    const cachedProject = cachedProjectId
      ? projects.find((project) => project.id === cachedProjectId)
      : undefined
    const project = cachedProject ?? getDefaultProject(projects)

    if (project) {
      localStorage.setItem("dilag-last-project-id", project.id)
      navigate({ to: "/project/$projectId", params: { projectId: project.id }, replace: true })
      return
    }

    if (cachedProjectId) {
      localStorage.removeItem("dilag-last-project-id")
    }
  }, [isLoadingProjects, navigate, projects])

  const handleStartFromScratch = async () => {
    const name = projectName.trim()
    if (!name) return
    const project = await createProject({ name })
    navigate({ to: "/project/$projectId", params: { projectId: project.id } })
  }

  const handleUseExistingFolder = async () => {
    const folder = await bridge.dialog.openDirectory()
    if (!folder) return
    const project = await addExistingProject({ path: folder })
    navigate({ to: "/project/$projectId", params: { projectId: project.id } })
  }

  if (isLoadingProjects) {
    return <HomeLoadingState />
  }

  return (
    <div className="h-full flex flex-col bg-background relative overflow-hidden">
      <PageHeader className="border-b-0" />
      <main className="flex-1 overflow-auto px-8 py-10">
        <div className="mx-auto flex min-h-full w-full max-w-5xl items-center">
          <div className="grid w-full gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <section className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/30 px-3 py-1 text-xs text-muted-foreground">
                <span className="size-1.5 rounded-full bg-primary" />
                Projects are local folders
              </div>
              <div className="space-y-3">
                <h1 className="max-w-md text-[44px] font-medium leading-[0.98] tracking-[-0.045em]">
                  Choose where your designs live.
                </h1>
                <p className="max-w-sm text-sm leading-6 text-muted-foreground">
                  Create a fresh workspace or open an existing folder. Chats are grouped under the
                  Project, and generated screens are saved as
                  <code className="mx-1 rounded-md border border-border/60 bg-muted/50 px-1.5 py-0.5 text-xs">
                    .designs/*.html
                  </code>
                  .
                </p>
              </div>
            </section>

            <section className="space-y-3">
              <div className="rounded-3xl border border-border/70 bg-card/70 p-2 shadow-2xl shadow-black/20 backdrop-blur">
                <div className="grid gap-2 md:grid-cols-2">
                  <form
                    onSubmit={(event) => {
                      event.preventDefault()
                      handleStartFromScratch()
                    }}
                    className="flex min-h-[220px] flex-col rounded-2xl border border-border/70 bg-background/70 p-5"
                  >
                    <div className="mb-5 flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                      <AddCircle size={18} />
                    </div>
                    <div className="space-y-1.5">
                      <h2 className="text-base font-medium">Start from scratch</h2>
                      <p className="text-sm leading-5 text-muted-foreground">
                        Creates a new folder under
                        <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs">~/dilag</code>
                        and opens an empty composer.
                      </p>
                    </div>
                    <div className="mt-auto space-y-2 pt-5">
                      <Input
                        value={projectName}
                        onChange={(event) => setProjectName(event.target.value)}
                        placeholder="Project name"
                        className="h-9"
                      />
                      <Button type="submit" className="w-full" disabled={!projectName.trim()}>
                        Create project
                      </Button>
                    </div>
                  </form>

                  <button
                    onClick={handleUseExistingFolder}
                    className="group flex min-h-[220px] flex-col rounded-2xl border border-border/70 bg-muted/20 p-5 text-left transition-colors hover:bg-muted/35"
                  >
                    <div className="mb-5 flex size-10 items-center justify-center rounded-xl border border-border bg-background transition-transform group-hover:-translate-y-0.5">
                      <AddSquare size={18} />
                    </div>
                    <div className="space-y-1.5">
                      <h2 className="text-base font-medium">Use an existing folder</h2>
                      <p className="text-sm leading-5 text-muted-foreground">
                        Pick any local folder and Dilag will list Pi chats for that Project.
                      </p>
                    </div>
                    <div className="mt-auto pt-5 text-sm font-medium text-foreground">
                      Open folder →
                    </div>
                  </button>
                </div>
              </div>

              {legacyNotice?.hasLegacySessions && !legacyNotice.dismissed && (
                <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                  <div className="flex gap-3">
                    <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-background">
                      <History size={16} />
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div>
                        <h2 className="text-sm font-medium">Old sessions found</h2>
                        <p className="mt-1 text-sm leading-5 text-muted-foreground">
                          Your previous Dilag sessions are still on this device. Add any session
                          folder as a Project to keep working with it.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="secondary" onClick={handleUseExistingFolder}>
                          Use an existing folder
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => dismissLegacyNotice()}>
                          Dismiss
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  )
}

function HomeLoadingState() {
  return (
    <div className="h-full flex flex-col bg-background">
      <PageHeader className="border-b-0" />
      <main className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
          <DilagIcon animated className="size-9 text-primary" />
          <span>Opening your workspace…</span>
        </div>
      </main>
    </div>
  )
}
