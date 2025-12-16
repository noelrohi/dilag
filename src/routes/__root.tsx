import { createRootRoute, Outlet } from "@tanstack/react-router";
import { GlobalEventsProvider } from "@/context/global-events";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <GlobalEventsProvider>
      <Outlet />
    </GlobalEventsProvider>
  );
}
