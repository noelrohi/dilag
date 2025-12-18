import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { ChevronRight, Sun, Moon, Monitor, ExternalLink, RotateCcw } from "lucide-react";
import { DilagLogo } from "@/components/ui/dilag-logo";
import { useTheme } from "@/components/theme-provider";
import { useModels } from "@/hooks/use-models";
import { useUpdater } from "@/hooks/use-updater";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ModelSelector,
  ModelSelectorTrigger,
  ModelSelectorContent,
  ModelSelectorInput,
  ModelSelectorList,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorItem,
  ModelSelectorLogo,
  ModelSelectorName,
} from "@/components/ai-elements/model-selector";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createLazyFileRoute("/settings")({
  component: SettingsPage,
});

interface AppInfo {
  version: string;
  data_dir: string;
  data_size_bytes: number;
}

function SettingsPage() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { models, selectedModel, selectModel, isLoading: modelsLoading } = useModels();
  const { checkForUpdates, checking, updateAvailable, updateInfo, installUpdate, downloading, downloadProgress } = useUpdater();

  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);

  // Fetch app info on mount
  useEffect(() => {
    invoke<AppInfo>("get_app_info").then(setAppInfo).catch(console.error);
  }, []);

  const handleResetData = async () => {
    setResetting(true);
    try {
      await invoke("reset_all_data");
      // App will restart, so this code may not execute
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

  const groupedModels = models.reduce(
    (acc, model) => {
      if (!acc[model.providerID]) {
        acc[model.providerID] = {
          name: model.providerName,
          models: [],
        };
      }
      acc[model.providerID].models.push(model);
      return acc;
    },
    {} as Record<string, { name: string; models: typeof models }>
  );

  const selectedModelInfo = models.find(
    (m) => m.providerID === selectedModel?.providerID && m.id === selectedModel?.modelID
  );

  return (
    <div className="h-dvh flex flex-col bg-background">
      {/* Title bar drag region */}
      <div
        data-tauri-drag-region
        className="h-[38px] shrink-0 flex items-center select-none relative"
      >
        {/* Breadcrumbs: Dilag > Settings */}
        <div className="absolute left-0 top-0 h-full flex items-center pl-3">
          <div className="flex items-center gap-1 text-[12px]">
            <button
              onClick={() => navigate({ to: "/" })}
              className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
            >
              <DilagLogo className="size-4" />
              <span>Dilag</span>
            </button>
            <ChevronRight className="size-3 text-muted-foreground/50" />
            <span className="font-medium text-foreground">Settings</span>
          </div>
        </div>
      </div>

      {/* Border */}
      <div className="h-px bg-border" />

      {/* Content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
          {/* Appearance Section */}
          <section className="space-y-4">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Appearance
            </h2>
            <div className="bg-card border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Theme</p>
                  <p className="text-sm text-muted-foreground">
                    Choose your preferred color scheme
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <ThemeButton
                  active={theme === "light"}
                  onClick={() => setTheme("light")}
                  icon={<Sun className="size-4" />}
                  label="Light"
                />
                <ThemeButton
                  active={theme === "dark"}
                  onClick={() => setTheme("dark")}
                  icon={<Moon className="size-4" />}
                  label="Dark"
                />
                <ThemeButton
                  active={theme === "system"}
                  onClick={() => setTheme("system")}
                  icon={<Monitor className="size-4" />}
                  label="System"
                />
              </div>
            </div>
          </section>

          {/* Model Section */}
          <section className="space-y-4">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Model
            </h2>
            <div className="bg-card border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Default Model</p>
                  <p className="text-sm text-muted-foreground">
                    Used when starting new sessions
                  </p>
                </div>
                <ModelSelector open={modelSelectorOpen} onOpenChange={setModelSelectorOpen}>
                  <ModelSelectorTrigger asChild>
                    <Button
                      variant="outline"
                      className="gap-2 min-w-[180px] justify-between"
                      disabled={modelsLoading}
                    >
                      {selectedModelInfo ? (
                        <>
                          <div className="flex items-center gap-2">
                            <ModelSelectorLogo
                              provider={selectedModelInfo.providerID as any}
                              className="size-4"
                            />
                            <span className="truncate max-w-[120px]">
                              {selectedModelInfo.name}
                            </span>
                          </div>
                        </>
                      ) : (
                        <span className="text-muted-foreground">Select model</span>
                      )}
                    </Button>
                  </ModelSelectorTrigger>
                  <ModelSelectorContent title="Select Default Model">
                    <ModelSelectorInput placeholder="Search..." />
                    <ModelSelectorList>
                      <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
                      {Object.entries(groupedModels).map(
                        ([providerID, { name, models: providerModels }]) => (
                          <ModelSelectorGroup key={providerID} heading={name}>
                            {providerModels.map((model) => (
                              <ModelSelectorItem
                                key={`${model.providerID}/${model.id}`}
                                value={`${model.providerID}/${model.id}`}
                                onSelect={() => {
                                  selectModel(model.providerID, model.id);
                                  setModelSelectorOpen(false);
                                }}
                                className="flex items-center gap-2"
                              >
                                <ModelSelectorLogo
                                  provider={model.providerID as any}
                                  className="size-4"
                                />
                                <ModelSelectorName>{model.name}</ModelSelectorName>
                              </ModelSelectorItem>
                            ))}
                          </ModelSelectorGroup>
                        )
                      )}
                    </ModelSelectorList>
                  </ModelSelectorContent>
                </ModelSelector>
              </div>
            </div>
          </section>

          {/* Data Section */}
          <section className="space-y-4">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Data
            </h2>
            <div className="bg-card border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Storage Location</p>
                <code className="text-sm font-mono bg-muted px-2 py-0.5 rounded">
                  {appInfo?.data_dir ?? "~/.dilag"}
                </code>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Storage Used</p>
                <span className="text-sm font-medium">
                  {appInfo ? formatBytes(appInfo.data_size_bytes) : "—"}
                </span>
              </div>
              <div className="pt-2 border-t">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setResetDialogOpen(true)}
                  className="gap-2"
                >
                  <RotateCcw className="size-3.5" />
                  Reset All Data
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Deletes all sessions, designs, and settings. The app will restart.
                </p>
              </div>
            </div>
          </section>

          {/* About Section */}
          <section className="space-y-4">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              About
            </h2>
            <div className="bg-card border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Version</p>
                <span className="text-sm font-medium font-mono">
                  {appInfo?.version ?? "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Updates</p>
                  {updateAvailable && updateInfo && (
                    <p className="text-sm text-primary">
                      Version {updateInfo.version} available
                    </p>
                  )}
                </div>
                {updateAvailable ? (
                  <Button
                    size="sm"
                    onClick={installUpdate}
                    disabled={downloading}
                  >
                    {downloading ? `Installing... ${downloadProgress}%` : "Install Update"}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={checkForUpdates}
                    disabled={checking}
                  >
                    {checking ? "Checking..." : "Check for Updates"}
                  </Button>
                )}
              </div>
              <div className="pt-2 border-t flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => openUrl("https://github.com/noelrohi/dilag")}
                >
                  <ExternalLink className="size-3.5" />
                  GitHub
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => openUrl("https://github.com/noelrohi/dilag#readme")}
                >
                  <ExternalLink className="size-3.5" />
                  Documentation
                </Button>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Reset Confirmation Dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset All Data?</DialogTitle>
            <DialogDescription>
              This will permanently delete all your sessions, designs, and settings.
              The app will restart after resetting. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResetDialogOpen(false)}
              disabled={resetting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleResetData}
              disabled={resetting}
            >
              {resetting ? "Resetting..." : "Reset All Data"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ThemeButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-lg border transition-all",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-card border-border hover:bg-secondary"
      )}
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}
