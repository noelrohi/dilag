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
import { ArrowRight, ChevronDown, X } from "lucide-react";

// Mini thumbnail constants
const THUMB_RENDER_W = 393;
const THUMB_RENDER_H = 852;
const THUMB_DISPLAY_H = 80;
const THUMB_SCALE = THUMB_DISPLAY_H / THUMB_RENDER_H;

export const Route = createLazyFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  const navigate = useNavigate();
  const { sessions, createSession, deleteSession, isServerReady } = useSessions();

  const handleSubmit = async (text: string) => {
    if (!text.trim()) return;
    localStorage.setItem("dilag-initial-prompt", text);
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
    <div className="h-dvh flex flex-col bg-background">
      {/* Minimal header */}
      <header className="px-6 py-5 flex items-center justify-between">
        <span className="text-[13px] font-medium tracking-tight text-foreground">
          dilag
        </span>
        {!isServerReady && (
          <span className="text-[11px] text-muted-foreground">
            connecting...
          </span>
        )}
      </header>

      {/* Main content - vertically centered */}
      <main className="flex-1 flex items-center justify-center px-6 pb-24">
        <div className="w-full max-w-xl">
          {/* Single line prompt */}
          <p className="text-muted-foreground text-[13px] mb-4 tracking-wide">
            What would you like to design?
          </p>

          <PromptInputProvider>
            <ComposerInput onSubmit={handleSubmit} disabled={!isServerReady} />
          </PromptInputProvider>

          {/* Recent projects with screen previews */}
          {sortedSessions.length > 0 && (
            <div className="mt-16">
              <p className="text-[11px] text-muted-foreground uppercase tracking-widest mb-6">
                Recent
              </p>
              <div className="grid grid-cols-2 gap-4">
                {sortedSessions.slice(0, 4).map((session) => (
                  <ProjectCard
                    key={session.id}
                    session={session}
                    onOpen={() => handleOpenProject(session.id)}
                    onDelete={(e) => handleDeleteProject(e, session.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
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
}: {
  session: SessionMeta;
  onOpen: () => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  const [designs, setDesigns] = useState<DesignFile[]>([]);

  useEffect(() => {
    if (!session.cwd) return;
    invoke<DesignFile[]>("load_session_designs", { sessionCwd: session.cwd })
      .then(setDesigns)
      .catch(() => setDesigns([]));
  }, [session.cwd]);

  // Show all designs
  const previewDesigns = designs;

  return (
    <button
      onClick={onOpen}
      className="group relative text-left p-3 rounded-lg border border-border bg-card hover:bg-secondary/50 transition-all duration-200"
    >
      {/* Screen previews - horizontal scroll */}
      <div className="flex gap-1.5 mb-3 h-20 overflow-x-auto overflow-y-hidden rounded-md bg-muted/50 scrollbar-none">
        {previewDesigns.length > 0 ? (
          previewDesigns.map((design, i) => (
            <ScreenThumbnail key={i} html={design.html} />
          ))
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-[10px] text-muted-foreground">No screens</span>
          </div>
        )}
      </div>

      {/* Title and meta */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-foreground truncate">
            {session.name || "Untitled"}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {formatDate(session.created_at)}
          </p>
        </div>
        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted rounded transition-all shrink-0"
        >
          <X className="size-3 text-muted-foreground" />
        </button>
      </div>
    </button>
  );
}

function ScreenThumbnail({ html }: { html: string }) {
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
      className="shrink-0 overflow-hidden rounded-sm bg-card"
      style={{ width: displayW, height: THUMB_DISPLAY_H }}
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
  onSubmit: (text: string) => void;
  disabled: boolean;
}) {
  const { textInput } = usePromptInputController();
  const hasInput = textInput.value.trim().length > 0;

  return (
    <PromptInput
      onSubmit={async ({ text }) => onSubmit(text)}
      className="rounded-xl bg-card border border-border shadow-sm"
    >
      <PromptInputBody>
        <PromptInputTextarea
          placeholder="A dashboard for tracking daily habits..."
          disabled={disabled}
          className="min-h-[80px] max-h-[160px] text-[14px] leading-relaxed placeholder:text-muted-foreground/50"
        />
      </PromptInputBody>
      <PromptInputFooter className="border-t border-border">
        <ModelSelectorButton />
        <PromptInputSubmit
          disabled={!hasInput || disabled}
          className={cn(
            "size-8 rounded-lg transition-all duration-200",
            hasInput && !disabled
              ? "bg-foreground text-background"
              : "bg-muted text-muted-foreground"
          )}
        >
          <ArrowRight className="size-4" />
        </PromptInputSubmit>
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
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-[12px] text-muted-foreground hover:text-foreground"
          disabled={isLoading}
        >
          {selectedModelInfo ? (
            <>
              <ModelSelectorLogo
                provider={selectedModelInfo.providerID as any}
                className="size-3.5"
              />
              <span className="max-w-[120px] truncate">
                {selectedModelInfo.name}
              </span>
            </>
          ) : (
            <span>Model</span>
          )}
          <ChevronDown className="size-3 opacity-50" />
        </Button>
      </ModelSelectorTrigger>
      <ModelSelectorContent title="Select Model">
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

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
