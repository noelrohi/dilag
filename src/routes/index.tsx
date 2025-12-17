import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useSessions } from "@/hooks/use-sessions";
import { useModels } from "@/hooks/use-models";
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
import { ArrowRight, ChevronDown, Folder, Sparkles, Trash2 } from "lucide-react";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  const navigate = useNavigate();
  const { sessions, createSession, deleteSession, isServerReady } = useSessions();

  const handleSubmit = async (text: string) => {
    if (!text.trim()) return;

    // Store prompt in localStorage for the studio page to retrieve
    localStorage.setItem("dilag-initial-prompt", text);

    // Create new session
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

  // Sort sessions by created_at descending (newest first)
  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <div className="h-dvh flex flex-col bg-background">
      {/* Hero section with composer */}
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        {/* Logo/Brand */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center size-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 mb-4">
            <Sparkles className="size-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">Dilag</h1>
          <p className="text-muted-foreground">Design stunning interfaces with AI</p>
        </div>

        {/* Composer */}
        <div className="w-full max-w-2xl">
          <PromptInputProvider>
            <ComposerInput onSubmit={handleSubmit} disabled={!isServerReady} />
          </PromptInputProvider>

          {!isServerReady && (
            <p className="text-center text-sm text-muted-foreground mt-3">
              Starting server...
            </p>
          )}
        </div>
      </div>

      {/* Projects section */}
      {sortedSessions.length > 0 && (
        <div className="border-t bg-muted/30">
          <div className="max-w-4xl mx-auto px-6 py-8">
            <h2 className="text-sm font-medium text-muted-foreground mb-4">Recent Projects</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {sortedSessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => handleOpenProject(session.id)}
                  className="group relative flex items-center gap-3 p-4 rounded-xl border bg-card hover:bg-accent/50 transition-colors text-left"
                >
                  <div className="size-10 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                    <Folder className="size-5 text-purple-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{session.name || "Untitled"}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(session.created_at)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    onClick={(e) => handleDeleteProject(e, session.id)}
                  >
                    <Trash2 className="size-4 text-muted-foreground" />
                  </Button>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
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
      className={cn(
        "rounded-2xl bg-card border-2 transition-all duration-300",
        hasInput ? "border-purple-500/50 shadow-lg shadow-purple-500/10" : "border-border"
      )}
    >
      <PromptInputBody>
        <PromptInputTextarea
          placeholder="Describe the app you want to design..."
          disabled={disabled}
          className="min-h-[100px] max-h-[200px] text-base"
        />
      </PromptInputBody>
      <PromptInputFooter>
        <ModelSelectorButton />
        <PromptInputSubmit
          disabled={!hasInput || disabled}
          className={cn(
            "size-10 rounded-xl transition-all duration-200",
            hasInput && !disabled
              ? "bg-purple-500 text-white shadow-lg shadow-purple-500/25"
              : "bg-muted text-muted-foreground"
          )}
        >
          <ArrowRight className="size-5" />
        </PromptInputSubmit>
      </PromptInputFooter>
    </PromptInput>
  );
}

function ModelSelectorButton() {
  const { models, selectedModelInfo, selectModel, isLoading } = useModels();
  const [open, setOpen] = useState(false);

  // Group models by provider
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
          className="h-8 gap-1.5 px-2.5 text-sm text-muted-foreground hover:text-foreground"
          disabled={isLoading}
        >
          {selectedModelInfo ? (
            <>
              <ModelSelectorLogo
                provider={selectedModelInfo.providerID as any}
                className="size-4"
              />
              <span className="max-w-[150px] truncate">
                {selectedModelInfo.name}
              </span>
            </>
          ) : (
            <span>Select model</span>
          )}
          <ChevronDown className="size-3.5 opacity-50" />
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

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return "Today";
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString();
  }
}
