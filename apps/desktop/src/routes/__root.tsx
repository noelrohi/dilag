import { createRootRoute, Outlet } from "@tanstack/react-router"
import { NuqsAdapter } from "nuqs/adapters/tanstack-router"
import { SidebarProvider, SidebarInset } from "@dilag/ui/sidebar"
import { AppSidebar } from "@/components/blocks/layout/app-sidebar"
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
        <SidebarProvider defaultOpen={true}>
          <AppSidebar />
          <SidebarInset className="h-svh">
            <Outlet />
          </SidebarInset>
        </SidebarProvider>
      </NuqsAdapter>
    </AppProviders>
  )
}
