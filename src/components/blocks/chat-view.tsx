import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, Terminal, AlertCircle, Plus } from "lucide-react";
import { useSessions } from "@/hooks/use-sessions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { MessagePart } from "./message-part";
import { extractTextFromParts } from "@/lib/opencode";
import { DebugPane } from "./debug-pane";

function StatusIndicator({ status }: { status: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "size-2 rounded-full transition-all duration-300",
          status === "running" && "bg-[var(--status-running)] status-running",
          status === "idle" && "bg-[var(--status-idle)]",
          status === "error" && "bg-[var(--status-error)]",
          status === "unknown" && "bg-muted-foreground/50"
        )}
      />
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {status === "running" ? "Processing" : status}
      </span>
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-3 py-4 animate-slide-up">
      <div className="relative flex items-center justify-center size-8">
        <div className="absolute inset-0 rounded-lg bg-primary/20 animate-thinking" />
        <Sparkles className="size-4 text-primary animate-thinking" />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-foreground/90">Thinking</span>
        <div className="flex gap-1">
          <span className="size-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:0ms]" />
          <span className="size-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:150ms]" />
          <span className="size-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onCreateSession }: { onCreateSession: () => void }) {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="relative max-w-md text-center animate-slide-up">
        {/* Decorative background */}
        <div className="absolute -inset-8 rounded-3xl bg-gradient-to-br from-primary/5 via-transparent to-primary/5 blur-xl" />

        <div className="relative space-y-6">
          {/* Icon */}
          <div className="mx-auto size-16 rounded-2xl bg-card border border-border/50 flex items-center justify-center">
            <Terminal className="size-7 text-primary" />
          </div>

          {/* Text */}
          <div className="space-y-2">
            <h2 className="text-xl font-semibold tracking-tight">
              Start a new session
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Create a session to begin coding with AI assistance.
              Each session maintains its own context and history.
            </p>
          </div>

          {/* Action */}
          <Button
            onClick={onCreateSession}
            className="gap-2 glow-ring"
            size="lg"
          >
            <Plus className="size-4" />
            New Session
          </Button>
        </div>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="flex flex-col items-center gap-6 animate-slide-up">
        <div className="relative">
          <div className="size-12 rounded-xl bg-card border border-border/50 flex items-center justify-center">
            <Terminal className="size-5 text-primary animate-thinking" />
          </div>
          <div className="absolute -inset-2 rounded-2xl bg-primary/10 animate-pulse" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-medium">Starting server</p>
          <p className="text-xs text-muted-foreground">
            Initializing OpenCode...
          </p>
        </div>
      </div>
    </div>
  );
}

function ErrorState({ error }: { error: string }) {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="relative max-w-md text-center animate-slide-up">
        <div className="absolute -inset-8 rounded-3xl bg-destructive/5 blur-xl" />

        <div className="relative space-y-4">
          <div className="mx-auto size-12 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center justify-center">
            <AlertCircle className="size-5 text-destructive" />
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-destructive">{error}</h3>
            <p className="text-xs text-muted-foreground">
              Make sure OpenCode is installed and configured correctly.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ChatView() {
  const {
    messages,
    currentSessionId,
    isLoading,
    isServerReady,
    error,
    debugEvents,
    sessionStatus,
    sendMessage,
    createSession,
    clearDebugEvents,
  } = useSessions();

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const message = input.trim();
    setInput("");
    await sendMessage(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  if (!isServerReady) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState error={error} />;
  }

  if (!currentSessionId) {
    return <EmptyState onCreateSession={() => createSession()} />;
  }

  return (
    <div className="flex flex-1 flex-col relative">
      {/* Status bar */}
      <div className="absolute top-0 left-0 right-0 z-10 px-6 py-3 flex items-center justify-between bg-gradient-to-b from-background via-background/95 to-transparent pointer-events-none">
        <StatusIndicator status={sessionStatus} />
        <div className="text-xs font-mono text-muted-foreground/60">
          {messages.length} messages
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto pt-14 pb-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6">
            <div className="text-center space-y-3 animate-slide-up">
              <div className="size-10 mx-auto rounded-lg bg-card border border-border/50 flex items-center justify-center">
                <Sparkles className="size-4 text-primary/60" />
              </div>
              <p className="text-sm text-muted-foreground">
                Send a message to start the conversation
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6 px-6 max-w-4xl mx-auto">
            {messages.map((message, index) => (
              <div
                key={message.id}
                className={cn(
                  "animate-slide-up",
                  message.role === "user" ? "flex justify-end" : ""
                )}
                style={{ animationDelay: `${Math.min(index * 30, 200)}ms` }}
              >
                {message.role === "user" ? (
                  // User message
                  <div className="max-w-[85%] group">
                    <div className="rounded-2xl rounded-br-md px-4 py-3 bg-primary text-primary-foreground">
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">
                        {extractTextFromParts(message.parts)}
                      </p>
                    </div>
                    <div className="mt-1.5 text-right">
                      <span className="text-[10px] font-mono text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity">
                        you
                      </span>
                    </div>
                  </div>
                ) : (
                  // Assistant message
                  <div className="w-full">
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className="shrink-0 size-7 rounded-lg bg-card border border-border/50 flex items-center justify-center mt-0.5">
                        <Sparkles className="size-3.5 text-primary" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 space-y-3">
                        {message.parts
                          .filter((p) => !(p.type === "tool" && p.tool === "todoread"))
                          .map((part, partIndex) => (
                            <div
                              key={part.id}
                              className="animate-stream-in"
                              style={{ animationDelay: `${partIndex * 50}ms` }}
                            >
                              <MessagePart part={part} />
                            </div>
                          ))}

                        {/* Thinking indicator */}
                        {message.isStreaming && message.parts.length === 0 && (
                          <ThinkingIndicator />
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="relative px-6 pb-6">
        <div className="max-w-4xl mx-auto">
          {/* Gradient fade */}
          <div className="absolute inset-x-0 -top-12 h-12 bg-gradient-to-t from-background to-transparent pointer-events-none" />

          <form onSubmit={handleSubmit} className="relative">
            <div
              className={cn(
                "relative rounded-2xl border bg-card/50 backdrop-blur-sm transition-all duration-300",
                input.trim() && "border-primary/30 glow-ring",
                isLoading && "opacity-80"
              )}
            >
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything..."
                disabled={isLoading}
                className={cn(
                  "min-h-[56px] max-h-[200px] resize-none border-0 bg-transparent px-4 py-4 pr-14",
                  "placeholder:text-muted-foreground/50 focus-visible:ring-0 focus-visible:ring-offset-0",
                  "text-sm leading-relaxed"
                )}
                rows={1}
              />

              <div className="absolute right-2 bottom-2">
                <Button
                  type="submit"
                  size="icon"
                  disabled={!input.trim() || isLoading}
                  className={cn(
                    "size-9 rounded-xl transition-all duration-200",
                    input.trim() && !isLoading
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {isLoading ? (
                    <div className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  <span className="sr-only">Send message</span>
                </Button>
              </div>
            </div>

            {/* Keyboard hint */}
            <div className="mt-2 text-center">
              <span className="text-[10px] font-mono text-muted-foreground/40">
                Press <kbd className="px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground/60">Enter</kbd> to send
              </span>
            </div>
          </form>
        </div>
      </div>

      {/* Debug pane */}
      <DebugPane events={debugEvents} onClear={clearDebugEvents} />
    </div>
  );
}
