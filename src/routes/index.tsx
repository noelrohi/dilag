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
import { useSessions } from "@/hooks/use-sessions";
import { cn } from "@/lib/utils";
import { ArrowUpIcon } from "@phosphor-icons/react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronRight, X } from "lucide-react";

const SUGGESTIONS = [
  "Design a habit tracking app",
  "Create a recipe finder",
  "Build a workout timer",
  "Make a notes app",
];

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  const navigate = useNavigate();
  const { sessions, createSession, deleteSession, isServerReady } =
    useSessions();

  const handleSubmit = async (
    text: string,
    files?: import("ai").FileUIPart[],
  ) => {
    if (!text.trim() && (!files || files.length === 0)) return;
    localStorage.setItem("dilag-initial-prompt", text);
    if (files && files.length > 0) {
      localStorage.setItem("dilag-initial-files", JSON.stringify(files));
    } else {
      localStorage.removeItem("dilag-initial-files");
    }
    const sessionId = await createSession();
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
              <h1 className="text-[42px] md:text-[52px] font-medium text-foreground leading-[1.1] tracking-[-0.03em] mb-3">
                What would you like
              </h1>
              <h1 className="text-[42px] md:text-[52px] font-medium text-muted-foreground/50 leading-[1.1] tracking-[-0.03em]">
                to design?
              </h1>
            </div>

            <div
              className="animate-in fade-in slide-in-from-bottom-6 duration-700"
              style={{
                animationDelay: "100ms",
                animationFillMode: "backwards",
              }}
            >
              <PromptInputProvider>
                <ComposerInput
                  onSubmit={handleSubmit}
                  disabled={!isServerReady}
                />
              </PromptInputProvider>

              <div className="flex flex-wrap justify-center gap-2 mt-4">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => handleSubmit(suggestion)}
                    disabled={!isServerReady}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-[13px]",
                      "bg-muted/50 hover:bg-muted border border-border/50",
                      "text-muted-foreground hover:text-foreground",
                      "transition-colors duration-200",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                    )}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {sortedSessions.length > 0 && (
          <div
            className="px-6 pb-8 animate-in fade-in slide-in-from-bottom-4 duration-500"
            style={{ animationDelay: "200ms", animationFillMode: "backwards" }}
          >
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[13px] font-medium text-muted-foreground">
                  Recent projects
                </h2>
                {sortedSessions.length > 4 && (
                  <button
                    onClick={() => navigate({ to: "/projects" })}
                    className="flex items-center gap-1 text-[12px] text-muted-foreground/70 hover:text-foreground transition-colors duration-200 group"
                  >
                    <span>View all</span>
                    <ChevronRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {sortedSessions.slice(0, 4).map((session, i) => (
                  <ProjectCard
                    key={session.id}
                    session={session}
                    onOpen={() => handleOpenProject(session.id)}
                    onDelete={(e) => handleDeleteProject(e, session.id)}
                    delay={i * 50}
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
}

function ProjectCard({
  session,
  onOpen,
  onDelete,
  delay = 0,
}: {
  session: SessionMeta;
  onOpen: () => void;
  onDelete: (e: React.MouseEvent) => void;
  delay?: number;
}) {
  return (
    <button
      onClick={onOpen}
      className={cn(
        "group relative text-left p-3 rounded-xl transition-all duration-300 ease-out",
        "bg-card/50 border border-border/50",
        "hover:bg-card hover:border-border hover:shadow-lg hover:shadow-black/[0.03]",
        "dark:hover:shadow-black/20",
        "animate-in fade-in slide-in-from-bottom-2 duration-300",
      )}
      style={{
        animationDelay: `${150 + delay}ms`,
        animationFillMode: "backwards",
      }}
    >
      <div className="flex gap-1 mb-3 h-[72px] overflow-hidden rounded-lg bg-muted/30 p-1.5">
        <div className="flex-1 flex items-center justify-center">
          <span className="text-[10px] text-muted-foreground/50 font-medium">
            {session.name || "Untitled"}
          </span>
        </div>
      </div>

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-foreground truncate leading-tight">
            {session.name || "Untitled"}
          </p>
          <p className="text-[11px] text-muted-foreground/70 mt-0.5">
            {formatDate(session.created_at)}
          </p>
        </div>
        <button
          onClick={onDelete}
          className={cn(
            "p-1.5 rounded-md transition-all duration-200 shrink-0",
            "opacity-0 group-hover:opacity-100",
            "hover:bg-destructive/10 hover:text-destructive",
          )}
        >
          <X className="size-3" />
        </button>
      </div>
    </button>
  );
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
    <PromptInput
      onSubmit={async ({ text, files }) => onSubmit(text, files)}
      className={cn(
        "[&_[data-slot=input-group]]:rounded-xl [&_[data-slot=input-group]]:border-border/40",
        "[&_[data-slot=input-group]]:bg-card/60 [&_[data-slot=input-group]]:backdrop-blur-sm",
        "[&_[data-slot=input-group]]:shadow-lg [&_[data-slot=input-group]]:shadow-black/5",
        "[&_[data-slot=input-group]]:transition-all [&_[data-slot=input-group]]:duration-300",
        "[&_[data-slot=input-group]]:focus-within:border-border/60 [&_[data-slot=input-group]]:focus-within:shadow-xl",
        "[&_[data-slot=input-group]]:focus-within:ring-2 [&_[data-slot=input-group]]:focus-within:ring-primary/20",
        "dark:[&_[data-slot=input-group]]:bg-card/40",
      )}
    >
      <PromptInputAttachments>
        {(attachment) => <PromptInputAttachment data={attachment} />}
      </PromptInputAttachments>
      <PromptInputBody>
        <PromptInputTextarea
          placeholder="Describe your app idea..."
          disabled={disabled}
          className={cn(
            "min-h-[100px] max-h-[200px]",
            "text-[15px] leading-relaxed",
            "placeholder:text-muted-foreground/30",
          )}
        />
      </PromptInputBody>
      <PromptInputFooter className="border-t-0">
        <PromptInputTools>
          <PromptInputActionMenu>
            <PromptInputActionMenuTrigger />
            <PromptInputActionMenuContent>
              <PromptInputActionAddAttachments />
            </PromptInputActionMenuContent>
          </PromptInputActionMenu>
        </PromptInputTools>

        <div className="flex-1" />

        <div className="flex items-center gap-1">
          <ModelSelectorButton />
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

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
