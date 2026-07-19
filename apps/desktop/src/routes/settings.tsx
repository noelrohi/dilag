import { createFileRoute } from "@tanstack/react-router"
import { useState, useEffect } from "react"
import {
  IconSun as Sun,
  IconMoon as Moon,
  IconDeviceDesktop as Monitor,
  IconExternalLink as SquareArrowRightUp,
  IconTrash as TrashBinMinimalistic,
} from "@tabler/icons-react"
import { useTheme } from "@/components/theme-provider"
import { useUpdaterContext, type UpdaterPhase } from "@/context/updater-context"
import { PageHeader } from "@/components/blocks/layout/page-header"
import { cn } from "@/lib/utils"
import { ModelSelectorButton } from "@/components/blocks/selectors/model-selector-button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@dilag/ui/dialog"
import { bridge } from "@/lib/bridge"

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
})

interface AppInfo {
  version: string
  data_dir: string
  data_size_bytes: number
}

function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    bridge.app.getInfo().then(setAppInfo).catch(console.error)
  }, [])

  const handleResetData = async () => {
    setResetting(true)
    try {
      await bridge.app.resetAllData()
    } catch (error) {
      console.error("Failed to reset data:", error)
      setResetting(false)
      setResetDialogOpen(false)
    }
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
  }

  return (
    <div className="h-dvh flex flex-col bg-background">
      <PageHeader className="border-b-0" />
      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-4 py-8">
          {/* Centered content column */}
          <div className="max-w-2xl mx-auto">
            {/* Header */}
            <header className="px-1 mb-8">
              <h1 className="text-xl font-semibold text-foreground">Settings</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Manage your preferences</p>
            </header>
            {/* General Section */}
            <SettingsSection title="General">
              <SettingsCard>
                <SettingsRow label="Theme">
                  <ThemeSegment value={theme} onChange={setTheme} />
                </SettingsRow>
                <SettingsDivider />
                <SettingsRow label="Default Model">
                  <ModelSelectorButton variant="settings" />
                </SettingsRow>
              </SettingsCard>
            </SettingsSection>

            {/* Storage Section */}
            <SettingsSection
              title="Storage"
              description={appInfo ? formatBytes(appInfo.data_size_bytes) : undefined}
            >
              <SettingsCard>
                <SettingsRow label="Data Location">
                  <code className="text-xs font-mono text-muted-foreground bg-muted/50 px-2 py-1 rounded">
                    {appInfo?.data_dir ?? "~/.dilag"}
                  </code>
                </SettingsRow>
                <SettingsDivider />
                <SettingsRow label="Reset">
                  <button
                    onClick={() => setResetDialogOpen(true)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium",
                      "text-destructive bg-destructive/10 hover:bg-destructive/15 transition-colors",
                    )}
                  >
                    <TrashBinMinimalistic size={13} />
                    Reset All Data
                  </button>
                </SettingsRow>
              </SettingsCard>
            </SettingsSection>

            {/* About Section */}
            <SettingsSection title="About">
              <SettingsCard>
                <SettingsRow label="Version">
                  <UpdateSettingsControl version={appInfo?.version} />
                </SettingsRow>
                <SettingsDivider />
                <SettingsRow label="Links">
                  <div className="flex items-center gap-2">
                    <ExternalLinkButton
                      onClick={() => bridge.shell.openExternal("https://github.com/noelrohi/dilag")}
                      label="GitHub"
                    />
                    <ExternalLinkButton
                      onClick={() =>
                        bridge.shell.openExternal("https://github.com/noelrohi/dilag#readme")
                      }
                      label="Documentation"
                    />
                  </div>
                </SettingsRow>
              </SettingsCard>
            </SettingsSection>
          </div>
        </div>
      </main>

      {/* Reset Dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset All Data?</DialogTitle>
            <DialogDescription>
              This will permanently delete all sessions and settings. The app will restart.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-2">
            <button
              onClick={() => setResetDialogOpen(false)}
              disabled={resetting}
              className={cn(
                "flex-1 h-10 rounded-lg text-sm font-medium",
                "bg-secondary text-secondary-foreground",
                "hover:bg-secondary/80 transition-colors",
                "disabled:opacity-50",
              )}
            >
              Cancel
            </button>
            <button
              onClick={handleResetData}
              disabled={resetting}
              className={cn(
                "flex-1 h-10 rounded-lg text-sm font-medium",
                "bg-destructive text-destructive-foreground",
                "hover:bg-destructive/90 transition-colors",
                "disabled:opacity-50",
              )}
            >
              {resetting ? "Resetting..." : "Reset"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function UpdateSettingsControl({ version }: { version?: string }) {
  const {
    phase,
    updateAvailable,
    updateInfo,
    downloadProgress,
    upToDate,
    error,
    checkForUpdates,
    installUpdate,
  } = useUpdaterContext()

  const busy = phase === "checking" || phase === "downloading"
  const labelByPhase: Record<UpdaterPhase, string> = {
    idle: "Check for Updates",
    checking: "Checking…",
    downloading: `Downloading ${downloadProgress}%`,
    ready: "Restart to Update",
  }

  return (
    <div className="flex items-center gap-3">
      {error ? (
        <span className="max-w-48 truncate text-xs text-destructive">{error}</span>
      ) : upToDate ? (
        <span className="text-xs text-muted-foreground">Up to date</span>
      ) : null}
      <span className="text-sm font-mono tabular-nums text-muted-foreground">
        {version ?? "—"}
        {updateAvailable && updateInfo ? ` → ${updateInfo.version}` : ""}
      </span>
      <button
        onClick={() => {
          if (phase === "ready") {
            void installUpdate()
          } else {
            void checkForUpdates()
          }
        }}
        disabled={busy}
        className={cn(
          "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
          "disabled:opacity-60 tabular-nums",
          phase === "ready"
            ? "bg-primary text-primary-foreground hover:bg-primary/90"
            : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        {labelByPhase[phase]}
      </button>
    </div>
  )
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="mb-8">
      <div className="flex items-center gap-2.5 px-1 mb-3">
        <h2 className="text-sm font-medium text-foreground">{title}</h2>
        {description && (
          <>
            <span className="text-muted-foreground/30">·</span>
            <span className="text-xs text-muted-foreground tabular-nums">{description}</span>
          </>
        )}
      </div>
      {children}
    </section>
  )
}

function SettingsCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-card border border-border/50 overflow-hidden">
      <div className="px-4 py-1">{children}</div>
    </div>
  )
}

function SettingsRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between min-h-[52px] py-2 px-1">
      <span className="text-sm text-foreground">{label}</span>
      {children}
    </div>
  )
}

function SettingsDivider() {
  return <div className="h-px bg-border/50 -mx-1" />
}

function ThemeSegment({
  value,
  onChange,
}: {
  value: string
  onChange: (value: "light" | "dark" | "system") => void
}) {
  const options = [
    { id: "light", icon: Sun, label: "Light" },
    { id: "dark", icon: Moon, label: "Dark" },
    { id: "system", icon: Monitor, label: "Auto" },
  ] as const

  return (
    <div className="flex items-center p-1 rounded-lg bg-muted/50">
      {options.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150",
            value === id
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon size={14} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  )
}

function ExternalLinkButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-md",
        "text-xs text-muted-foreground",
        "bg-muted/50 hover:bg-muted hover:text-foreground",
        "transition-colors",
      )}
    >
      {label}
      <SquareArrowRightUp size={12} />
    </button>
  )
}
