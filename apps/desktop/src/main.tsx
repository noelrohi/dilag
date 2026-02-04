import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { invoke } from "@tauri-apps/api/core";
import { router } from "./router";
import { SetupWizard } from "./components/blocks/setup/setup-wizard";
import { CheckUpdatesMenuListener } from "./components/blocks/check-updates-menu-listener";
import { ThemeProvider } from "./components/theme-provider";
import { Toaster } from "@dilag/ui/sonner";
import { UpdaterProvider } from "./context/updater-context";
import { DilagLogo } from "./components/blocks/branding/dilag-logo";
import "./index.css";

// Loading screen component
function LoadingScreen() {
  return (
    <div className="h-dvh flex items-center justify-center bg-background">
      <DilagLogo className="size-12 opacity-50" />
    </div>
  );
}

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root element not found");
}

const root = ReactDOM.createRoot(container as HTMLElement);

// Show loading screen immediately
root.render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="dark" storageKey="dilag-theme">
      <LoadingScreen />
    </ThemeProvider>
  </React.StrictMode>,
);

// Check OpenCode installation BEFORE React renders (TkDodo/KCD approved pattern)
// This avoids loading spinners and keeps prerequisite logic outside the component tree
async function bootstrap() {
  try {
    const result = await invoke<{ installed: boolean }>(
      "check_opencode_installation",
    );

    if (result.installed) {
      // OpenCode is ready - render the full app
      root.render(
        <React.StrictMode>
          <RouterProvider router={router} />
        </React.StrictMode>,
      );
      return;
    }

    // OpenCode not installed - show setup wizard with callback to re-bootstrap
    // NOTE: We intentionally mount only the providers needed for updates + theme.
    // We cannot mount AppProviders here because GlobalEventsProvider will try to start OpenCode.
    root.render(
      <React.StrictMode>
        <ThemeProvider defaultTheme="dark" storageKey="dilag-theme">
          <UpdaterProvider>
            <CheckUpdatesMenuListener />
            <SetupWizard onComplete={() => bootstrap()} />
            <Toaster />
          </UpdaterProvider>
        </ThemeProvider>
      </React.StrictMode>,
    );
  } catch (error) {
    // Check failed - show setup wizard (safer to assume not installed)
    console.error("Failed to check OpenCode installation:", error);
    root.render(
      <React.StrictMode>
        <ThemeProvider defaultTheme="dark" storageKey="dilag-theme">
          <UpdaterProvider>
            <CheckUpdatesMenuListener />
            <SetupWizard onComplete={() => bootstrap()} />
            <Toaster />
          </UpdaterProvider>
        </ThemeProvider>
      </React.StrictMode>,
    );
  }
}

bootstrap();
