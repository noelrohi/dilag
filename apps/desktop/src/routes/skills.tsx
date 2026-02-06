import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  MagicStick,
  TrashBinMinimalistic,
  DownloadMinimalistic,
  SquareArrowRightUp,
  Refresh,
  CheckCircle,
  CloseCircle,
  Magnifer,
} from "@solar-icons/react";
import { PageHeader } from "@/components/blocks/layout/page-header";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@dilag/ui/dialog";

export const Route = createFileRoute("/skills")({
  component: SkillsPage,
});

interface SkillInfo {
  name: string;
  path: string;
  is_symlink: boolean;
}

interface SkillPreview {
  name: string;
  description: string;
}

interface SkillPreviewResult {
  success: boolean;
  skills: SkillPreview[];
  error: string | null;
}

interface SkillInstallResult {
  success: boolean;
  installed: string[];
  error: string | null;
}

function SkillsPage() {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [sourceInput, setSourceInput] = useState("");
  const [removeDialog, setRemoveDialog] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  // Preview state
  const [previewing, setPreviewing] = useState(false);
  const [previewSource, setPreviewSource] = useState<string | null>(null);
  const [previewSkills, setPreviewSkills] = useState<SkillPreview[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Install state
  const [installing, setInstalling] = useState(false);
  const [installStatus, setInstallStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const loadSkills = useCallback(async () => {
    try {
      const result = await invoke<SkillInfo[]>("list_installed_skills");
      setSkills(result);
    } catch (error) {
      console.error("Failed to load skills:", error);
    }
  }, []);

  useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  const handlePreview = async (e: React.FormEvent) => {
    e.preventDefault();
    const source = sourceInput.trim();
    if (!source || previewing) return;

    setPreviewing(true);
    setPreviewError(null);
    setPreviewSkills([]);
    setSelectedSkills(new Set());
    setInstallStatus(null);

    try {
      const result = await invoke<SkillPreviewResult>("preview_skills", {
        source,
      });

      if (result.success && result.skills.length > 0) {
        setPreviewSource(source);
        setPreviewSkills(result.skills);
        // Select all by default
        setSelectedSkills(new Set(result.skills.map((s) => s.name)));
      } else if (result.success && result.skills.length === 0) {
        setPreviewError("No skills found in this source");
      } else {
        setPreviewError(result.error || "Failed to fetch skills");
      }
    } catch (error) {
      setPreviewError(String(error));
    } finally {
      setPreviewing(false);
    }
  };

  const toggleSkill = (name: string) => {
    setSelectedSkills((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedSkills.size === previewSkills.length) {
      setSelectedSkills(new Set());
    } else {
      setSelectedSkills(new Set(previewSkills.map((s) => s.name)));
    }
  };

  const handleInstall = async () => {
    if (!previewSource || selectedSkills.size === 0 || installing) return;

    setInstalling(true);
    setInstallStatus(null);

    try {
      const result = await invoke<SkillInstallResult>("install_skill", {
        source: previewSource,
        skillNames: Array.from(selectedSkills),
      });

      if (result.success) {
        const count = result.installed.length;
        setInstallStatus({
          type: "success",
          message: `Installed ${count} skill${count !== 1 ? "s" : ""}`,
        });
        // Reset preview state
        setPreviewSkills([]);
        setPreviewSource(null);
        setSelectedSkills(new Set());
        setSourceInput("");
        await loadSkills();
      } else {
        setInstallStatus({
          type: "error",
          message: result.error || "Installation failed",
        });
      }
    } catch (error) {
      setInstallStatus({ type: "error", message: String(error) });
    } finally {
      setInstalling(false);
    }
  };

  const handleCancelPreview = () => {
    setPreviewSkills([]);
    setPreviewSource(null);
    setSelectedSkills(new Set());
    setPreviewError(null);
  };

  const handleRemove = async (skillName: string) => {
    setRemoving(true);
    try {
      await invoke("remove_skill", { skillName });
      await loadSkills();
      setRemoveDialog(null);
    } catch (error) {
      console.error("Failed to remove skill:", error);
    } finally {
      setRemoving(false);
    }
  };

  const builtinSkills = ["mobile-design", "web-design"];

  return (
    <div className="h-dvh flex flex-col bg-background">
      <PageHeader />
      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            {/* Header */}
            <header className="px-1 mb-8">
              <h1 className="text-xl font-semibold text-foreground">Skills</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Install reusable capabilities for your AI agent
              </p>
            </header>

            {/* Install Section */}
            <section className="mb-8">
              <div className="flex items-center gap-2.5 px-1 mb-3">
                <span className="text-muted-foreground">
                  <DownloadMinimalistic size={16} />
                </span>
                <h2 className="text-sm font-medium text-foreground">
                  Add Skills
                </h2>
              </div>
              <div className="rounded-xl bg-card border border-border/50 overflow-hidden">
                {/* Source input */}
                <form onSubmit={handlePreview} className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      placeholder="owner/repo (e.g. vercel-labs/agent-skills)"
                      value={sourceInput}
                      onChange={(e) => setSourceInput(e.target.value)}
                      disabled={previewing || installing}
                      className={cn(
                        "flex-1 h-9 px-3 rounded-lg text-sm",
                        "bg-muted/50 border-none",
                        "placeholder:text-muted-foreground/40",
                        "focus:outline-none focus:ring-2 focus:ring-ring/20",
                        "transition-all disabled:opacity-50"
                      )}
                    />
                    <button
                      type="submit"
                      disabled={!sourceInput.trim() || previewing || installing}
                      className={cn(
                        "px-4 h-9 rounded-lg text-sm font-medium shrink-0",
                        "bg-secondary text-secondary-foreground",
                        "hover:bg-secondary/80 transition-colors",
                        "disabled:opacity-50 disabled:pointer-events-none",
                        "flex items-center gap-2"
                      )}
                    >
                      <Magnifer size={14} />
                      {previewing ? "Searching..." : "Search"}
                    </button>
                  </div>

                  {previewError && (
                    <div className="flex items-center gap-2 mt-3 px-1 text-xs text-destructive">
                      <CloseCircle size={14} />
                      <span className="truncate">{previewError}</span>
                    </div>
                  )}

                  {installStatus && (
                    <div
                      className={cn(
                        "flex items-center gap-2 mt-3 px-1 text-xs",
                        installStatus.type === "success"
                          ? "text-emerald-500"
                          : "text-destructive"
                      )}
                    >
                      {installStatus.type === "success" ? (
                        <CheckCircle size={14} />
                      ) : (
                        <CloseCircle size={14} />
                      )}
                      <span className="truncate">{installStatus.message}</span>
                    </div>
                  )}
                </form>

                {/* Preview results */}
                {previewSkills.length > 0 && (
                  <div className="border-t border-border/50">
                    <div className="px-4 py-2 flex items-center justify-between">
                      <button
                        onClick={toggleAll}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {selectedSkills.size === previewSkills.length
                          ? "Deselect all"
                          : "Select all"}
                      </button>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {selectedSkills.size} of {previewSkills.length} selected
                      </span>
                    </div>
                    <div className="px-4 pb-1">
                      {previewSkills.map((skill, i) => (
                        <div key={skill.name}>
                          <label className="flex items-start gap-3 py-3 px-1 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={selectedSkills.has(skill.name)}
                              onChange={() => toggleSkill(skill.name)}
                              className="mt-0.5 rounded border-border"
                            />
                            <div className="min-w-0 flex-1">
                              <span className="text-sm font-medium text-foreground">
                                {skill.name}
                              </span>
                              {skill.description && (
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                  {skill.description}
                                </p>
                              )}
                            </div>
                          </label>
                          {i < previewSkills.length - 1 && (
                            <div className="h-px bg-border/50 -mx-1" />
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="px-4 py-3 border-t border-border/50 flex items-center gap-2">
                      <button
                        onClick={handleInstall}
                        disabled={selectedSkills.size === 0 || installing}
                        className={cn(
                          "px-4 h-9 rounded-lg text-sm font-medium",
                          "bg-primary text-primary-foreground",
                          "hover:bg-primary/90 transition-colors",
                          "disabled:opacity-50 disabled:pointer-events-none"
                        )}
                      >
                        {installing
                          ? "Installing..."
                          : `Install ${selectedSkills.size} skill${selectedSkills.size !== 1 ? "s" : ""}`}
                      </button>
                      <button
                        onClick={handleCancelPreview}
                        disabled={installing}
                        className={cn(
                          "px-4 h-9 rounded-lg text-sm font-medium",
                          "text-muted-foreground",
                          "hover:bg-secondary transition-colors",
                          "disabled:opacity-50"
                        )}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 px-1 mt-3">
                <button
                  onClick={() => openUrl("https://skills.sh")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md",
                    "text-xs text-muted-foreground",
                    "bg-muted/50 hover:bg-muted hover:text-foreground",
                    "transition-colors"
                  )}
                >
                  Browse Skills Directory
                  <SquareArrowRightUp size={12} />
                </button>
              </div>
            </section>

            {/* Installed Skills */}
            <section className="mb-8">
              <div className="flex items-center gap-2.5 px-1 mb-3">
                <span className="text-muted-foreground">
                  <MagicStick size={16} />
                </span>
                <h2 className="text-sm font-medium text-foreground">
                  Installed Skills
                </h2>
                <span className="text-muted-foreground/30">·</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {skills.length}
                </span>
                <button
                  onClick={loadSkills}
                  className="ml-auto p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                >
                  <Refresh size={14} />
                </button>
              </div>

              {skills.length === 0 ? (
                <div className="rounded-xl bg-card border border-border/50 overflow-hidden">
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="size-10 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                      <MagicStick
                        size={18}
                        className="text-muted-foreground/40"
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      No skills installed
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      Install skills to enhance your AI agent
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl bg-card border border-border/50 overflow-hidden">
                  <div className="px-4 py-1">
                    {skills.map((skill, i) => {
                      const isBuiltin = builtinSkills.includes(skill.name);
                      return (
                        <div key={skill.name}>
                          <div className="flex items-center justify-between min-h-[52px] py-2 px-1 group">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-foreground font-medium">
                                  {skill.name}
                                </span>
                                {isBuiltin && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                    built-in
                                  </span>
                                )}
                              </div>
                            </div>
                            {!isBuiltin && (
                              <button
                                onClick={() => setRemoveDialog(skill.name)}
                                className={cn(
                                  "p-1.5 rounded-lg",
                                  "text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10",
                                  "opacity-0 group-hover:opacity-100",
                                  "transition-all duration-200"
                                )}
                              >
                                <TrashBinMinimalistic size={14} />
                              </button>
                            )}
                          </div>
                          {i < skills.length - 1 && (
                            <div className="h-px bg-border/50 -mx-1" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </main>

      {/* Remove Dialog */}
      <Dialog
        open={removeDialog !== null}
        onOpenChange={() => setRemoveDialog(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove Skill?</DialogTitle>
            <DialogDescription>
              This will remove the "{removeDialog}" skill. You can reinstall it
              later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-2">
            <button
              onClick={() => setRemoveDialog(null)}
              disabled={removing}
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
              onClick={() => removeDialog && handleRemove(removeDialog)}
              disabled={removing}
              className={cn(
                "flex-1 h-10 rounded-lg text-sm font-medium",
                "bg-destructive text-destructive-foreground",
                "hover:bg-destructive/90 transition-colors",
                "disabled:opacity-50"
              )}
            >
              {removing ? "Removing..." : "Remove"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
