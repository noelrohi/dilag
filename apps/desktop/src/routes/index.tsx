import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputAttachment,
  PromptInputAttachments,
  PromptInputScreenReferences,
  PromptInputScreenReference,
  PromptInputBody,
  PromptInputFooter,
  PromptInputProvider,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputController,
} from "@/components/ai-elements/prompt-input";
import { PageHeader } from "@/components/blocks/layout/page-header";
import { ModelSelectorButton } from "@/components/blocks/selectors/model-selector-button";
import { AgentSelectorButton } from "@/components/blocks/selectors/agent-selector-button";
import { ThinkingModeSelector } from "@/components/blocks/selectors/thinking-mode-selector";
import { useSessions } from "@/hooks/use-sessions";
import { type Platform } from "@/context/session-store";
import { cn } from "@/lib/utils";
import { ArrowUp, Monitor, Smartphone } from "@solar-icons/react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { parseAsStringLiteral, useQueryState } from "nuqs";

const SUGGESTIONS = [
  "A habit tracking app",
  "A recipe finder with search",
  "A workout timer",
  "A notes app with markdown",
];

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  const navigate = useNavigate();
  const { createSession, isServerReady } = useSessions();
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

  return (
    <div className="h-full flex flex-col bg-background relative overflow-hidden">
      <PageHeader />
      <div
        className="absolute inset-0 pointer-events-none opacity-40 dark:opacity-20"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 50% -20%, oklch(0.7 0.1 255 / 15%), transparent),
            radial-gradient(ellipse 60% 40% at 100% 100%, oklch(0.7 0.08 200 / 10%), transparent)
          `,
        }}
      />

      {/* Connection status indicator */}
      {!isServerReady && (
        <div className="absolute top-2 right-3 flex items-center gap-1.5 z-10">
          <div className="size-1.5 rounded-full bg-amber-500/80" />
          <span className="text-[10px] text-muted-foreground">connecting</span>
        </div>
      )}

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
                <div className="group/composer relative">
                  {/* Focus glow effect */}
                  <div className="pointer-events-none absolute -inset-px rounded-xl opacity-0 transition-opacity duration-300 group-focus-within/composer:opacity-100 bg-gradient-to-b from-primary/20 via-primary/5 to-transparent blur-sm" />
                  <div className="pointer-events-none absolute -inset-[2px] rounded-xl opacity-0 transition-opacity duration-300 group-focus-within/composer:opacity-100 ring-1 ring-primary/30" />
                  <ComposerInput
                    onSubmit={handleSubmit}
                    disabled={!isServerReady}
                  />
                </div>
              </PromptInputProvider>

              <div className="flex justify-center gap-2 mt-8">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => handleSubmit(suggestion)}
                    disabled={!isServerReady}
                    className="px-4 py-1.5 text-[13px] text-muted-foreground hover:text-foreground border border-border/60 hover:border-border rounded-full transition-colors whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
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
      className="rounded-xl border-border/60 bg-card/80 backdrop-blur-sm transition-all duration-200 focus-within:border-primary/40 focus-within:bg-card"
    >
      <PromptInputAttachments>
        {(attachment) => <PromptInputAttachment data={attachment} />}
      </PromptInputAttachments>
      <PromptInputScreenReferences className="px-3 pt-2">
        {(ref) => <PromptInputScreenReference data={ref} />}
      </PromptInputScreenReferences>
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
            <ArrowUp size={16} />
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
          <Monitor size={16} />
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
          <Smartphone size={16} />
          Mobile
        </button>
      </div>
    </div>
  );
}

