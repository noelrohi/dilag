import { useState } from "react";
import {
  Sparkles,
  Terminal,
  AlertCircle,
  ChevronDown,
  Palette,
  Paperclip,
} from "lucide-react";
import { ArrowUp, Sparkle } from "@phosphor-icons/react";
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
  PromptInputActionMenu,
  PromptInputActionMenuTrigger,
  PromptInputActionMenuContent,
  PromptInputActionAddAttachments,
  PromptInputAttachments,
  PromptInputAttachment,
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
import { useModels } from "@/hooks/use-models";

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
  const textContent = extractTextFromParts(parts);
  const fileParts = parts.filter((p) => p.type === "file" && p.url);

  return (
    <Message
      from="user"
      className="animate-slide-up ml-0!"
      style={{ animationDelay: `${Math.min(index * 30, 200)}ms` }}
    >
      <MessageContent className="ml-0! space-y-2">
        {/* File attachments */}
        {fileParts.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {fileParts.map((file) => (
              <div
                key={file.id}
                className="relative rounded-lg overflow-hidden border border-border/50 bg-muted/30"
              >
                {file.mime?.startsWith("image/") ? (
                  <img
                    src={file.url}
                    alt={file.filename || "Attached image"}
                    className="max-w-[200px] max-h-[200px] object-contain"
                  />
                ) : (
                  <div className="px-3 py-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <Paperclip className="size-4" />
                    <span className="truncate max-w-[150px]">
                      {file.filename || "Attachment"}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {/* Text content */}
        {textContent && (
          <p className="whitespace-pre-wrap leading-relaxed">{textContent}</p>
        )}
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
      <MessageContent className="space-y-2 w-full">
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
            <Sparkle className="size-4" weight="fill" />
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
    {} as Record<string, { name: string; models: typeof models }>,
  );

  return (
    <ModelSelector open={open} onOpenChange={setOpen}>
      <ModelSelectorTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-2 px-3 text-xs text-muted-foreground hover:text-foreground border"
          disabled={isLoading}
        >
          {selectedModelInfo ? (
            <>
              <ModelSelectorLogo
                provider={selectedModelInfo.providerID as any}
                className="size-4"
              />
              <span className="max-w-[120px] truncate">
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
            ),
          )}
        </ModelSelectorList>
      </ModelSelectorContent>
    </ModelSelector>
  );
}

function ChatInputArea({
  isLoading,
  sendMessage,
}: {
  isLoading: boolean;
  sendMessage: (message: string, files?: import("ai").FileUIPart[]) => Promise<void>;
}) {
  const { textInput } = usePromptInputController();
  const hasInput = textInput.value.trim().length > 0;

  const handleSubmit = async (text: string, files?: import("ai").FileUIPart[]) => {
    if (!text.trim() || isLoading) return;
    await sendMessage(text.trim(), files);
  };

  return (
    <div className="relative px-4 pb-4">
      <div>
        {/* Gradient fade */}
        <div className="absolute inset-x-0 -top-12 h-12 bg-gradient-to-t from-background to-transparent pointer-events-none" />

        <PromptInput
          onSubmit={async ({ text, files }) => handleSubmit(text, files)}
          className={cn(
            "[&_[data-slot=input-group]]:rounded-xl [&_[data-slot=input-group]]:border-border/50",
            "[&_[data-slot=input-group]]:bg-card/50 [&_[data-slot=input-group]]:backdrop-blur-sm",
            "[&_[data-slot=input-group]]:focus-within:border-primary/50 [&_[data-slot=input-group]]:focus-within:ring-2 [&_[data-slot=input-group]]:focus-within:ring-primary/20",
            "transition-all duration-300",
            isLoading && "opacity-80",
          )}
        >
          <PromptInputAttachments>
            {(attachment) => <PromptInputAttachment data={attachment} />}
          </PromptInputAttachments>
          <PromptInputBody>
            <PromptInputTextarea
              placeholder="Describe a design..."
              disabled={isLoading}
              className="min-h-[56px] max-h-[200px]"
            />
          </PromptInputBody>
          <PromptInputFooter>
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
                  <ArrowUp className="size-4" />
                )}
              </PromptInputSubmit>
            </div>
          </PromptInputFooter>
        </PromptInput>
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
      <div className="flex flex-col h-full">
        {/* Messages area - flex-1 + min-h-0 allows proper flex shrinking */}
        <Conversation className="flex-1 min-h-0">
          <ConversationContent className="px-4">
            {messages.length === 0 ? (
              <ConversationEmptyState
                icon={<Palette className="size-10 text-primary/60" />}
                title="Design something"
                description="Describe a UI screen and it will appear in the preview"
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
          <ChatInputArea
            isLoading={isLoading}
            sendMessage={sendMessage}
          />
        </div>
      </div>
    </PromptInputProvider>
  );
}
