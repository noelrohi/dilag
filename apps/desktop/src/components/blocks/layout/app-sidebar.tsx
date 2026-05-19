import { Link, useLocation, useNavigate } from "@tanstack/react-router"
import { useCallback, useMemo, useState, type PointerEvent as ReactPointerEvent } from "react"
import {
  IconWand as MagicStick,
  IconSettings as Settings,
  IconPlug as PlugCircle,
  IconPin as Pin,
  IconSquarePlus as AddSquare,
  IconCirclePlus as AddCircle,
  IconArchive as ArchiveDownMinimlistic,
  IconDots as MenuDots,
  IconTrash as TrashBinMinimalistic,
  IconFolder as FolderIcon,
  IconFolderSymlink as FolderPathConnect,
  IconPencil as Pen,
  IconMessageCircle as ChatRoundLine,
  IconClock as ClockCircle,
  IconCopy,
  IconLink,
  IconMarkdown,
} from "@tabler/icons-react"
import {
  IconChevronDown as ChevronDownIcon,
  IconChevronRight as ChevronRightIcon,
} from "@tabler/icons-react"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  useSidebar,
} from "@dilag/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@dilag/ui/dropdown-menu"
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
import { Button } from "@dilag/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@dilag/ui/dialog"
import { Input } from "@dilag/ui/input"
import { Tooltip, TooltipContent, TooltipTrigger } from "@dilag/ui/tooltip"
import { AuthSettings } from "@/components/blocks/auth/auth-settings"
import { useProjectMutations, useProjectsList } from "@/hooks/use-projects"
import { useSessions } from "@/hooks/use-sessions"
import { useNewDesignFlow } from "@/features/new-design/use-new-design-flow"
import { bridge } from "@/lib/bridge"
import type { AgentMessage, AgentMessagePart, ProjectMeta } from "@dilag/desktop-bridge"
import type { SessionMeta } from "@/context/session-store"

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return ""
  const diffMs = Date.now() - date.getTime()
  if (diffMs < 0) return "now"
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "now"
  if (diffMins < 60) return `${diffMins}m`
  if (diffHours < 24) return `${diffHours}h`
  if (diffDays < 7) return `${diffDays}d`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w`
  return `${Math.floor(diffDays / 30)}mo`
}

function getNextUntitledProjectName(projects: ProjectMeta[]): string {
  const baseName = "Untitled project"
  const existingNames = new Set(projects.map((project) => project.name.trim().toLowerCase()))

  if (!existingNames.has(baseName.toLowerCase())) return baseName

  for (let index = 2; ; index += 1) {
    const candidate = `${baseName} ${index}`
    if (!existingNames.has(candidate.toLowerCase())) return candidate
  }
}

type ProjectSortMode = "created" | "updated"
type ProjectOrganizeMode = "by-project" | "recent-projects" | "chronological-list"

function formatSessionMessagesAsMarkdown(session: SessionMeta, messages: AgentMessage[]): string {
  const lines = [
    `# ${session.name}`,
    "",
    `Session ID: ${session.id}`,
    `Working directory: ${session.cwd}`,
    "",
  ]

  for (const message of messages) {
    const role = message.info.role === "user" ? "User" : "Assistant"
    const content = message.parts.map(formatMessagePart).filter(Boolean).join("\n\n").trim()
    if (!content) continue
    lines.push(`## ${role}`, "", content, "")
  }

  return lines.join("\n").trimEnd()
}

function formatMessagePart(part: AgentMessagePart): string {
  if (part.type === "text") return part.text ?? ""
  if (part.type === "reasoning") return part.text ? `<reasoning>\n${part.text}\n</reasoning>` : ""
  if (part.type === "tool") return `[tool: ${part.tool ?? "unknown"}]`
  if (part.type === "file") return `[file: ${part.filename ?? part.url ?? "attached file"}]`
  return ""
}

export function AppSidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { sessions, renameSession, deleteSession, toggleFavorite } = useSessions()
  const { data: projects = [] } = useProjectsList()
  const { createProject, addExistingProject, updateProject, removeProject } = useProjectMutations()
  const { openNewDesign, openProjectComposer } = useNewDesignFlow({
    projects,
  })
  const [projectMenuOpen, setProjectMenuOpen] = useState(false)
  const [addProjectMenuOpen, setAddProjectMenuOpen] = useState(false)
  const [createProjectDialogOpen, setCreateProjectDialogOpen] = useState(false)
  const [newProjectName, setNewProjectName] = useState("")
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [renameProjectDialog, setRenameProjectDialog] = useState<ProjectMeta | null>(null)
  const [renameProjectName, setRenameProjectName] = useState("")
  const [isRenamingProject, setIsRenamingProject] = useState(false)
  const [projectsSectionExpanded, setProjectsSectionExpanded] = useState(true)
  const [projectSortMode, setProjectSortMode] = useState<ProjectSortMode>("updated")
  const [projectOrganizeMode, setProjectOrganizeMode] =
    useState<ProjectOrganizeMode>("recent-projects")
  const [archiveAllProjectsOpen, setArchiveAllProjectsOpen] = useState(false)

  const pinnedProjects = useMemo(() => projects.filter((project) => project.pinned), [projects])
  const regularProjects = useMemo(() => {
    const items = projects.filter((project) => !project.pinned)
    if (projectSortMode === "created") {
      return [...items].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
    }
    return [...items].sort(
      (a, b) =>
        new Date(b.last_opened_at).getTime() - new Date(a.last_opened_at).getTime() ||
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
  }, [projects, projectSortMode])
  const showProjectHeaderActions = projects.length === 0 || projectMenuOpen || addProjectMenuOpen

  const sessionsByProject = useMemo(() => {
    const map = new Map<string, SessionMeta[]>()
    for (const session of sessions) {
      if (!session.projectId) continue
      const list = map.get(session.projectId) ?? []
      list.push(session)
      map.set(session.projectId, list)
    }
    for (const list of map.values()) {
      list.sort(
        (a, b) =>
          new Date(b.updated_at ?? b.created_at).getTime() -
          new Date(a.updated_at ?? a.created_at).getTime(),
      )
    }
    return map
  }, [sessions])

  const handleNewDesign = () => {
    openNewDesign()
  }

  const openCreateProjectDialog = () => {
    setNewProjectName(getNextUntitledProjectName(projects))
    setCreateProjectDialogOpen(true)
  }

  const handleCreateProject = async () => {
    const name = newProjectName.trim()
    if (!name) return

    try {
      setIsCreatingProject(true)
      const project = await createProject({ name })
      setCreateProjectDialogOpen(false)
      openProjectComposer(project.id)
    } catch (err) {
      console.error("Failed to create project:", err)
      window.alert(err instanceof Error ? err.message : "Failed to create project")
    } finally {
      setIsCreatingProject(false)
    }
  }

  const handleUseExistingFolder = async () => {
    try {
      const folder = await bridge.dialog.openDirectory()
      if (!folder) return
      const project = await addExistingProject({ path: folder })
      openProjectComposer(project.id)
    } catch (err) {
      console.error("Failed to add project:", err)
      window.alert(err instanceof Error ? err.message : "Failed to add project")
    }
  }

  const runAfterMenuClose = (action: () => void | Promise<void>) => {
    window.setTimeout(() => void action(), 0)
  }

  const openRenameProjectDialog = (project: ProjectMeta) => {
    runAfterMenuClose(() => {
      setRenameProjectDialog(project)
      setRenameProjectName(project.name)
    })
  }

  const handleRenameProject = async () => {
    const project = renameProjectDialog
    const name = renameProjectName.trim()
    if (!project || !name) return

    if (name === project.name) {
      setRenameProjectDialog(null)
      return
    }

    try {
      setIsRenamingProject(true)
      await updateProject({ id: project.id, updates: { name } })
      setRenameProjectDialog(null)
    } catch (err) {
      console.error("Failed to rename project:", err)
      window.alert(err instanceof Error ? err.message : "Failed to rename project")
    } finally {
      setIsRenamingProject(false)
    }
  }

  const handleArchiveAllProjects = async () => {
    try {
      await Promise.all(projects.map((project) => removeProject(project.id)))
      window.localStorage.removeItem("dilag-last-project-id")
      await navigate({ to: "/" })
    } catch (err) {
      console.error("Failed to archive projects:", err)
      window.alert(err instanceof Error ? err.message : "Failed to archive projects")
    }
  }

  const handleSetProjectOrganizeMode = (mode: ProjectOrganizeMode) => {
    setProjectOrganizeMode(mode)
    if (mode === "recent-projects") setProjectSortMode("updated")
    if (mode === "chronological-list") setProjectSortMode("created")
  }

  const handleStartNewChat = (project: ProjectMeta) => {
    openProjectComposer(project.id)
  }

  return (
    <Sidebar collapsible="offcanvas" variant="inset" className="group/sidebar-resizable">
      <SidebarHeader className="h-[44px] flex-row items-center px-3 py-0" />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="h-8 text-[15px]"
                  onClick={handleNewDesign}
                  tooltip="New design"
                >
                  <AddSquare size={17} />
                  <span>New design</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location.pathname === "/skills"}
                  tooltip="Skills"
                  className="h-8 text-[15px]"
                >
                  <Link to="/skills">
                    <MagicStick size={17} />
                    <span>Skills</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {pinnedProjects.length > 0 && (
          <SidebarGroup className="group-data-[collapsible=icon]:hidden">
            <SidebarGroupLabel className="px-2 pt-2 text-[13px] font-medium text-sidebar-foreground/45">
              Pinned
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {pinnedProjects.map((project) => (
                  <ProjectItem
                    key={project.id}
                    project={project}
                    sessions={sessionsByProject.get(project.id) ?? []}
                    onToggleExpanded={() =>
                      updateProject({ id: project.id, updates: { expanded: !project.expanded } })
                    }
                    onTogglePinned={() =>
                      updateProject({ id: project.id, updates: { pinned: !project.pinned } })
                    }
                    onRequestRename={() => openRenameProjectDialog(project)}
                    onRemove={() => removeProject(project.id)}
                    onStartNewChat={() => void handleStartNewChat(project)}
                    onRenameSession={renameSession}
                    onDeleteSession={deleteSession}
                    onToggleSessionPinned={toggleFavorite}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup className="group-data-[collapsible=icon]:hidden min-h-0 flex-1">
          <SidebarGroupLabel className="px-2 pt-2 text-[13px] font-medium text-sidebar-foreground/45 flex items-center justify-between group/projects">
            <span className="flex min-w-0 items-center gap-1">
              <span>Projects</span>
              {regularProjects.length > 0 && (
                <button
                  className="rounded p-0.5 opacity-0 transition-opacity hover:bg-sidebar-accent hover:text-sidebar-foreground group-hover/projects:opacity-100 group-focus-within/projects:opacity-100"
                  onClick={() => setProjectsSectionExpanded((expanded) => !expanded)}
                  title={projectsSectionExpanded ? "Collapse projects" : "Expand projects"}
                  aria-label={projectsSectionExpanded ? "Collapse projects" : "Expand projects"}
                >
                  {projectsSectionExpanded ? (
                    <ChevronDownIcon className="size-3.5" />
                  ) : (
                    <ChevronRightIcon className="size-3.5" />
                  )}
                </button>
              )}
            </span>
            <div
              className={`flex items-center gap-0.5 transition-opacity ${
                showProjectHeaderActions
                  ? "opacity-100"
                  : "opacity-0 group-hover/projects:opacity-100"
              }`}
            >
              <DropdownMenu open={projectMenuOpen} onOpenChange={setProjectMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <button className="p-0.5 rounded hover:bg-sidebar-accent" title="Project menu">
                    <MenuDots size={14} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="right" align="start" className="w-56">
                  <DropdownMenuItem
                    disabled={projects.length === 0}
                    onSelect={() => runAfterMenuClose(() => setArchiveAllProjectsOpen(true))}
                  >
                    <ArchiveDownMinimlistic size={16} className="mr-2" />
                    Archive all projects
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <FolderPathConnect size={16} className="mr-2" />
                      Organize sidebar
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-56">
                      <DropdownMenuRadioGroup
                        value={projectOrganizeMode}
                        onValueChange={(value) =>
                          handleSetProjectOrganizeMode(value as ProjectOrganizeMode)
                        }
                      >
                        <DropdownMenuRadioItem value="by-project">By project</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="recent-projects">
                          Recent projects
                        </DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="chronological-list">
                          Chronological list
                        </DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem disabled>Move down</DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <ClockCircle size={16} className="mr-2" />
                      Sort by
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-52">
                      <DropdownMenuRadioGroup
                        value={projectSortMode}
                        onValueChange={(value) => setProjectSortMode(value as ProjectSortMode)}
                      >
                        <DropdownMenuRadioItem value="created">Created</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="updated">Updated</DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu open={addProjectMenuOpen} onOpenChange={setAddProjectMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <button className="p-0.5 rounded hover:bg-sidebar-accent" title="Add project">
                    <AddCircle size={14} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="right" align="start" className="w-56">
                  <DropdownMenuItem onSelect={() => runAfterMenuClose(openCreateProjectDialog)}>
                    Start from scratch
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => runAfterMenuClose(handleUseExistingFolder)}>
                    Use an existing folder
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </SidebarGroupLabel>
          {projectsSectionExpanded && (
            <SidebarGroupContent className="overflow-y-auto">
              <SidebarMenu>
                {regularProjects.map((project) => (
                  <ProjectItem
                    key={project.id}
                    project={project}
                    sessions={sessionsByProject.get(project.id) ?? []}
                    onToggleExpanded={() =>
                      updateProject({ id: project.id, updates: { expanded: !project.expanded } })
                    }
                    onTogglePinned={() =>
                      updateProject({ id: project.id, updates: { pinned: !project.pinned } })
                    }
                    onRequestRename={() => openRenameProjectDialog(project)}
                    onRemove={() => removeProject(project.id)}
                    onStartNewChat={() => void handleStartNewChat(project)}
                    onRenameSession={renameSession}
                    onDeleteSession={deleteSession}
                    onToggleSessionPinned={toggleFavorite}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          )}
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="relative pb-3">
        <div className="absolute -top-6 left-0 right-0 h-6 bg-gradient-to-t from-sidebar to-transparent pointer-events-none" />
        <SidebarMenu>
          <SidebarMenuItem>
            <AuthSettings
              trigger={
                <SidebarMenuButton className="h-8 text-[15px]" tooltip="Connect Provider">
                  <PlugCircle size={17} />
                  <span>Connect Provider</span>
                </SidebarMenuButton>
              }
            />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={location.pathname === "/settings"}
              tooltip="Settings"
              className="h-8 text-[15px]"
            >
              <Link to="/settings">
                <Settings size={17} />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarResizeHandle />

      <Dialog
        open={createProjectDialogOpen}
        onOpenChange={(open) => {
          if (!isCreatingProject) setCreateProjectDialogOpen(open)
        }}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void handleCreateProject()
            }}
          >
            <Input
              value={newProjectName}
              onChange={(event) => setNewProjectName(event.target.value)}
              onFocus={(event) => event.currentTarget.select()}
              placeholder="Folder name"
              autoFocus
            />
            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="ghost"
                disabled={isCreatingProject}
                onClick={() => setCreateProjectDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!newProjectName.trim() || isCreatingProject}>
                {isCreatingProject ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={renameProjectDialog !== null}
        onOpenChange={(open) => {
          if (!isRenamingProject && !open) setRenameProjectDialog(null)
        }}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Rename project</DialogTitle>
            <DialogDescription className="sr-only">
              Enter a new name for this project.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void handleRenameProject()
            }}
          >
            <Input
              value={renameProjectName}
              onChange={(event) => setRenameProjectName(event.target.value)}
              onFocus={(event) => event.currentTarget.select()}
              placeholder="Project name"
              autoFocus
            />
            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="ghost"
                disabled={isRenamingProject}
                onClick={() => setRenameProjectDialog(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!renameProjectName.trim() || isRenamingProject}>
                {isRenamingProject ? "Renaming..." : "Rename"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={archiveAllProjectsOpen} onOpenChange={setArchiveAllProjectsOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive all projects?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes every project from the sidebar. Your local project folders stay on disk.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => void handleArchiveAllProjects()}
            >
              Archive all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sidebar>
  )
}

function SidebarResizeHandle() {
  const { state } = useSidebar()

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (state === "collapsed") return
      event.preventDefault()

      const wrapper = event.currentTarget.closest<HTMLElement>('[data-slot="sidebar-wrapper"]')
      if (!wrapper) return

      const minWidth = 240
      const maxWidth = 420

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const nextWidth = Math.min(maxWidth, Math.max(minWidth, moveEvent.clientX))
        wrapper.style.setProperty("--sidebar-width", `${nextWidth}px`)
      }

      const handlePointerUp = () => {
        window.removeEventListener("pointermove", handlePointerMove)
        window.removeEventListener("pointerup", handlePointerUp)
        document.body.style.cursor = ""
        document.body.style.userSelect = ""
      }

      document.body.style.cursor = "col-resize"
      document.body.style.userSelect = "none"
      window.addEventListener("pointermove", handlePointerMove)
      window.addEventListener("pointerup", handlePointerUp, { once: true })
    },
    [state],
  )

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      onPointerDown={handlePointerDown}
      className="absolute right-0 top-3 bottom-3 z-20 hidden w-2 translate-x-1/2 cursor-col-resize rounded-full transition-colors hover:bg-sidebar-border/80 group-data-[collapsible=offcanvas]:hidden md:block"
    />
  )
}

function ProjectItem({
  project,
  sessions,
  onToggleExpanded,
  onTogglePinned,
  onRequestRename,
  onRemove,
  onStartNewChat,
  onRenameSession,
  onDeleteSession,
  onToggleSessionPinned,
}: {
  project: ProjectMeta
  sessions: SessionMeta[]
  onToggleExpanded: () => void
  onTogglePinned: () => void
  onRequestRename: () => void
  onRemove: () => void
  onStartNewChat: () => void
  onRenameSession: (sessionId: string, name: string) => void
  onDeleteSession: (sessionId: string) => void | Promise<void>
  onToggleSessionPinned: (sessionId: string) => void | Promise<void>
}) {
  const navigate = useNavigate()
  const location = useLocation()
  return (
    <>
      <SidebarMenuItem className="group/item">
        <SidebarMenuButton asChild>
          <div onClick={onToggleExpanded} role="button" tabIndex={0}>
            <FolderIcon className="size-4 shrink-0 text-sidebar-foreground/55" />
            <span className="min-w-0 truncate text-[15px] text-sidebar-foreground/75">
              {project.name}
            </span>
            <button
              className="shrink-0 rounded p-0.5 text-sidebar-foreground/50 opacity-0 transition-opacity hover:bg-sidebar-accent hover:text-sidebar-foreground group-hover/item:opacity-100 group-focus-within/item:opacity-100"
              onClick={(event) => {
                event.stopPropagation()
                onToggleExpanded()
              }}
              aria-label={project.expanded ? "Collapse project" : "Expand project"}
            >
              {project.expanded ? (
                <ChevronDownIcon className="size-3.5" />
              ) : (
                <ChevronRightIcon className="size-3.5" />
              )}
            </button>
          </div>
        </SidebarMenuButton>
        <Tooltip>
          <TooltipTrigger asChild>
            <SidebarMenuAction
              className="right-7 transition-opacity"
              showOnHover
              onClick={(event) => {
                event.stopPropagation()
                onStartNewChat()
              }}
              aria-label="Create new chat"
            >
              <ChatRoundLine size={16} />
            </SidebarMenuAction>
          </TooltipTrigger>
          <TooltipContent
            side="right"
            align="center"
            sideOffset={8}
            showArrow={false}
            className="rounded-lg border border-border/60 bg-popover/95 px-2.5 py-1 text-[12px] font-medium text-popover-foreground shadow-md backdrop-blur"
          >
            Create new chat
          </TooltipContent>
        </Tooltip>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuAction
              className="transition-opacity"
              showOnHover
              aria-label={`${project.name} actions`}
            >
              <MenuDots size={16} />
            </SidebarMenuAction>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" className="w-44">
            <DropdownMenuItem onClick={onTogglePinned}>
              <Pin size={16} className="mr-2" />
              {project.pinned ? "Unpin project" : "Pin project"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => bridge.shell.openPath(project.path)}>
              <FolderPathConnect size={16} className="mr-2" />
              Open in Finder
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onRequestRename}>
              <Pen size={16} className="mr-2" />
              Rename project
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onRemove}
              className="text-destructive focus:text-destructive"
            >
              <TrashBinMinimalistic size={16} className="mr-2" />
              Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>

      {project.expanded &&
        (sessions.length === 0 ? (
          <SidebarMenuItem>
            <div className="pl-8 pr-2 py-1 text-xs text-muted-foreground/60">No chats</div>
          </SidebarMenuItem>
        ) : (
          sessions.map((session) => {
            const isSessionActive =
              location.pathname === `/project/${project.id}/session/${session.id}` ||
              location.pathname === `/studio/${session.id}`
            const sessionUrl = `${window.location.origin}/project/${project.id}/session/${session.id}`
            const copyToClipboard = (value: string) => {
              void navigator.clipboard?.writeText(value)
            }
            const copySessionMessages = () => {
              void (async () => {
                const messages = await bridge.agent.getMessages({
                  sessionID: session.id,
                  directory: session.cwd,
                })
                copyToClipboard(formatSessionMessagesAsMarkdown(session, messages ?? []))
              })()
            }

            return (
              <SidebarMenuItem key={session.id} className="group/chat">
                <SidebarMenuButton
                  isActive={isSessionActive}
                  className="h-8 pl-8 text-sidebar-foreground/80 data-[active=true]:bg-sidebar-accent/55 data-[active=true]:font-normal data-[active=true]:text-sidebar-foreground/85"
                  onClick={() =>
                    navigate({
                      to: "/project/$projectId/session/$sessionId",
                      params: { projectId: project.id, sessionId: session.id },
                    })
                  }
                >
                  <span className="truncate text-[15px]">{session.name}</span>
                </SidebarMenuButton>
                <span className="absolute right-2 top-1.5 text-xs text-sidebar-foreground/45 transition-opacity pointer-events-none group-hover/menu-item:opacity-0 group-focus-within/menu-item:opacity-0 peer-hover/menu-button:opacity-0">
                  {formatRelativeTime(session.updated_at ?? session.created_at)}
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuAction className="transition-opacity" showOnHover>
                      <MenuDots size={16} />
                    </SidebarMenuAction>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="right" align="start" className="w-56">
                    <DropdownMenuItem onSelect={() => onToggleSessionPinned(session.id)}>
                      <Pin size={16} className="mr-2" />
                      {session.favorite ? "Unpin chat" : "Pin chat"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => {
                        const name = window.prompt("Chat name", session.name)?.trim()
                        if (name && name !== session.name) {
                          onRenameSession(session.id, name)
                        }
                      }}
                    >
                      <Pen size={16} className="mr-2" />
                      Rename chat
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => {
                        void (async () => {
                          await onDeleteSession(session.id)
                          if (isSessionActive) {
                            navigate({
                              to: "/project/$projectId",
                              params: { projectId: project.id },
                            })
                          }
                        })()
                      }}
                    >
                      <ArchiveDownMinimlistic size={16} className="mr-2" />
                      Archive chat
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => copyToClipboard(session.cwd)}>
                      <IconCopy size={16} className="mr-2" />
                      Copy working directory
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => copyToClipboard(session.id)}>
                      <IconCopy size={16} className="mr-2" />
                      Copy session ID
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => copyToClipboard(sessionUrl)}>
                      <IconLink size={16} className="mr-2" />
                      Copy deeplink
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={copySessionMessages}>
                      <IconMarkdown size={16} className="mr-2" />
                      Copy as Markdown
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            )
          })
        ))}
    </>
  )
}
