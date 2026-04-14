import {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
  useId,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Monitor,
  DangerCircle,
  ClipboardText,
  CloseCircle,
  DangerTriangle,
  Stop,
  ArrowUp,
  MagicStick,
  BranchingPathsUp,
  UndoLeft,
  ClockCircle,
  Copy,
} from "@solar-icons/react";
import { usePendingMessage } from "@/hooks/use-chat-interface";
import { DilagIcon } from "@/components/blocks/branding/dilag-icon";
import { useSessions } from "@/hooks/use-sessions";
import { useSDK } from "@/context/global-events";
import {
  useMessageParts,
  useSessionError,
  useSessionRevert,
  useSessionStore,
  usePendingPermissions,
  usePendingQuestions,
  useRunningPermissionTools,
  useRunningQuestionTools,
  type Message as SessionMessage,
} from "@/context/session-store";
import { Button } from "@dilag/ui/button";
import { cn } from "@/lib/utils";
import { MessagePart } from "./message-part";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageActions, MessageAction } from "@/components/ai-elements/message";
import { useElapsedTime } from "@/hooks/use-elapsed-time";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTools,
  PromptInputAddAttachmentButton,
  PromptInputAttachments,
  PromptInputAttachment,
  PromptInputScreenReferences,
  PromptInputScreenReference,
  PromptInputProvider,
  usePromptInputController,
} from "@/components/ai-elements/prompt-input";
import { ModelSelectorButton } from "@/components/blocks/selectors/model-selector-button";
import { AgentSelectorButton } from "@/components/blocks/selectors/agent-selector-button";
import { ThinkingModeSelector } from "@/components/blocks/selectors/thinking-mode-selector";
import { TimelineDialog } from "@/components/blocks/dialogs/dialog-timeline";
import { RevertBanner } from "./revert-banner";
import { PermissionList } from "./permission-list";
import { QuestionList } from "./question-list";
import { StuckToolWarning } from "@/components/blocks/errors/stuck-tool-warning";
import { AttachmentBridgeConnector } from "./attachment-bridge-connector";
import type { MessagePart as MessagePartType } from "@/context/session-store";
import { toast } from "sonner";

const FILE_MENTION_SEARCH_DEBOUNCE_MS = 150;
const FILE_MENTION_SEARCH_LIMIT = 20;
const FILE_MENTION_MAX_COUNT = 10;
const FILE_MENTION_MAX_SIZE_BYTES = 200 * 1024;

export type MentionedFileRef = {
  id: string;
  path: string;
  displayName: string;
};

type ActiveFileMention = {
  start: number;
  end: number;
  query: string;
};

type MentionSearchResult = {
  path: string;
  displayName: string;
};

type MentionFileContent = {
  content: string;
  encoding?: "base64";
  mimeType?: string;
};

function getFileDisplayName(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

// Detect active @file mention at a given caret position.
export function findActiveFileMention(
  text: string,
  caretPosition: number,
): ActiveFileMention | null {
  if (caretPosition < 0 || caretPosition > text.length) return null;

  let start = caretPosition - 1;
  while (start >= 0 && !/\s/.test(text[start])) {
    start--;
  }
  start += 1;

  let end = caretPosition;
  while (end < text.length && !/\s/.test(text[end])) {
    end++;
  }

  const token = text.slice(start, end);
  if (!token.startsWith("@")) return null;
  if (!/^@[\w./-]*$/.test(token)) return null;

  return {
    start,
    end,
    query: text.slice(start + 1, caretPosition),
  };
}

// Remove mention token and keep spacing sane around where it was deleted.
export function removeFileMentionToken(
  text: string,
  mention: Pick<ActiveFileMention, "start" | "end">,
): { text: string; caretPosition: number } {
  let prefix = text.slice(0, mention.start);
  let suffix = text.slice(mention.end);

  if (/\s$/.test(prefix) && /^\s/.test(suffix)) {
    suffix = suffix.slice(1);
  } else if (prefix && !/\s$/.test(prefix) && suffix && !/^\s/.test(suffix)) {
    prefix += " ";
  }

  return { text: `${prefix}${suffix}`, caretPosition: prefix.length };
}

export function estimateMentionFileSizeBytes(content: string, encoding?: "base64"): number {
  if (encoding === "base64") {
    const padding = content.endsWith("==") ? 2 : content.endsWith("=") ? 1 : 0;
    return Math.max(0, Math.floor((content.length * 3) / 4) - padding);
  }
  return new TextEncoder().encode(content).length;
}

export function buildMentionDataUrl(content: string, mimeType: string, encoding?: "base64"): string {
  if (encoding === "base64") {
    return `data:${mimeType};base64,${content}`;
  }
  const base64 = btoa(unescape(encodeURIComponent(content)));
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Check if a message part would render content.
 * Matches the null-return conditions in MessagePartContent.
 */
function wouldRenderContent(part: MessagePartType): boolean {
  switch (part.type) {
    case "text":
    case "reasoning":
      return !!part.text?.trim();
    case "tool":
      if (!part.tool || !part.state) return false;
      // Question tool only renders when completed
      if (part.tool === "question" && part.state.status !== "completed") return false;
      // todoread is filtered elsewhere
      if (part.tool === "todoread") return false;
      return true;
    case "file":
      return !!part.url;
    case "step-start":
      return !!part.model;
    case "step-finish":
      return false;
    default:
      return false;
  }
}

const BUSY_FALLBACKS = [
  "Thinking",
  "Designing",
  "Sketching",
  "Refining",
  "Polishing",
  "Exploring",
  "Planning",
  "Cooking",
] as const;

function formatToolActivity(tool: string): string {
  switch (tool) {
    case "bash":
      return "Running command";
    case "read":
    case "glob":
    case "grep":
      return "Searching project";
    case "edit":
    case "write":
      return "Editing files";
    case "webfetch":
    case "websearch":
      return "Browsing";
    case "task":
      return "Working";
    default:
      return `Running ${tool}`;
  }
}

function useBusyFallbackOnce(active: boolean): string {
  const [label, setLabel] = useState<string>(BUSY_FALLBACKS[0]);
  const prevActiveRef = useRef(false);
  const lastLabelRef = useRef<string>(label);

  useEffect(() => {
    lastLabelRef.current = label;
  }, [label]);

  useEffect(() => {
    const wasActive = prevActiveRef.current;
    prevActiveRef.current = active;

    // Pick once when we *enter* active state.
    if (active && !wasActive) {
      let next = lastLabelRef.current;
      // Avoid repeating the same label when possible
      for (let attempts = 0; attempts < 5 && next === lastLabelRef.current; attempts++) {
        next = BUSY_FALLBACKS[Math.floor(Math.random() * BUSY_FALLBACKS.length)];
      }
      setLabel(next);
    }
  }, [active]);

  return label;
}

function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-3 py-4 animate-slide-up">
      <div className="relative flex items-center justify-center size-8">
        <div className="absolute inset-0 rounded-lg bg-primary/10" />
        <DilagIcon animated className="size-5 text-primary" />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-foreground/90">Thinking</span>
        <div className="flex gap-1">
          <span className="size-1.5 rounded-full bg-primary/50 animate-pulse [animation-delay:0ms]" />
          <span className="size-1.5 rounded-full bg-primary/50 animate-pulse [animation-delay:300ms]" />
          <span className="size-1.5 rounded-full bg-primary/50 animate-pulse [animation-delay:600ms]" />
        </div>
      </div>
    </div>
  );
}

function InlineErrorCard({ error }: { error: { name: string; message: string } }) {
  // Format error name: "ProviderAuthError" -> "Provider Auth Error"
  const formattedName = error.name
    .replace(/Error$/, "")
    .replace(/([A-Z])/g, " $1")
    .trim();

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20 animate-slide-up">
      <DangerTriangle size={16} className="text-destructive shrink-0 mt-0.5" />
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-sm font-medium text-destructive">
          {formattedName || "Error"}
        </span>
        <span className="text-sm text-destructive/80 break-words">
          {error.message}
        </span>
      </div>
    </div>
  );
}

// Component to show total session duration (from first message to current message completion)
function MessageDuration({
  message,
  sessionStartTime,
  activityLabel,
}: {
  message: SessionMessage;
  sessionStartTime: number;
  activityLabel?: string;
}) {
  const startTime = sessionStartTime;
  // Only freeze the timer when the message is actually marked completed.
  // Using Date.now() here causes the display to "stick" and then jump when rerendered.
  const endTime = message.time.completed;
  const elapsed = useElapsedTime(startTime, endTime);
  const showActivity = endTime === undefined && !!activityLabel;
  const isActive = endTime === undefined;

  return (
    <div className="flex items-center gap-2.5 pt-3 pb-1">
      <DilagIcon
        animated={isActive}
        className={cn(
          "size-3.5 transition-colors duration-300",
          isActive ? "text-primary" : "text-muted-foreground"
        )}
      />
      <div className="flex items-baseline gap-1.5">
        {showActivity && (
          <span className="text-[13px] text-muted-foreground">
            {activityLabel}
          </span>
        )}
        <span
          className={cn(
            "font-mono text-[13px] tabular-nums tracking-tight transition-colors duration-300",
            isActive ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {elapsed}
        </span>
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

// Parse and clean text: remove screen context blocks, identify inline @ScreenName refs
export function parseMessageText(text: string): { cleanText: string; hasScreenRefs: boolean } {
  // Remove <screen_context> blocks (hidden from display, only for AI)
  let cleanText = text.replace(/<screen_context name="[^"]+">[\s\S]*?<\/screen_context>/g, '').trim();
  
  // Also handle legacy <referenced_screen> format
  cleanText = cleanText.replace(/<referenced_screen name="[^"]+">[\s\S]*?<\/referenced_screen>/g, '').trim();
  
  // Check if there are inline @ScreenName refs (including kebab-case names with hyphens)
  const hasScreenRefs = /@[\w-]+/.test(cleanText);
  
  return { cleanText, hasScreenRefs };
}

// Render text with inline @ScreenName highlights
export function HighlightedText({ text }: { text: string }) {
  // Split on @Word patterns (including hyphens for kebab-case names), keeping the delimiters
  const parts = text.split(/(@[\w-]+)/g);
  
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('@') && /^@[\w-]+$/.test(part)) {
          return (
            <span 
              key={i} 
              className="inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded bg-primary/10 text-primary font-medium"
            >
              {part}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

// Component that renders a user message with parts from the store
function UserMessage({
  message,
  index,
  onFork,
  onRevert,
  onCopyText,
  onOpenTimeline,
  hideActions,
}: {
  message: SessionMessage;
  index: number;
  onFork: (messageId: string) => void;
  onRevert: (messageId: string) => void;
  onCopyText: (messageId: string) => void;
  onOpenTimeline: () => void;
  hideActions?: boolean;
}) {
  const parts = useMessageParts(message.id);
  const rawTextContent = extractTextFromParts(parts);
  const { cleanText, hasScreenRefs } = parseMessageText(rawTextContent);
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
                      <ClipboardText size={16} />
                    <span className="truncate max-w-[150px]">
                      {file.filename || "Attachment"}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {/* Text content with inline highlights for @ScreenName refs */}
        {cleanText && (
          <p className="whitespace-pre-wrap leading-relaxed">
            {hasScreenRefs ? <HighlightedText text={cleanText} /> : cleanText}
          </p>
        )}
      </MessageContent>
      {!hideActions && (
        <MessageActions>
          <MessageAction tooltip="Copy text" onClick={() => onCopyText(message.id)}>
            <Copy size={14} />
          </MessageAction>
          <MessageAction tooltip="Fork from here" onClick={() => onFork(message.id)}>
            <BranchingPathsUp size={14} />
          </MessageAction>
          <MessageAction tooltip="Revert to here" onClick={() => onRevert(message.id)}>
            <UndoLeft size={14} />
          </MessageAction>
          <MessageAction tooltip="View timeline" onClick={onOpenTimeline}>
            <ClockCircle size={14} />
          </MessageAction>
        </MessageActions>
      )}
    </Message>
  );
}

// Component that renders an assistant message with parts from the store
function AssistantMessage({
  message,
  index,
  isLast,
  showTimer,
  sessionStartTime,
  activityLabel,
  onFork,
  onCopyText,
  onOpenTimeline,
}: {
  message: SessionMessage;
  index: number;
  isLast: boolean;
  showTimer: boolean;
  sessionStartTime: number;
  activityLabel?: string;
  onFork: (messageId: string) => void;
  onCopyText: (messageId: string) => void;
  onOpenTimeline: () => void;
}) {
  const parts = useMessageParts(message.id);
  const sessionError = useSessionError(message.sessionID);
  const renderableParts = parts.filter(wouldRenderContent);

  return (
    <Message
      from="assistant"
      className="animate-slide-up"
      style={{ animationDelay: `${Math.min(index * 30, 200)}ms` }}
    >
      <MessageContent className="space-y-2 w-full">
        {renderableParts.map((part, partIndex) => (
          <div
            key={part.id}
            className="animate-stream-in"
            style={{ animationDelay: `${partIndex * 50}ms` }}
          >
            <MessagePart part={part} />
          </div>
        ))}

        {/* Thinking indicator - show when streaming and no renderable parts yet */}
        {message.isStreaming && renderableParts.length === 0 && <ThinkingIndicator />}

        {/* Inline error - show on last assistant message when session has error */}
        {isLast && !message.isStreaming && sessionError && (
          <InlineErrorCard error={sessionError} />
        )}
      </MessageContent>
      {!message.isStreaming && isLast && (
        <MessageActions>
          <MessageAction tooltip="Copy text" onClick={() => onCopyText(message.id)}>
            <Copy size={14} />
          </MessageAction>
          <MessageAction tooltip="Fork from here" onClick={() => onFork(message.id)}>
            <BranchingPathsUp size={14} />
          </MessageAction>
          <MessageAction tooltip="View timeline" onClick={onOpenTimeline}>
            <ClockCircle size={14} />
          </MessageAction>
        </MessageActions>
      )}
      {/* Duration timer - only show on last assistant message before next user message */}
      {showTimer && (
        <MessageDuration
          message={message}
          sessionStartTime={sessionStartTime}
          activityLabel={activityLabel}
        />
      )}
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
            <Monitor size={28} className="text-primary" />
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
            <MagicStick size={16} />
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
            <Monitor size={20} className="text-primary animate-thinking" />
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
            <DangerCircle size={20} className="text-destructive" />
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
  stopSession,
  sessionCwd,
}: {
  isLoading: boolean;
  sendMessage: (message: string, files?: import("ai").FileUIPart[]) => Promise<void>;
  stopSession: () => Promise<void>;
  sessionCwd: string | null;
}) {
  const sdk = useSDK();
  const composerTextareaId = useId();
  const { textInput, attachments, screenRefs } = usePromptInputController();
  const [caretPosition, setCaretPosition] = useState(0);
  const [activeMention, setActiveMention] = useState<ActiveFileMention | null>(null);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [isSearchingMentions, setIsSearchingMentions] = useState(false);
  const [mentionSearchResults, setMentionSearchResults] = useState<MentionSearchResult[]>([]);
  const [highlightedMentionIndex, setHighlightedMentionIndex] = useState(0);
  const [mentionedFiles, setMentionedFiles] = useState<MentionedFileRef[]>([]);
  const mentionSearchRequestRef = useRef(0);
  const hasInput = textInput.value.trim().length > 0;
  const hasComposerReferences =
    attachments.files.length > 0 ||
    screenRefs.references.length > 0 ||
    mentionedFiles.length > 0;
  const hasSubmittableInput = hasInput || hasComposerReferences;
  const { pendingMessage, clearPendingMessage } = usePendingMessage();

  // Handle pending messages from server error overlay or other sources
  useEffect(() => {
    if (pendingMessage) {
      textInput.setInput(pendingMessage);
      setCaretPosition(pendingMessage.length);
      clearPendingMessage();
    }
  }, [pendingMessage, textInput, clearPendingMessage]);

  // Keep caret position bounded as input changes
  useEffect(() => {
    if (caretPosition > textInput.value.length) {
      setCaretPosition(textInput.value.length);
    }
  }, [caretPosition, textInput.value.length]);

  // Parse active @file token from the current caret position
  useEffect(() => {
    const mention = findActiveFileMention(textInput.value, caretPosition);
    setActiveMention(mention);

    if (!mention) {
      setMentionOpen(false);
      setMentionSearchResults([]);
      setHighlightedMentionIndex(0);
      setIsSearchingMentions(false);
      return;
    }

    setMentionOpen(true);
  }, [textInput.value, caretPosition]);

  // Debounced project file search for active mention
  useEffect(() => {
    if (!mentionOpen || !activeMention || !sessionCwd) {
      return;
    }

    const requestId = ++mentionSearchRequestRef.current;
    setIsSearchingMentions(true);

    const timer = window.setTimeout(async () => {
      try {
        const response = await sdk.find.files({
          directory: sessionCwd,
          query: activeMention.query,
          type: "file",
          limit: FILE_MENTION_SEARCH_LIMIT,
        });

        if (requestId !== mentionSearchRequestRef.current) return;

        const results = (response.data ?? []).map((path) => ({
          path,
          displayName: getFileDisplayName(path),
        }));
        setMentionSearchResults(results);
        setHighlightedMentionIndex(0);
      } catch {
        if (requestId !== mentionSearchRequestRef.current) return;
        setMentionSearchResults([]);
      } finally {
        if (requestId === mentionSearchRequestRef.current) {
          setIsSearchingMentions(false);
        }
      }
    }, FILE_MENTION_SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [activeMention, mentionOpen, sdk, sessionCwd]);

  const syncCaretPosition = useCallback((target: HTMLTextAreaElement | null) => {
    if (!target) return;
    setCaretPosition(target.selectionStart ?? target.value.length);
  }, []);

  const selectMentionResult = useCallback((result: MentionSearchResult) => {
    if (!activeMention) return;

    const existing = mentionedFiles.some((file) => file.path === result.path);
    if (existing) {
      toast.info(`"${result.displayName}" is already mentioned`);
    } else if (mentionedFiles.length >= FILE_MENTION_MAX_COUNT) {
      toast.warning(`You can mention up to ${FILE_MENTION_MAX_COUNT} files per message`);
    } else {
      setMentionedFiles((prev) => [
        ...prev,
        {
          id: result.path,
          path: result.path,
          displayName: result.displayName,
        },
      ]);
    }

    const next = removeFileMentionToken(textInput.value, activeMention);
    textInput.setInput(next.text);
    setCaretPosition(next.caretPosition);
    setMentionOpen(false);
    setMentionSearchResults([]);
    setHighlightedMentionIndex(0);

    requestAnimationFrame(() => {
      const textarea = document.getElementById(composerTextareaId) as HTMLTextAreaElement | null;
      if (!textarea) return;
      textarea.focus();
      textarea.setSelectionRange(next.caretPosition, next.caretPosition);
    });
  }, [activeMention, composerTextareaId, mentionedFiles, textInput]);

  const removeMentionedFile = useCallback((id: string) => {
    setMentionedFiles((prev) => prev.filter((file) => file.id !== id));
  }, []);

  const handleComposerKeyDownCapture = useCallback((e: ReactKeyboardEvent<HTMLFormElement>) => {
    if (!mentionOpen) return;

    const target = e.target as HTMLElement | null;
    if (!target || target.id !== composerTextareaId) return;

    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setMentionOpen(false);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      if (mentionSearchResults.length === 0) return;
      setHighlightedMentionIndex((prev) => (prev + 1) % mentionSearchResults.length);
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      if (mentionSearchResults.length === 0) return;
      setHighlightedMentionIndex((prev) => (prev - 1 + mentionSearchResults.length) % mentionSearchResults.length);
      return;
    }

    if ((e.key === "Enter" && !e.shiftKey) || e.key === "Tab") {
      e.preventDefault();
      e.stopPropagation();
      if (mentionSearchResults.length === 0) return;
      const selected = mentionSearchResults[Math.min(highlightedMentionIndex, mentionSearchResults.length - 1)];
      if (selected) {
        selectMentionResult(selected);
      }
    }
  }, [
    composerTextareaId,
    highlightedMentionIndex,
    mentionOpen,
    mentionSearchResults,
    selectMentionResult,
  ]);

  const resolveMentionedFileParts = useCallback(async () => {
    const parts: import("ai").FileUIPart[] = [];
    let tooLargeCount = 0;
    let failedCount = 0;

    for (const file of mentionedFiles) {
      try {
        const response = await sdk.file.read({
          directory: sessionCwd ?? undefined,
          path: file.path,
        });
        const content = response.data as MentionFileContent | undefined;
        if (!content || typeof content.content !== "string") {
          failedCount++;
          continue;
        }

        const bytes = estimateMentionFileSizeBytes(content.content, content.encoding);
        if (bytes > FILE_MENTION_MAX_SIZE_BYTES) {
          tooLargeCount++;
          continue;
        }

        const mimeType = content.mimeType || "text/plain";
        parts.push({
          type: "file",
          filename: file.path,
          mediaType: mimeType,
          url: buildMentionDataUrl(content.content, mimeType, content.encoding),
        });
      } catch {
        failedCount++;
      }
    }

    return { parts, tooLargeCount, failedCount };
  }, [mentionedFiles, sdk, sessionCwd]);

  const handleSubmit = async (text: string, files?: import("ai").FileUIPart[]) => {
    if (isLoading) return;

    const trimmedText = text.trim();
    const inputFiles = files ?? [];
    const hasMentionedFiles = mentionedFiles.length > 0;
    if (!trimmedText && inputFiles.length === 0 && !hasMentionedFiles) return;

    let mentionParts: import("ai").FileUIPart[] = [];
    if (hasMentionedFiles) {
      if (!sessionCwd) {
        toast.error("Session path is unavailable for file mentions");
        return;
      }

      const resolved = await resolveMentionedFileParts();
      mentionParts = resolved.parts;

      if (resolved.tooLargeCount > 0) {
        toast.warning(
          `Skipped ${resolved.tooLargeCount} mentioned ${resolved.tooLargeCount === 1 ? "file" : "files"} over 200KB`,
        );
      }
      if (resolved.failedCount > 0) {
        toast.warning(
          `Could not attach ${resolved.failedCount} mentioned ${resolved.failedCount === 1 ? "file" : "files"}`,
        );
      }
    }

    const mergedFiles = [...inputFiles, ...mentionParts];
    if (!trimmedText && mergedFiles.length === 0) {
      toast.error("All mentioned files were skipped. Add text or mention smaller files.");
      return;
    }

    try {
      await sendMessage(trimmedText, mergedFiles.length > 0 ? mergedFiles : undefined);
      setMentionedFiles([]);
      setMentionOpen(false);
      setMentionSearchResults([]);
      setHighlightedMentionIndex(0);
    } catch {
      toast.error("Failed to send message");
    }
  };

  const handleButtonClick = () => {
    if (isLoading) {
      stopSession();
    }
  };

  // ESC key handler to stop session
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isLoading) {
        // Don't stop session if any dialog/modal is open (includes Dialog and AlertDialog)
        const hasOpenDialog = document.querySelector('[data-radix-portal] [role="dialog"], [data-radix-portal] [role="alertdialog"]');
        if (hasOpenDialog) return;

        e.preventDefault();
        stopSession();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isLoading, stopSession]);

  return (
    <div className="relative px-4 pb-4">
      <div className="space-y-2">
        {/* Gradient fade */}
        <div className="absolute inset-x-0 -top-12 h-12 bg-gradient-to-t from-background to-transparent pointer-events-none" />

        <PromptInput
          onSubmit={async ({ text, files }) => handleSubmit(text, files)}
          onKeyDownCapture={handleComposerKeyDownCapture}
          className={cn(isLoading && "opacity-80")}
        >
          <PromptInputAttachments>
            {(attachment) => <PromptInputAttachment data={attachment} />}
          </PromptInputAttachments>
          <PromptInputScreenReferences className="px-3 pt-2">
            {(ref) => <PromptInputScreenReference data={ref} />}
          </PromptInputScreenReferences>
          {mentionedFiles.length > 0 && (
            <div className="flex w-full flex-wrap items-start justify-start gap-1.5 px-3 pt-2">
              {mentionedFiles.map((file) => (
                <div
                  key={file.id}
                  className="group relative inline-flex h-6 cursor-default select-none items-center gap-1 rounded-[5px] pl-1.5 pr-1 bg-gradient-to-b from-foreground/[0.06] to-foreground/[0.03] ring-1 ring-inset ring-foreground/[0.08]"
                >
                  <ClipboardText size={10} className="text-foreground/45" />
                  <span className="max-w-[220px] truncate text-[12px] font-medium tracking-tight text-foreground/70 group-hover:text-foreground/85">
                    {file.path}
                  </span>
                  <button
                    aria-label={`Remove ${file.displayName}`}
                    className="ml-0.5 flex size-4 shrink-0 cursor-pointer items-center justify-center rounded opacity-0 transition-all duration-150 group-hover:opacity-100 hover:bg-foreground/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeMentionedFile(file.id);
                    }}
                    type="button"
                  >
                    <CloseCircle size={10} className="text-foreground/50" />
                    <span className="sr-only">Remove</span>
                  </button>
                </div>
              ))}
            </div>
          )}
          <PromptInputBody>
            <PromptInputTextarea
              id={composerTextareaId}
              data-chat-composer-textarea
              placeholder="Describe what to design..."
              disabled={isLoading}
              className="min-h-[56px] max-h-[200px]"
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                syncCaretPosition(event.currentTarget)
              }
              onClick={(event) => syncCaretPosition(event.currentTarget)}
              onKeyUp={(event) => syncCaretPosition(event.currentTarget)}
              onSelect={(event) => syncCaretPosition(event.currentTarget as HTMLTextAreaElement)}
            />
          </PromptInputBody>
          {mentionOpen && (
            <div className="w-full px-3 pb-1">
              <div className="max-h-56 overflow-y-auto rounded-lg border border-border/60 bg-card shadow-sm">
                {isSearchingMentions ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">Searching files...</div>
                ) : mentionSearchResults.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">No files found</div>
                ) : (
                  mentionSearchResults.map((result, index) => (
                    <button
                      key={result.path}
                      type="button"
                      className={cn(
                        "flex w-full items-start justify-between gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/40",
                        index === highlightedMentionIndex && "bg-muted/50",
                      )}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => selectMentionResult(result)}
                    >
                      <span className="truncate font-medium">{result.displayName}</span>
                      <span className="truncate text-xs text-muted-foreground">{result.path}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
          <PromptInputFooter>
            {/* Left side - agent selector, model selector, thinking mode */}
            <PromptInputTools className="min-w-0 flex-1">
              <div className="flex items-center gap-1 overflow-x-auto max-w-[280px] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <AgentSelectorButton />
                <ModelSelectorButton />
                <ThinkingModeSelector />
              </div>
            </PromptInputTools>

            {/* Right side - attachment menu + submit */}
            <div className="flex items-center gap-1">
              <PromptInputAddAttachmentButton />
              <PromptInputSubmit
                disabled={!hasSubmittableInput && !isLoading}
                onClick={isLoading ? handleButtonClick : undefined}
                type={isLoading ? "button" : "submit"}
                className={cn(
                  "size-9 rounded-xl transition-all duration-200",
                  isLoading
                    ? "bg-destructive/90 text-destructive-foreground hover:bg-destructive shadow-lg shadow-destructive/25"
                    : hasSubmittableInput
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {isLoading ? (
                  <Stop size={14} className="fill-current" />
                ) : (
                  <ArrowUp size={16} />
                )}
              </PromptInputSubmit>
            </div>
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}

// Component to show the pending prompt immediately (optimistic UI)
function PendingPrompt() {
  const promptText = localStorage.getItem("dilag-initial-prompt") || "";
  const filesJson = localStorage.getItem("dilag-initial-files");
  let files: { url?: string; mediaType?: string; filename?: string }[] = [];
  try {
    if (filesJson) files = JSON.parse(filesJson);
  } catch { /* ignore malformed JSON */ }

  return (
    <>
      {/* User message */}
      <Message from="user" className="animate-slide-up ml-0!">
        <MessageContent className="ml-0! space-y-2">
          {/* File attachments */}
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {files.map((file, idx) => (
                <div
                  key={idx}
                  className="relative rounded-lg overflow-hidden border border-border/50 bg-muted/30"
                >
                  {file.mediaType?.startsWith("image/") && file.url ? (
                    <img
                      src={file.url}
                      alt={file.filename || "Attached image"}
                      className="max-w-[200px] max-h-[200px] object-contain"
                    />
                  ) : (
                    <div className="px-3 py-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <ClipboardText size={16} />
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
          {promptText && (
            <p className="whitespace-pre-wrap leading-relaxed">{promptText}</p>
          )}
        </MessageContent>
      </Message>

      {/* Thinking indicator for assistant */}
      <Message from="assistant" className="animate-slide-up">
        <MessageContent>
          <ThinkingIndicator />
        </MessageContent>
      </Message>
    </>
  );
}

export function ChatView() {
  const {
    messages,
    currentSessionId,
    currentSession,
    isLoading,
    isServerReady,
    error,
    sendMessage,
    stopSession,
    createSession,
    forkSession,
    revertToMessage,
    unrevertSession,
    sessionStatus,
  } = useSessions();

  const navigate = useNavigate();

  // Timeline dialog state
  const [timelineOpen, setTimelineOpen] = useState(false);

  // Get revert state for current session
  const sessionRevert = useSessionRevert(currentSessionId);

  // Handler for forking from a message
  const handleFork = useCallback(
    async (messageId: string) => {
      const newSessionId = await forkSession(messageId);
      if (newSessionId) {
        navigate({ to: "/studio/$sessionId", params: { sessionId: newSessionId } });
      }
    },
    [forkSession, navigate]
  );

  // Handler for reverting to a message
  const handleRevert = useCallback(
    async (messageId: string) => {
      await revertToMessage(messageId);
    },
    [revertToMessage]
  );

  // Handler for copying message text
  const handleCopyText = useCallback(async (messageId: string) => {
    const state = useSessionStore.getState();
    const parts = state.parts[messageId] || [];
    const text = parts
      .filter((p) => p.type === "text" && p.text)
      .map((p) => p.text!)
      .join("");
    await navigator.clipboard.writeText(text);
  }, []);

  // Handler for opening the timeline
  const handleOpenTimeline = useCallback(() => {
    setTimelineOpen(true);
  }, []);

  // Check if there's a pending initial prompt (from landing page navigation)
  const hasPendingPrompt = Boolean(
    localStorage.getItem("dilag-initial-prompt") ||
    localStorage.getItem("dilag-initial-files")
  );

  const firstUserMessageId = useMemo(() => messages.find((m) => m.role === "user")?.id, [messages]);
  const hideInitialMessageActions = useMemo(() => {
    const userCount = messages.reduce((count, message) => count + (message.role === "user" ? 1 : 0), 0);
    if (userCount !== 1) return false;

    const firstAssistant = messages.find((m) => m.role === "assistant");
    if (!firstAssistant) return false;

    const hasCompletedAssistant = messages.some(
      (m) => m.role === "assistant" && m.time.completed !== undefined
    );
    if (hasCompletedAssistant) return false;

    return firstAssistant.isStreaming && firstAssistant.time.completed === undefined;
  }, [messages]);

  // Activity cues (derived from available session events/state)
  const pendingPermissions = usePendingPermissions(currentSessionId);
  const pendingQuestions = usePendingQuestions(currentSessionId);
  const runningPermissionTools = useRunningPermissionTools(currentSessionId);
  const runningQuestionTools = useRunningQuestionTools(currentSessionId);
  const busyFallbackOnce = useBusyFallbackOnce(isLoading);

  const activityLabel = useMemo(() => {
    if (!isLoading) return undefined;

    if (pendingQuestions.length > 0) {
      return "Waiting for your answer";
    }

    if (pendingPermissions.length > 0) {
      return "Waiting for permission";
    }

    if (runningPermissionTools.length > 0) {
      const oldest = [...runningPermissionTools].sort((a, b) => a.startTime - b.startTime)[0];
      return formatToolActivity(oldest.tool);
    }

    if (runningQuestionTools.length > 0) {
      return "Preparing questions";
    }

    if (sessionStatus === "running") {
      return "Thinking";
    }

    return busyFallbackOnce;
  }, [
    isLoading,
    pendingQuestions.length,
    pendingPermissions.length,
    runningPermissionTools,
    runningQuestionTools.length,
    sessionStatus,
    busyFallbackOnce,
  ]);

  // Memoize turn start times (each user message starts a new turn)
  // Returns the most recent user message timestamp before a given index
  const getTurnStartTime = useMemo(() => {
    // Build a map of turn start times for each message index
    const turnStarts: number[] = [];
    let currentTurnStart = messages[0]?.time.created ?? 0;
    
    for (let i = 0; i < messages.length; i++) {
      if (messages[i].role === "user") {
        currentTurnStart = messages[i].time.created;
      }
      turnStarts[i] = currentTurnStart;
    }
    
    return (index: number) => turnStarts[index] ?? 0;
  }, [messages]);

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
      <AttachmentBridgeConnector />
      <div className="flex flex-col h-full">
        {/* Revert banner - shown when session is in revert state */}
        {sessionRevert && (
          <RevertBanner onUnrevert={unrevertSession} />
        )}

        {/* Messages area - flex-1 + min-h-0 allows proper flex shrinking */}
        <Conversation className="flex-1 min-h-0">
          <ConversationContent className="px-4">
            {messages.length === 0 && !hasPendingPrompt ? (
              <ConversationEmptyState>
                <p className="text-[13px] text-muted-foreground/50">
                  Describe your app to start designing
                </p>
              </ConversationEmptyState>
            ) : messages.length === 0 && hasPendingPrompt ? (
              <PendingPrompt />
            ) : (
              messages.map((message, index) => {
                // Check if this is the last assistant message
                const isLastAssistant = message.role === "assistant" &&
                  !messages.slice(index + 1).some((m) => m.role === "assistant");

                // Show timer on assistant messages that are followed by a user message or are at the end
                const nextMessage = messages[index + 1];
                const showTimer = message.role === "assistant" &&
                  (!nextMessage || nextMessage.role === "user");

                return message.role === "user" ? (
                  <UserMessage
                    key={message.id}
                    message={message}
                    index={index}
                    onFork={handleFork}
                    onRevert={handleRevert}
                    onCopyText={handleCopyText}
                    onOpenTimeline={handleOpenTimeline}
                    hideActions={hideInitialMessageActions && message.id === firstUserMessageId}
                  />
                ) : (
                  <AssistantMessage
                    key={message.id}
                    message={message}
                    index={index}
                    isLast={isLastAssistant}
                    showTimer={showTimer}
                    sessionStartTime={getTurnStartTime(index)}
                    activityLabel={
                      isLastAssistant &&
                      isLoading &&
                      message.time.completed === undefined
                        ? activityLabel
                        : undefined
                    }
                    onFork={handleFork}
                    onCopyText={handleCopyText}
                    onOpenTimeline={handleOpenTimeline}
                  />
                );
              })
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        {/* Input area */}
        <div className="shrink-0">
          {/* Question prompts - shown when AI is asking questions */}
          <QuestionList className="px-4 pb-2" />

          {/* Warning for stuck question tools */}
          <StuckToolWarning className="mx-4 mb-2" />

          {/* Permission prompts - shown when permissions are pending */}
          <PermissionList className="px-4 pb-2" />

          <ChatInputArea
            isLoading={isLoading}
            sendMessage={sendMessage}
            stopSession={stopSession}
            sessionCwd={currentSession?.cwd ?? null}
          />
        </div>

        {/* Timeline dialog */}
        <TimelineDialog
          open={timelineOpen}
          onOpenChange={setTimelineOpen}
          messages={messages}
          onFork={handleFork}
          onRevert={handleRevert}
        />
      </div>
    </PromptInputProvider>
  );
}
