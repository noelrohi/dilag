import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react"
import { createRootRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router"
import { NuqsAdapter } from "nuqs/adapters/tanstack-router"
import { SidebarProvider, SidebarInset } from "@dilag/ui/sidebar"
import { Button } from "@dilag/ui/button"
import { AppSidebar } from "@/components/blocks/layout/app-sidebar"
import { AutoCollapseSidebar } from "@/components/blocks/layout/auto-collapse-sidebar"
import { DilagIcon } from "@/components/blocks/branding/dilag-icon"
import { PersistentSidebarTrigger } from "@/components/blocks/layout/persistent-sidebar-trigger"
import { AppProviders } from "@/components/app-providers"
import { getDefaultProject, useProjectsList } from "@/hooks/use-projects"
import { useSessionsList } from "@/hooks/use-session-data"
import { useZoom } from "@/hooks/use-zoom"

const MIN_BOOT_SPLASH_MS = 550
const SLOW_BOOT_MESSAGE_MS = 8_000

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  // Initialize zoom persistence (restores saved zoom level on mount)
  useZoom()

  // Note: Suspense is NOT used here because it causes iframe remounting issues
  // with lazy-loaded routes. The iframes load external scripts (Tailwind CDN)
  // that get interrupted when Suspense triggers re-renders.
  // TanStack Router handles lazy loading gracefully without Suspense at root.
  return (
    <AppProviders>
      <NuqsAdapter>
        <WorkspaceBootstrapGate>
          <SidebarProvider
            defaultOpen={true}
            style={
              {
                "--sidebar-width": "19rem",
                "--traffic-light-left": "16px",
                "--traffic-light-top": "15px",
                "--traffic-light-size": "12px",
                "--traffic-light-gap": "10px",
                "--titlebar-control-gap": "12px",
                "--titlebar-control-size": "24px",
                "--titlebar-control-left":
                  "calc(var(--traffic-light-left) + (var(--traffic-light-size) * 3) + (var(--traffic-light-gap) * 2) + var(--titlebar-control-gap))",
                "--titlebar-control-offset-y": "1px",
                "--titlebar-control-center-y":
                  "calc(var(--traffic-light-top) + (var(--traffic-light-size) / 2) + var(--titlebar-control-offset-y))",
                "--titlebar-content-left":
                  "calc(var(--titlebar-control-left) + var(--titlebar-control-size) + 4px)",
              } as CSSProperties
            }
          >
            <AutoCollapseSidebar />
            <AppSidebar />
            <PersistentSidebarTrigger />
            <SidebarInset className="min-h-0 overflow-hidden border-l border-border bg-background">
              <Outlet />
            </SidebarInset>
          </SidebarProvider>
        </WorkspaceBootstrapGate>
      </NuqsAdapter>
    </AppProviders>
  )
}

function WorkspaceBootstrapGate({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [ready, setReady] = useState(false)
  const [minimumElapsed, setMinimumElapsed] = useState(false)
  const [showSlowMessage, setShowSlowMessage] = useState(false)
  const [routing, setRouting] = useState(false)
  const {
    data: projects = [],
    isLoading: isLoadingProjects,
    isError: isProjectsError,
    error: projectsError,
    refetch: refetchProjects,
  } = useProjectsList()
  const {
    isLoading: isLoadingSessions,
    isError: isSessionsError,
    error: sessionsError,
    refetch: refetchSessions,
  } = useSessionsList()

  const bootstrapError = projectsError ?? sessionsError
  const hasBootstrapError = isProjectsError || isSessionsError
  const defaultProject = useMemo(() => getDefaultProject(projects), [projects])

  useEffect(() => {
    const minimumTimer = window.setTimeout(() => setMinimumElapsed(true), MIN_BOOT_SPLASH_MS)
    const slowTimer = window.setTimeout(() => setShowSlowMessage(true), SLOW_BOOT_MESSAGE_MS)

    return () => {
      window.clearTimeout(minimumTimer)
      window.clearTimeout(slowTimer)
    }
  }, [])

  useEffect(() => {
    if (ready || routing || !minimumElapsed || hasBootstrapError) return
    if (isLoadingProjects || isLoadingSessions) return

    if (location.pathname === "/" && defaultProject) {
      setRouting(true)
      localStorage.setItem("dilag-last-project-id", defaultProject.id)
      void navigate({
        to: "/project/$projectId",
        params: { projectId: defaultProject.id },
        replace: true,
      }).finally(() => {
        setReady(true)
        setRouting(false)
      })
      return
    }

    setReady(true)
  }, [
    defaultProject,
    hasBootstrapError,
    isLoadingProjects,
    isLoadingSessions,
    location.pathname,
    minimumElapsed,
    navigate,
    ready,
    routing,
  ])

  const retryBootstrap = () => {
    setShowSlowMessage(false)
    void Promise.all([refetchProjects(), refetchSessions()])
  }

  if (ready) return children

  return (
    <div className="flex h-dvh items-center justify-center bg-background text-foreground">
      <div className="flex min-w-64 flex-col items-center gap-4 px-6 text-center">
        <DilagIcon animated className="size-12 text-primary" />
        {hasBootstrapError ? (
          <div className="flex flex-col items-center gap-3">
            <div className="space-y-1">
              <p className="text-sm font-medium">Couldn&apos;t open workspace</p>
              <p className="max-w-xs text-xs text-muted-foreground">
                {bootstrapError instanceof Error ? bootstrapError.message : "Please try again."}
              </p>
            </div>
            <Button size="sm" variant="secondary" onClick={retryBootstrap}>
              Retry
            </Button>
          </div>
        ) : showSlowMessage ? (
          <p className="text-xs text-muted-foreground">Still opening…</p>
        ) : null}
      </div>
    </div>
  )
}
