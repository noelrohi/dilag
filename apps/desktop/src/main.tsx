import React from "react"
import ReactDOM from "react-dom/client"
import { RouterProvider } from "@tanstack/react-router"
import { router } from "./router"
import { SetupWizard } from "./components/blocks/setup/setup-wizard"
import { CheckUpdatesMenuListener } from "./components/blocks/check-updates-menu-listener"
import { ThemeProvider } from "./components/theme-provider"
import { Toaster } from "@dilag/ui/sonner"
import { UpdaterProvider } from "./context/updater-context"
import { DilagLogo } from "./components/blocks/branding/dilag-logo"
import { bridge } from "@/lib/bridge"
import "./index.css"

// Loading screen component
function LoadingScreen() {
  return (
    <div className="h-dvh flex items-center justify-center bg-background">
      <DilagLogo className="size-12 opacity-50" />
    </div>
  )
}

const container = document.getElementById("root")
if (!container) {
  throw new Error("Root element not found")
}

const root = ReactDOM.createRoot(container as HTMLElement)

// Show loading screen immediately
root.render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="dark" storageKey="dilag-theme">
      <LoadingScreen />
    </ThemeProvider>
  </React.StrictMode>,
)

// Start the embedded Pi runtime before React renders.
// This avoids loading spinners and keeps prerequisite logic outside the component tree.
async function bootstrap() {
  try {
    await bridge.agent.start()

    root.render(
      <React.StrictMode>
        <RouterProvider router={router} />
      </React.StrictMode>,
    )
    return
  } catch (error) {
    console.error("Failed to start Pi runtime:", error)
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
    )
  }
}

bootstrap()
