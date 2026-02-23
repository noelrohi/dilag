import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { GlobalEventsProvider } from "@/context/global-events";
import { MenuEventsProvider } from "@/context/menu-events";
import { UpdaterProvider } from "@/context/updater-context";
import { ThemeProvider } from "@/components/theme-provider";
import { ErrorBoundary } from "@/components/blocks/errors/error-boundary";
import { Toaster } from "@dilag/ui/sonner";
import { NotificationProvider } from "@/context/notification";
import type { ReactNode } from "react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

interface AppProvidersProps {
  children: ReactNode;
}

/**
 * Composes all app-level providers into a single component.
 * Layout-specific providers (SidebarProvider) remain in __root.tsx.
 *
 * Provider order (outer to inner):
 * 1. ErrorBoundary - Catches React errors
 * 2. ThemeProvider - Dark/light mode
 * 3. QueryClientProvider - React Query for server state
 * 4. GlobalEventsProvider - SSE connection to OpenCode
 * 5. NotificationProvider - Audio notifications
 * 6. UpdaterProvider - App updates
 * 7. MenuEventsProvider - Native menu events
 */
export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" storageKey="dilag-theme">
        <QueryClientProvider client={queryClient}>
          <GlobalEventsProvider>
            <NotificationProvider>
              <UpdaterProvider>
                <MenuEventsProvider>
                  {children}
                </MenuEventsProvider>
              </UpdaterProvider>
            </NotificationProvider>
          </GlobalEventsProvider>
          <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
        <Toaster />
      </ThemeProvider>
    </ErrorBoundary>
  );
}
