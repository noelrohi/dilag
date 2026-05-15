import { Link, useLocation, useNavigate } from "@tanstack/react-router"
import { useMemo } from "react"
import {
  MagicStick,
  Settings,
  PlugCircle,
  Pin,
  AddSquare,
  AddCircle,
  MenuDots,
  TrashBinMinimalistic,
  SidebarMinimalistic,
  Folder,
  FolderOpen,
  FolderPathConnect,
  Pen,
} from "@solar-icons/react"
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
} from "@dilag/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@dilag/ui/dropdown-menu"
import { AuthSettings } from "@/components/blocks/auth/auth-settings"
import { useProjectMutations, useProjectsList, getDefaultProject } from "@/hooks/use-projects"
import { useSessions } from "@/hooks/use-sessions"
import { bridge } from "@/lib/bridge"
import type { ProjectMeta } from "@dilag/desktop-bridge"
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

export function AppSidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { sessions, deleteSession } = useSessions()
  const { data: projects = [] } = useProjectsList()
  const { createProject, addExistingProject, updateProject, removeProject } = useProjectMutations()

  const pinnedProjects = useMemo(() => projects.filter((project) => project.pinned), [projects])
  const regularProjects = useMemo(() => projects.filter((project) => !project.pinned), [projects])

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
    const project = getDefaultProject(projects)
    if (project) {
      navigate({ to: "/project/$projectId", params: { projectId: project.id } })
    } else {
      navigate({ to: "/" })
    }
  }

  const handleStartFromScratch = async () => {
    const name = window.prompt("Project name")?.trim()
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

  const handleCollapseAll = () => {
    projects.forEach((project) => {
      if (project.expanded) updateProject({ id: project.id, updates: { expanded: false } })
    })
  }

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader
        data-tauri-drag-region
        className="h-[42px] pb-1 border-b border-sidebar-border"
      />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={handleNewDesign} tooltip="New design">
                  <AddSquare size={16} />
                  <span>New design</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location.pathname === "/skills"}
                  tooltip="Skills"
                >
                  <Link to="/skills">
                    <MagicStick size={16} />
                    <span>Skills</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {pinnedProjects.length > 0 && (
          <SidebarGroup className="group-data-[collapsible=icon]:hidden">
            <SidebarGroupLabel className="text-xs text-muted-foreground px-2">
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
                    onRename={(name) => updateProject({ id: project.id, updates: { name } })}
                    onRemove={() => removeProject(project.id)}
                    onDeleteSession={deleteSession}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup className="group-data-[collapsible=icon]:hidden min-h-0 flex-1">
          <SidebarGroupLabel className="text-xs text-muted-foreground px-2 flex items-center justify-between group/projects">
            <span>Projects</span>
            <div
              className={`flex items-center gap-0.5 transition-opacity ${
                projects.length === 0 ? "opacity-100" : "opacity-0 group-hover/projects:opacity-100"
              }`}
            >
              <button
                className="p-0.5 rounded hover:bg-sidebar-accent"
                onClick={handleCollapseAll}
                title="Collapse all"
              >
                <SidebarMinimalistic size={14} />
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-0.5 rounded hover:bg-sidebar-accent" title="Project menu">
                    <MenuDots size={14} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="right" align="start" className="w-48">
                  <DropdownMenuItem onClick={handleStartFromScratch}>
                    Start from scratch
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleUseExistingFolder}>
                    Use an existing folder
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-0.5 rounded hover:bg-sidebar-accent" title="Add project">
                    <AddCircle size={14} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="right" align="start" className="w-48">
                  <DropdownMenuItem onClick={handleStartFromScratch}>
                    Start from scratch
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleUseExistingFolder}>
                    Use an existing folder
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </SidebarGroupLabel>
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
                  onRename={(name) => updateProject({ id: project.id, updates: { name } })}
                  onRemove={() => removeProject(project.id)}
                  onDeleteSession={deleteSession}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="relative">
        <div className="absolute -top-6 left-0 right-0 h-6 bg-gradient-to-t from-sidebar to-transparent pointer-events-none" />
        <SidebarMenu>
          <SidebarMenuItem>
            <AuthSettings
              trigger={
                <SidebarMenuButton tooltip="Connect Provider">
                  <PlugCircle size={16} />
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
            >
              <Link to="/settings">
                <Settings size={16} />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}

function ProjectItem({
  project,
  sessions,
  onToggleExpanded,
  onTogglePinned,
  onRename,
  onRemove,
  onDeleteSession,
}: {
  project: ProjectMeta
  sessions: SessionMeta[]
  onToggleExpanded: () => void
  onTogglePinned: () => void
  onRename: (name: string) => void
  onRemove: () => void
  onDeleteSession: (sessionId: string) => void
}) {
  const navigate = useNavigate()
  const location = useLocation()
  return (
    <>
      <SidebarMenuItem className="group/item">
        <SidebarMenuButton onClick={onToggleExpanded}>
          <button
            className="-ml-1 p-0.5 rounded hover:bg-sidebar-accent"
            onClick={(event) => {
              event.stopPropagation()
              onToggleExpanded()
            }}
            aria-label={project.expanded ? "Collapse project" : "Expand project"}
          >
            {project.expanded ? <FolderOpen size={14} /> : <Folder size={14} />}
          </button>
          <span className="truncate text-sm">{project.name}</span>
        </SidebarMenuButton>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuAction
              className="opacity-0 group-hover/item:opacity-100 transition-opacity"
              showOnHover
            >
              <MenuDots size={16} />
            </SidebarMenuAction>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" className="w-44">
            <DropdownMenuItem onClick={onTogglePinned}>
              <Pin size={16} className="mr-2" />
              {project.pinned ? "Unpin project" : "Pin project"}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => bridge.shell.openExternal(`file://${encodeURI(project.path)}`)}
            >
              <FolderPathConnect size={16} className="mr-2" />
              Open in Finder
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                const name = window.prompt("Project name", project.name)?.trim()
                if (name && name !== project.name) {
                  onRename(name)
                }
              }}
            >
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

            return (
              <SidebarMenuItem key={session.id} className="group/chat">
                <SidebarMenuButton
                  isActive={isSessionActive}
                  className="pl-8"
                  onClick={() =>
                    navigate({
                      to: "/project/$projectId/session/$sessionId",
                      params: { projectId: project.id, sessionId: session.id },
                    })
                  }
                >
                  <span className="truncate text-sm">{session.name}</span>
                </SidebarMenuButton>
                <span className="absolute right-2 top-1.5 text-xs text-muted-foreground transition-opacity pointer-events-none group-hover/menu-item:opacity-0 group-focus-within/menu-item:opacity-0 peer-hover/menu-button:opacity-0">
                  {formatRelativeTime(session.updated_at ?? session.created_at)}
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuAction
                      className="opacity-0 group-hover/chat:opacity-100 transition-opacity"
                      showOnHover
                    >
                      <MenuDots size={16} />
                    </SidebarMenuAction>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="right" align="start" className="w-40">
                    <DropdownMenuItem
                      onClick={() => onDeleteSession(session.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      <TrashBinMinimalistic size={16} className="mr-2" />
                      Delete chat
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
