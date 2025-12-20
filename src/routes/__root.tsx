import { createRootRoute, Outlet } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { GlobalEventsProvider } from "@/context/global-events";
import { MenuEventsProvider } from "@/context/menu-events";
import { UpdaterProvider } from "@/context/updater-context";
import { LicenseProvider } from "@/context/license-context";
import { ThemeProvider } from "@/components/theme-provider";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { Toaster } from "@/components/ui/sonner";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/blocks/app-sidebar";
import { LicenseGate } from "@/components/blocks/license-gate";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  // Note: Suspense is NOT used here because it causes iframe remounting issues
  // with lazy-loaded routes. The iframes load external scripts (Tailwind CDN)
  // that get interrupted when Suspense triggers re-renders.
  // TanStack Router handles lazy loading gracefully without Suspense at root.
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" storageKey="dilag-theme">
        <QueryClientProvider client={queryClient}>
          <LicenseProvider>
            <LicenseGate>
              <GlobalEventsProvider>
                <UpdaterProvider>
                  <MenuEventsProvider>
                    <SidebarProvider defaultOpen={false}>
                      <AppSidebar />
                      <SidebarInset>
                        <Outlet />
                      </SidebarInset>
                    </SidebarProvider>
                  </MenuEventsProvider>
                </UpdaterProvider>
              </GlobalEventsProvider>
            </LicenseGate>
          </LicenseProvider>
          <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
        <Toaster />
      </ThemeProvider>
    </ErrorBoundary>
  );
}
