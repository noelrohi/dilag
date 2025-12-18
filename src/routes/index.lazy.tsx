import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSessions } from "@/hooks/use-sessions";
import { useModels } from "@/hooks/use-models";
import type { DesignFile } from "@/hooks/use-designs";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputProvider,
  PromptInputTools,
  PromptInputActionMenu,
  PromptInputActionMenuTrigger,
  PromptInputActionMenuContent,
  PromptInputActionAddAttachments,
  PromptInputAttachments,
  PromptInputAttachment,
  usePromptInputController,
} from "@/components/ai-elements/prompt-input";
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
import { ArrowRight, ChevronDown, X, ChevronRight } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";

// Mini thumbnail constants
const THUMB_RENDER_W = 393;
const THUMB_RENDER_H = 852;
const THUMB_DISPLAY_H = 72;
const THUMB_SCALE = THUMB_DISPLAY_H / THUMB_RENDER_H;

export const Route = createLazyFileRoute("/")(({
  component: LandingPage,
}));

function LandingPage() {
  const navigate = useNavigate();
  const { sessions, createSession, deleteSession, isServerReady } = useSessions();

  const handleSubmit = async (text: string, files?: import("ai").FileUIPart[]) => {
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

  const handleDeleteProject = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    await deleteSession(sessionId);
  };

  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <div className="h-dvh flex flex-col bg-background relative overflow-hidden">
      {/* Ambient background gradient */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40 dark:opacity-20"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 50% -20%, oklch(0.7 0.1 255 / 15%), transparent),
            radial-gradient(ellipse 60% 40% at 100% 100%, oklch(0.7 0.08 200 / 10%), transparent)
          `,
        }}
      />

      {/* Subtle noise texture overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.015] dark:opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Title bar drag region */}
      <div
        data-tauri-drag-region
        className="h-[38px] shrink-0 flex items-center select-none relative"
      >
        {/* Connection status */}
        {!isServerReady && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            <div className="size-1.5 rounded-full bg-amber-500/80 animate-pulse" />
            <span className="text-[10px] text-muted-foreground">
              connecting
            </span>
          </div>
        )}
      </div>

      {/* Main content */}
      <main className="relative flex-1 flex flex-col overflow-auto">
        {/* Hero section - centered prompt */}
        <div className="flex-1 flex items-center justify-center px-6 py-16">
          <div className="w-full max-w-2xl">
            {/* Hero heading */}
            <div
              className="animate-in fade-in slide-in-from-bottom-6 duration-700 text-center mb-10"
              style={{ animationFillMode: 'backwards' }}
            >
              <h1 className="text-[42px] md:text-[52px] font-medium text-foreground leading-[1.1] tracking-[-0.03em] mb-3">
                What would you like
              </h1>
              <h1 className="text-[42px] md:text-[52px] font-medium text-muted-foreground/50 leading-[1.1] tracking-[-0.03em]">
                to design?
              </h1>
            </div>

            {/* Prompt input */}
            <div
              className="animate-in fade-in slide-in-from-bottom-6 duration-700"
              style={{ animationDelay: '100ms', animationFillMode: 'backwards' }}
            >
              <PromptInputProvider>
                <ComposerInput onSubmit={handleSubmit} disabled={!isServerReady} />
              </PromptInputProvider>
            </div>
          </div>
        </div>

        {/* Recent projects - bottom section */}
        {sortedSessions.length > 0 && (
          <div
            className="px-6 pb-8 animate-in fade-in slide-in-from-bottom-4 duration-500"
            style={{ animationDelay: '200ms', animationFillMode: 'backwards' }}
          >
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center gap-4 mb-5">
                <div className="h-px flex-1 bg-border/50" />
                <span className="text-[10px] text-muted-foreground/50 uppercase tracking-[0.2em] font-medium">
                  Recent work
                </span>
                <div className="h-px flex-1 bg-border/50" />
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

              {/* View all link */}
              {sortedSessions.length > 4 && (
                <ViewAllButton count={sortedSessions.length} />
              )}
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
  const [designs, setDesigns] = useState<DesignFile[]>([]);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (!session.cwd) return;
    invoke<DesignFile[]>("load_session_designs", { sessionCwd: session.cwd })
      .then(setDesigns)
      .catch(() => setDesigns([]));
  }, [session.cwd]);

  const previewDesigns = designs;

  return (
    <button
      onClick={onOpen}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "group relative text-left p-3 rounded-xl transition-all duration-300 ease-out",
        "bg-card/50 border border-border/50",
        "hover:bg-card hover:border-border hover:shadow-lg hover:shadow-black/[0.03]",
        "dark:hover:shadow-black/20",
        "animate-in fade-in slide-in-from-bottom-2 duration-300"
      )}
      style={{ animationDelay: `${150 + delay}ms`, animationFillMode: 'backwards' }}
    >
      {/* Screen previews */}
      <div className="flex gap-1 mb-3 h-[72px] overflow-x-auto overflow-y-hidden rounded-lg bg-muted/30 scrollbar-none p-1.5">
        {previewDesigns.length > 0 ? (
          previewDesigns.map((design, i) => (
            <ScreenThumbnail key={i} html={design.html} isHovered={isHovered} index={i} />
          ))
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-[10px] text-muted-foreground/50 font-medium">
              No screens yet
            </span>
          </div>
        )}
      </div>

      {/* Title and meta */}
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
            "hover:bg-destructive/10 hover:text-destructive"
          )}
        >
          <X className="size-3" />
        </button>
      </div>
    </button>
  );
}

function ScreenThumbnail({
  html,
  isHovered,
  index
}: {
  html: string;
  isHovered: boolean;
  index: number;
}) {
  const srcDoc = useMemo(() => {
    if (!html) return null;

    const sizingCSS = `
      <style>
        html, body {
          width: ${THUMB_RENDER_W}px !important;
          height: ${THUMB_RENDER_H}px !important;
          overflow: hidden !important;
          margin: 0 !important;
          padding: 0 !important;
        }
      </style>
    `;

    if (html.includes("<!DOCTYPE") || html.includes("<html")) {
      if (html.includes("</head>")) {
        return html.replace("</head>", `${sizingCSS}</head>`);
      }
      return sizingCSS + html;
    }

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  ${sizingCSS}
</head>
<body>
${html}
</body>
</html>`;
  }, [html]);

  if (!srcDoc) return null;

  const displayW = THUMB_RENDER_W * THUMB_SCALE;

  return (
    <div
      className={cn(
        "shrink-0 overflow-hidden rounded-md bg-card shadow-sm",
        "ring-1 ring-border/30 transition-all duration-300 ease-out"
      )}
      style={{
        width: displayW,
        height: THUMB_DISPLAY_H,
        transform: isHovered ? `translateY(-${index * 1}px)` : 'none',
        transitionDelay: `${index * 30}ms`
      }}
    >
      <iframe
        srcDoc={srcDoc}
        className="border-0 origin-top-left pointer-events-none"
        style={{
          width: THUMB_RENDER_W,
          height: THUMB_RENDER_H,
          transform: `scale(${THUMB_SCALE})`,
        }}
        sandbox="allow-scripts allow-same-origin"
        tabIndex={-1}
      />
    </div>
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
        "rounded-xl bg-card/60 backdrop-blur-sm",
        "border border-border/40 shadow-lg shadow-black/5",
        "transition-all duration-300 ease-out",
        "focus-within:border-border/60 focus-within:shadow-xl focus-within:shadow-black/10",
        "dark:bg-card/40 dark:shadow-black/20 dark:focus-within:shadow-black/30"
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
            "placeholder:text-muted-foreground/30"
          )}
        />
      </PromptInputBody>
      <PromptInputFooter className="border-t-0">
        {/* Left side - attachment action menu */}
        <PromptInputTools>
          <PromptInputActionMenu>
            <PromptInputActionMenuTrigger />
            <PromptInputActionMenuContent>
              <PromptInputActionAddAttachments />
            </PromptInputActionMenuContent>
          </PromptInputActionMenu>
        </PromptInputTools>

        <div className="flex-1" />

        {/* Right side - model selector + submit */}
        <div className="flex items-center gap-1">
          <ModelSelectorButton />
          <PromptInputSubmit
            disabled={!hasInput || disabled}
            className={cn(
              "size-8 rounded-lg transition-all duration-200",
              hasInput && !disabled
                ? "bg-foreground text-background shadow-sm"
                : "bg-muted/50 text-muted-foreground/50"
            )}
          >
            <ArrowRight className="size-4" />
          </PromptInputSubmit>
        </div>
      </PromptInputFooter>
    </PromptInput>
  );
}

function ModelSelectorButton() {
  const { models, selectedModelInfo, selectModel, isLoading } = useModels();
  const [open, setOpen] = useState(false);

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

  return (
    <ModelSelector open={open} onOpenChange={setOpen}>
      <ModelSelectorTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 px-2.5 text-[11px] text-muted-foreground hover:text-foreground border-border/60"
          disabled={isLoading}
        >
          {selectedModelInfo ? (
            <>
              <ModelSelectorLogo
                provider={selectedModelInfo.providerID as any}
                className="size-3"
              />
              <span className="max-w-[100px] truncate font-medium">
                {selectedModelInfo.name}
              </span>
            </>
          ) : (
            <span className="font-medium">Select model</span>
          )}
          <ChevronDown className="size-3 opacity-40" />
        </Button>
      </ModelSelectorTrigger>
      <ModelSelectorContent title="Select Model">
        <ModelSelectorInput placeholder="Search models..." />
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
                      setOpen(false);
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
  );
}

function ViewAllButton({ count }: { count: number }) {
  const { toggleSidebar } = useSidebar();

  return (
    <button
      onClick={toggleSidebar}
      className={cn(
        "mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg",
        "text-[12px] text-muted-foreground/70 font-medium",
        "hover:text-muted-foreground hover:bg-muted/30",
        "transition-colors duration-200"
      )}
    >
      <span>View all {count} projects</span>
      <ChevronRight className="size-3.5" />
    </button>
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
