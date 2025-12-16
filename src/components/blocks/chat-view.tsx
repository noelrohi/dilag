import { Send, Sparkles, Terminal, AlertCircle, Plus } from "lucide-react";
import { useSessions } from "@/hooks/use-sessions";
import {
  useMessageParts,
  type Message as SessionMessage,
} from "@/context/session-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MessagePart } from "./message-part";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTools,
  PromptInputProvider,
  usePromptInputController,
} from "@/components/ai-elements/prompt-input";

function StatusIndicator({ status }: { status: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "size-2 rounded-full transition-all duration-300",
          status === "running" && "bg-[var(--status-running)] status-running",
          status === "idle" && "bg-[var(--status-idle)]",
          status === "error" && "bg-[var(--status-error)]",
          status === "unknown" && "bg-muted-foreground/50",
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

// Helper to extract text from parts
function extractTextFromParts(
  parts: { type: string; text?: string }[],
): string {
  return parts
    .filter((p) => p.type === "text" && p.text)
    .map((p) => p.text!)
    .join("");
}

// Component that renders a user message with parts from the store
function UserMessage({
  message,
  index,
}: {
  message: SessionMessage;
  index: number;
}) {
  const parts = useMessageParts(message.id);

  return (
    <Message
      from="user"
      className="animate-slide-up !ml-0"
      style={{ animationDelay: `${Math.min(index * 30, 200)}ms` }}
    >
      <MessageContent className="!ml-0">
        <p className="whitespace-pre-wrap leading-relaxed">
          {extractTextFromParts(parts)}
        </p>
      </MessageContent>
    </Message>
  );
}

// Component that renders an assistant message with parts from the store
function AssistantMessage({
  message,
  index,
}: {
  message: SessionMessage;
  index: number;
}) {
  const parts = useMessageParts(message.id);

  return (
    <Message
      from="assistant"
      className="animate-slide-up"
      style={{ animationDelay: `${Math.min(index * 30, 200)}ms` }}
    >
      <MessageContent className="space-y-3">
        {parts
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

        {/* Thinking indicator - show when streaming and no parts yet */}
        {message.isStreaming && parts.length === 0 && <ThinkingIndicator />}
      </MessageContent>
    </Message>
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
              Create a session to begin coding with AI assistance. Each session
              maintains its own context and history.
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

function ChatInputArea({
  isLoading,
  sendMessage,
}: {
  isLoading: boolean;
  sendMessage: (message: string) => Promise<void>;
}) {
  const { textInput } = usePromptInputController();
  const hasInput = textInput.value.trim().length > 0;

  return (
    <div className="relative px-6 pb-6">
      <div className="max-w-4xl mx-auto">
        {/* Gradient fade */}
        <div className="absolute inset-x-0 -top-12 h-12 bg-gradient-to-t from-background to-transparent pointer-events-none" />

        <PromptInput
          onSubmit={async ({ text }) => {
            if (!text.trim() || isLoading) return;
            await sendMessage(text.trim());
          }}
          className={cn(
            "rounded-2xl bg-card/50 backdrop-blur-sm transition-all duration-300",
            hasInput && "glow-ring",
            isLoading && "opacity-80",
          )}
        >
          <PromptInputBody>
            <PromptInputTextarea
              placeholder="Ask anything..."
              disabled={isLoading}
              className="min-h-[56px] max-h-[200px]"
            />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools />
            <PromptInputSubmit
              disabled={!hasInput || isLoading}
              className={cn(
                "size-9 rounded-xl transition-all duration-200",
                hasInput && !isLoading
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {isLoading ? (
                <div className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
            </PromptInputSubmit>
          </PromptInputFooter>
        </PromptInput>

        {/* Keyboard hint */}
        <div className="mt-2 text-center">
          <span className="text-[10px] font-mono text-muted-foreground/40">
            Press{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground/60">
              Enter
            </kbd>{" "}
            to send
          </span>
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
    sessionStatus,
    sendMessage,
    createSession,
  } = useSessions();

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
    <PromptInputProvider>
      <div className="flex flex-col h-[calc(100dvh-48px)]">
        {/* Status bar */}
        <div className="shrink-0 px-6 py-3 flex items-center justify-between">
          <StatusIndicator status={sessionStatus} />
          <div className="text-xs font-mono text-muted-foreground/60">
            {messages.length} messages
          </div>
        </div>

        {/* Messages area - flex-1 + min-h-0 allows proper flex shrinking */}
        <Conversation className="flex-1 min-h-0">
          <ConversationContent className="px-6 max-w-4xl mx-auto">
            {messages.length === 0 ? (
              <ConversationEmptyState
                icon={<Sparkles className="size-10 text-primary/60" />}
                title="Start a conversation"
                description="Send a message to begin chatting"
              />
            ) : (
              messages.map((message, index) =>
                message.role === "user" ? (
                  <UserMessage
                    key={message.id}
                    message={message}
                    index={index}
                  />
                ) : (
                  <AssistantMessage
                    key={message.id}
                    message={message}
                    index={index}
                  />
                ),
              )
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        {/* Input area */}
        <div className="shrink-0">
          <ChatInputArea isLoading={isLoading} sendMessage={sendMessage} />
        </div>
      </div>
    </PromptInputProvider>
  );
}
