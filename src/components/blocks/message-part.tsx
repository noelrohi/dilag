import type { MessagePart as MessagePartType } from "@/lib/opencode";
import { MessageResponse } from "@/components/ai-elements/message";
import {
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
} from "@/components/ai-elements/reasoning";
import { getToolRenderer } from "./tool-renderers";

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
      const ToolRenderer = getToolRenderer(part.tool);
      return <ToolRenderer tool={part.tool} state={part.state} />;

    default:
      return null;
  }
}
