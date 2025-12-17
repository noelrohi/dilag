import type { MessagePart as MessagePartType } from "@/context/session-store";
import { MessageResponse } from "@/components/ai-elements/message";
import {
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
} from "@/components/ai-elements/reasoning";
import { ToolPart } from "./tool-part";
import { FileCode2 } from "lucide-react";
import { ErrorBoundary, InlineErrorFallback } from "@/components/ui/error-boundary";

interface MessagePartProps {
  part: MessagePartType;
}

export function MessagePart({ part }: MessagePartProps) {
  return (
    <ErrorBoundary fallback={<InlineErrorFallback message="Failed to render message part" />}>
      <MessagePartContent part={part} />
    </ErrorBoundary>
  );
}

function MessagePartContent({ part }: MessagePartProps) {
  switch (part.type) {
    case "text":
      if (!part.text?.trim()) return null;
      return (
        <div className="prose prose-sm prose-invert max-w-none">
          <MessageResponse>{part.text}</MessageResponse>
        </div>
      );

    case "reasoning":
      if (!part.text?.trim()) return null;
      return (
        <Reasoning isStreaming={false}>
          <ReasoningTrigger />
          <ReasoningContent>{part.text}</ReasoningContent>
        </Reasoning>
      );

    case "tool":
      if (!part.tool || !part.state) return null;
      return <ToolPart tool={part.tool} state={part.state} />;

    case "file":
      if (!part.url) return null;
      const isImage = part.mime?.startsWith("image/");
      if (isImage) {
        return (
          <div className="max-w-md rounded-xl overflow-hidden border border-border/50 bg-card/50">
            <img
              src={part.url}
              alt={part.filename || "Image"}
              className="w-full h-auto"
            />
            {part.filename && (
              <div className="px-3 py-2 bg-muted/30 text-xs text-muted-foreground font-mono">
                {part.filename}
              </div>
            )}
          </div>
        );
      }
      return (
        <div className="inline-flex items-center gap-2.5 rounded-lg border border-border/50 bg-card/50 px-3 py-2 text-sm">
          <FileCode2 className="size-4 text-primary/60" />
          <span className="font-mono text-sm">{part.filename || "File"}</span>
        </div>
      );

    case "step-start":
      if (!part.model) return null;
      return (
        <div className="inline-flex items-center gap-2 text-[10px] font-mono text-muted-foreground/50 py-1 uppercase tracking-wider">
          <div className="size-1 rounded-full bg-primary/40" />
          <span>
            {part.provider && `${part.provider}/`}
            {part.model}
          </span>
        </div>
      );

    case "step-finish":
      return null;

    default:
      return null;
  }
}
