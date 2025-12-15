import { createRootRoute, Outlet } from "@tanstack/react-router";
import { GlobalEventsProvider } from "@/context/global-events";
import { SidebarProvider } from "@/components/ui/sidebar";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <GlobalEventsProvider>
      <SidebarProvider>
        <Outlet />
      </SidebarProvider>
    </GlobalEventsProvider>
  );
}
