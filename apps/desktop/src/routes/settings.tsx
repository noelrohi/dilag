import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Sun, Moon, Monitor, ExternalLink, Trash2, RefreshCw, HardDrive, Info, Palette } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { useUpdaterContext } from "@/context/updater-context";
import { cn } from "@/lib/utils";
import { ModelSelectorButton } from "@/components/blocks/selectors/model-selector-button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@dilag/ui/dialog";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

interface AppInfo {
  version: string;
  data_dir: string;
  data_size_bytes: number;
}

function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { checkForUpdates, checking, updateAvailable, updateInfo, installUpdate, downloading, downloadProgress } = useUpdaterContext();

  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    invoke<AppInfo>("get_app_info").then(setAppInfo).catch(console.error);
  }, []);

  const handleResetData = async () => {
    setResetting(true);
    try {
      await invoke("reset_all_data");
    } catch (error) {
      console.error("Failed to reset data:", error);
      setResetting(false);
      setResetDialogOpen(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  return (
    <div className="h-dvh flex flex-col bg-background">
      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-4 py-8">
          {/* Centered content column */}
          <div className="max-w-2xl mx-auto">
            {/* Header */}
            <header className="px-1 mb-8">
              <h1 className="text-xl font-semibold text-foreground">Settings</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Manage your preferences
              </p>
            </header>
            {/* Appearance Section */}
            <SettingsSection
              icon={<Palette className="size-4" />}
              title="Appearance"
            >
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
              icon={<HardDrive className="size-4" />}
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
                <button
                  onClick={() => setResetDialogOpen(true)}
                  className={cn(
                    "w-full flex items-center gap-3 py-3 px-1",
                    "text-destructive hover:text-destructive/80 transition-colors"
                  )}
                >
                  <Trash2 className="size-4" />
                  <span className="text-sm font-medium">Reset All Data</span>
                </button>
              </SettingsCard>
            </SettingsSection>

            {/* About Section */}
            <SettingsSection
              icon={<Info className="size-4" />}
              title="About"
            >
              <SettingsCard>
                <SettingsRow label="Version">
                  <span className="text-sm font-mono tabular-nums text-muted-foreground">
                    {appInfo?.version ?? "—"}
                  </span>
                </SettingsRow>
                <SettingsDivider />
                <SettingsRow label="Updates">
                  {updateAvailable && updateInfo ? (
                    <button
                      onClick={installUpdate}
                      disabled={downloading}
                      className={cn(
                        "px-3 py-1.5 rounded-md text-xs font-medium",
                        "bg-primary text-primary-foreground",
                        "hover:bg-primary/90 transition-colors",
                        "disabled:opacity-60"
                      )}
                    >
                      {downloading ? `${downloadProgress}%` : `Install ${updateInfo.version}`}
                    </button>
                  ) : (
                    <button
                      onClick={() => checkForUpdates()}
                      disabled={checking}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-md",
                        "text-xs text-muted-foreground",
                        "bg-muted/50 hover:bg-muted hover:text-foreground",
                        "transition-colors disabled:opacity-60"
                      )}
                    >
                      <RefreshCw className={cn("size-3", checking && "animate-spin")} />
                      {checking ? "Checking..." : "Check for Updates"}
                    </button>
                  )}
                </SettingsRow>
                <SettingsDivider />
                <div className="flex items-center gap-2 py-3 px-1">
                  <ExternalLinkButton
                    onClick={() => openUrl("https://github.com/noelrohi/dilag")}
                    label="GitHub"
                  />
                  <ExternalLinkButton
                    onClick={() => openUrl("https://github.com/noelrohi/dilag#readme")}
                    label="Documentation"
                  />
                </div>
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
                "disabled:opacity-50"
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
                "disabled:opacity-50"
              )}
            >
              {resetting ? "Resetting..." : "Reset"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SettingsSection({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <div className="flex items-center gap-2.5 px-1 mb-3">
        <span className="text-muted-foreground">{icon}</span>
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
  );
}

function SettingsCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-card border border-border/50 overflow-hidden">
      <div className="px-4 py-1">{children}</div>
    </div>
  );
}

function SettingsRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between min-h-[52px] py-2 px-1">
      <span className="text-sm text-foreground">{label}</span>
      {children}
    </div>
  );
}

function SettingsDivider() {
  return <div className="h-px bg-border/50 -mx-1" />;
}

function ThemeSegment({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: "light" | "dark" | "system") => void;
}) {
  const options = [
    { id: "light", icon: Sun, label: "Light" },
    { id: "dark", icon: Moon, label: "Dark" },
    { id: "system", icon: Monitor, label: "Auto" },
  ] as const;

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
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Icon className="size-3.5" />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}

function ExternalLinkButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-md",
        "text-xs text-muted-foreground",
        "bg-muted/50 hover:bg-muted hover:text-foreground",
        "transition-colors"
      )}
    >
      {label}
      <ExternalLink className="size-3" />
    </button>
  );
}
