import { useElapsedTime } from "@/hooks/use-elapsed-time";
import { cn } from "@/lib/utils";
import { DilagIcon } from "@/components/ui/dilag-icon";
import type { Message } from "@/context/session-store";

interface MessageDurationProps {
  message: Message;
  className?: string;
}

export function MessageDuration({ message, className }: MessageDurationProps) {
  const elapsed = useElapsedTime(message.time.created, message.time.completed);
  // Use time.completed as source of truth - isStreaming can be unreliable
  const isComplete = message.time.completed !== undefined;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-muted-foreground transition-opacity",
        isComplete ? "opacity-60" : "opacity-90",
        className
      )}
    >
      <DilagIcon animated={!isComplete} className="size-3.5" />
      <span className="font-mono text-xs tabular-nums tracking-tight">
        {isComplete ? `Took ${elapsed}` : elapsed}
      </span>
    </span>
  );
}
