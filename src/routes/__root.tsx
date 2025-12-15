import { createRootRoute, Outlet } from "@tanstack/react-router";
import { SessionsProvider } from "@/hooks/use-sessions";
import { SidebarProvider } from "@/components/ui/sidebar";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <SessionsProvider>
      <SidebarProvider>
        <Outlet />
      </SidebarProvider>
    </SessionsProvider>
  );
}
