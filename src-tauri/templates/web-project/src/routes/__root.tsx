import { createRootRoute, Outlet } from "@tanstack/react-router";
import { ErrorBoundary } from "../components/error-boundary";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background text-foreground">
        <Outlet />
      </div>
    </ErrorBoundary>
  );
}
