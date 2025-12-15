import type { MessagePart as MessagePartType } from "@/lib/opencode";
import { MessageResponse } from "@/components/ai-elements/message";
import {
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
} from "@/components/ai-elements/reasoning";
import { ToolPart } from "./tool-part";
import { ImageIcon, BotIcon } from "lucide-react";

interface MessagePartProps {
  part: MessagePartType;
}

export function MessagePart({ part }: MessagePartProps) {
  switch (part.type) {
    case "text":
      if (!part.text?.trim()) return null;
      return <MessageResponse>{part.text}</MessageResponse>;

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
          <div className="max-w-md rounded-lg overflow-hidden border">
            <img
              src={part.url}
              alt={part.filename || "Image"}
              className="w-full h-auto"
            />
            {part.filename && (
              <div className="px-3 py-2 bg-muted text-xs text-muted-foreground">
                {part.filename}
              </div>
            )}
          </div>
        );
      }
      return (
        <div className="inline-flex items-center gap-2 rounded-md border bg-muted px-3 py-2 text-sm">
          <ImageIcon className="size-4 text-muted-foreground" />
          <span>{part.filename || "File"}</span>
        </div>
      );

    case "step-start":
      if (!part.model) return null;
      return (
        <div className="inline-flex items-center gap-2 text-xs text-muted-foreground py-1">
          <BotIcon className="size-3" />
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
