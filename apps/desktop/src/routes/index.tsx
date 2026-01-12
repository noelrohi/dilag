import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputAttachment,
  PromptInputAttachments,
  PromptInputBody,
  PromptInputFooter,
  PromptInputProvider,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputController,
} from "@/components/ai-elements/prompt-input";
import { ModelSelectorButton } from "@/components/blocks/model-selector-button";
import { AgentSelectorButton } from "@/components/blocks/agent-selector-button";
import { ThinkingModeSelector } from "@/components/blocks/thinking-mode-selector";
import { useSessions } from "@/hooks/use-sessions";
import { type Platform } from "@/context/session-store";
import { cn } from "@/lib/utils";
import { ArrowUpIcon, Desktop, DeviceMobile } from "@phosphor-icons/react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { X } from "lucide-react";

const SUGGESTIONS = [
  { text: "A habit tracking app", color: "from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 hover:border-emerald-400/50" },
  { text: "A recipe finder with search", color: "from-amber-500/20 to-amber-600/10 border-amber-500/30 hover:border-amber-400/50" },
  { text: "A workout timer", color: "from-rose-500/20 to-rose-600/10 border-rose-500/30 hover:border-rose-400/50" },
  { text: "A notes app with markdown", color: "from-violet-500/20 to-violet-600/10 border-violet-500/30 hover:border-violet-400/50" },
];

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  const navigate = useNavigate();
  const { sessions, createSession, deleteSession, isServerReady } =
    useSessions();
  const [platform, setPlatform] = useQueryState(
    "platform",
    parseAsStringLiteral(["web", "mobile"] as const).withDefault("web")
  );

  const handleSubmit = async (
    text: string,
    files?: import("ai").FileUIPart[],
  ) => {
    if (!text.trim() && (!files || files.length === 0)) return;
    localStorage.setItem("dilag-initial-prompt", text);
    localStorage.setItem("dilag-initial-platform", platform);
    if (files && files.length > 0) {
      localStorage.setItem("dilag-initial-files", JSON.stringify(files));
    } else {
      localStorage.removeItem("dilag-initial-files");
    }
    const sessionId = await createSession(undefined, platform);
    if (sessionId) {
      navigate({ to: "/studio/$sessionId", params: { sessionId } });
    }
  };

  const handleOpenProject = (sessionId: string) => {
    navigate({ to: "/studio/$sessionId", params: { sessionId } });
  };

  const handleDeleteProject = async (
    e: React.MouseEvent,
    sessionId: string,
  ) => {
    e.stopPropagation();
    await deleteSession(sessionId);
  };

  const sortedSessions = [...sessions].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return (
    <div className="h-dvh flex flex-col bg-background relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none opacity-40 dark:opacity-20"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 50% -20%, oklch(0.7 0.1 255 / 15%), transparent),
            radial-gradient(ellipse 60% 40% at 100% 100%, oklch(0.7 0.08 200 / 10%), transparent)
          `,
        }}
      />

      <div
        className="absolute inset-0 pointer-events-none opacity-[0.015] dark:opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      <div
        data-tauri-drag-region
        className="h-[38px] shrink-0 flex items-center select-none relative"
      >
        {!isServerReady && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            <div className="size-1.5 rounded-full bg-amber-500/80 animate-pulse" />
            <span className="text-[10px] text-muted-foreground">
              connecting
            </span>
          </div>
        )}
      </div>

      <main className="relative flex-1 flex flex-col overflow-auto">
        <div className="flex-1 flex items-center justify-center px-6 py-16">
          <div className="w-full max-w-2xl">
            <div
              className="animate-in fade-in slide-in-from-bottom-6 duration-700 text-center mb-10"
              style={{ animationFillMode: "backwards" }}
            >
              <h1 className="text-[42px] md:text-[52px] font-medium leading-[1.1] tracking-[-0.03em] whitespace-nowrap text-balance">
                <span className="text-foreground">What would you like</span>{" "}
                <span className="text-muted-foreground/50">to design?</span>
              </h1>
            </div>

            <div
              className="animate-in fade-in slide-in-from-bottom-6 duration-700"
              style={{
                animationDelay: "100ms",
                animationFillMode: "backwards",
              }}
            >
              <PlatformToggle value={platform} onChange={setPlatform} />

              <PromptInputProvider>
                <ComposerInput
                  onSubmit={handleSubmit}
                  disabled={!isServerReady}
                />
              </PromptInputProvider>

              <div className="flex flex-wrap justify-center gap-2 mt-6">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion.text}
                    onClick={() => handleSubmit(suggestion.text)}
                    disabled={!isServerReady}
                    className={cn(
                      "px-3.5 py-1.5 text-[13px] font-medium",
                      "bg-gradient-to-br border rounded-lg",
                      "text-foreground/90 hover:text-foreground",
                      "hover:scale-[1.02] active:scale-[0.98]",
                      "transition-all duration-200",
                      "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100",
                      suggestion.color,
                    )}
                  >
                    {suggestion.text}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {sortedSessions.length > 0 && (
          <div
            className="px-6 pb-10 animate-in fade-in slide-in-from-bottom-4 duration-500"
            style={{ animationDelay: "200ms", animationFillMode: "backwards" }}
          >
            <div className="max-w-3xl mx-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[13px] font-medium text-muted-foreground/70">
                  Recent Projects
                </h2>
                {sortedSessions.length > 6 && (
                  <button
                    onClick={() => navigate({ to: "/projects" })}
                    className="text-[12px] text-muted-foreground/50 hover:text-foreground transition-colors duration-150"
                  >
                    View all ({sortedSessions.length})
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {sortedSessions.slice(0, 6).map((session) => (
                  <ProjectCard
                    key={session.id}
                    session={session}
                    onOpen={() => handleOpenProject(session.id)}
                    onDelete={(e) => handleDeleteProject(e, session.id)}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

interface SessionMeta {
  id: string;
  name: string;
  created_at: string;
  cwd: string;
  platform?: Platform;
}

function ProjectCard({
  session,
  onOpen,
  onDelete,
}: {
  session: SessionMeta;
  onOpen: () => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  const date = new Date(session.created_at);
  const timeAgo = getTimeAgo(date);

  return (
    <div
      onClick={onOpen}
      className={cn(
        "group relative text-left p-3 rounded-lg cursor-pointer",
        "bg-card/40 border border-border/30",
        "hover:bg-card/60 hover:border-border/50",
        "transition-all duration-200",
      )}
    >
      <button
        onClick={onDelete}
        className={cn(
          "absolute top-2 right-2 p-1 rounded-md",
          "opacity-0 group-hover:opacity-100",
          "text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10",
          "transition-all duration-150",
        )}
      >
        <X className="size-3" />
      </button>
      <div className="pr-6">
        <h3 className="text-[13px] font-medium text-foreground/90 truncate">
          {session.name || "Untitled"}
        </h3>
        <p className="text-[11px] text-muted-foreground/50 mt-0.5">
          {timeAgo}
        </p>
      </div>
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function ComposerInput({
  onSubmit,
  disabled,
}: {
  onSubmit: (text: string, files?: import("ai").FileUIPart[]) => void;
  disabled: boolean;
}) {
  const { textInput } = usePromptInputController();
  const hasInput = textInput.value.trim().length > 0;

  return (
    <PromptInput onSubmit={async ({ text, files }) => onSubmit(text, files)}>
      <PromptInputAttachments>
        {(attachment) => <PromptInputAttachment data={attachment} />}
      </PromptInputAttachments>
      <PromptInputBody>
        <PromptInputTextarea
          placeholder="Describe your app..."
          disabled={disabled}
          className="min-h-[100px] max-h-[200px]"
        />
      </PromptInputBody>
      <PromptInputFooter className="border-t-0">
        {/* Left side - agent selector, model selector, thinking mode */}
        <PromptInputTools>
          <AgentSelectorButton />
          <ModelSelectorButton />
          <ThinkingModeSelector />
        </PromptInputTools>

        <div className="flex-1" />

        {/* Right side - attachment menu + submit */}
        <div className="flex items-center gap-1">
          <PromptInputActionMenu>
            <PromptInputActionMenuTrigger />
            <PromptInputActionMenuContent>
              <PromptInputActionAddAttachments />
            </PromptInputActionMenuContent>
          </PromptInputActionMenu>
          <PromptInputSubmit
            disabled={!hasInput || disabled}
            className={cn(
              "size-9 rounded-xl transition-all duration-200",
              hasInput && !disabled
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                : "bg-muted text-muted-foreground",
            )}
          >
            <ArrowUpIcon className="size-4" />
          </PromptInputSubmit>
        </div>
      </PromptInputFooter>
    </PromptInput>
  );
}

function PlatformToggle({
  value,
  onChange,
}: {
  value: Platform;
  onChange: (platform: Platform) => void;
}) {
  return (
    <div className="flex justify-center mb-6">
      <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-muted/50 border border-border/30">
        <button
          onClick={() => onChange("web")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200",
            value === "web"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Desktop className="size-4" />
          Web
        </button>
        <button
          onClick={() => onChange("mobile")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200",
            value === "mobile"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <DeviceMobile className="size-4" />
          Mobile
        </button>
      </div>
    </div>
  );
}

