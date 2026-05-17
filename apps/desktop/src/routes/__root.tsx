import type { CSSProperties } from "react"
import { createRootRoute, Outlet } from "@tanstack/react-router"
import { NuqsAdapter } from "nuqs/adapters/tanstack-router"
import { SidebarProvider, SidebarInset } from "@dilag/ui/sidebar"
import { AppSidebar } from "@/components/blocks/layout/app-sidebar"
import { AutoCollapseSidebar } from "@/components/blocks/layout/auto-collapse-sidebar"
import { PersistentSidebarTrigger } from "@/components/blocks/layout/persistent-sidebar-trigger"
import { AppProviders } from "@/components/app-providers"
import { useZoom } from "@/hooks/use-zoom"

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
          <SidebarInset className="min-h-0 overflow-hidden bg-background">
            <Outlet />
          </SidebarInset>
        </SidebarProvider>
      </NuqsAdapter>
    </AppProviders>
  )
}
