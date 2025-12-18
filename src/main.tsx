import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { invoke } from "@tauri-apps/api/core";
import { router } from "./router";
import { SetupWizard } from "./components/blocks/setup-wizard";
import { ThemeProvider } from "./components/theme-provider";
import "./index.css";

// Check OpenCode installation BEFORE React renders (TkDodo/KCD approved pattern)
// This avoids loading spinners and keeps prerequisite logic outside the component tree
async function bootstrap() {
  const root = ReactDOM.createRoot(
    document.getElementById("root") as HTMLElement,
  );

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
    } else {
      // OpenCode not installed - show setup wizard with callback to re-bootstrap
      root.render(
        <React.StrictMode>
          <ThemeProvider defaultTheme="dark" storageKey="dilag-theme">
            <SetupWizard onComplete={() => bootstrap()} />
          </ThemeProvider>
        </React.StrictMode>,
      );
    }
  } catch (error) {
    // Check failed - show setup wizard (safer to assume not installed)
    console.error("Failed to check OpenCode installation:", error);
    root.render(
      <React.StrictMode>
        <ThemeProvider defaultTheme="dark" storageKey="dilag-theme">
          <SetupWizard onComplete={() => bootstrap()} />
        </ThemeProvider>
      </React.StrictMode>,
    );
  }
}

bootstrap();
