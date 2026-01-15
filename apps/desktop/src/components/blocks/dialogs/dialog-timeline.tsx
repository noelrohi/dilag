import { useMemo } from "react";
import { Clock, GitFork, Undo2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@dilag/ui/dialog";
import { Button } from "@dilag/ui/button";
import { ScrollArea } from "@dilag/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@dilag/ui/tooltip";
import { useMessageParts, type Message as SessionMessage } from "@/context/session-store";

interface TimelineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages: SessionMessage[];
  onFork: (messageId: string) => void;
  onRevert: (messageId: string) => void;
}

function TimelineItem({
  message,
  onFork,
  onRevert,
}: {
  message: SessionMessage;
  onFork: (messageId: string) => void;
  onRevert: (messageId: string) => void;
}) {
  const parts = useMessageParts(message.id);
  const textContent = parts
    .filter((p) => p.type === "text" && p.text)
    .map((p) => p.text!)
    .join("");

  const truncatedText =
    textContent.length > 50 ? textContent.slice(0, 50) + "..." : textContent;

  const timeFormatted = new Date(message.time.created).toLocaleString();

  return (
    <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {truncatedText || "Empty message"}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
          <Clock className="size-3 shrink-0" />
          {timeFormatted}
        </p>
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => onFork(message.id)}
            >
              <GitFork className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Fork from here</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => onRevert(message.id)}
            >
              <Undo2 className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Revert to here</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

export function TimelineDialog({
  open,
  onOpenChange,
  messages,
  onFork,
  onRevert,
}: TimelineDialogProps) {
  // Filter to only user messages and reverse to show most recent first
  const userMessages = useMemo(
    () => messages.filter((m) => m.role === "user").reverse(),
    [messages]
  );

  const handleFork = (messageId: string) => {
    onFork(messageId);
    onOpenChange(false);
  };

  const handleRevert = (messageId: string) => {
    onRevert(messageId);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Session Timeline</DialogTitle>
          <DialogDescription>
            Navigate through your conversation history. Fork or revert from any
            point.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] -mx-6 px-6">
          <div className="space-y-1 overflow-hidden">
            {userMessages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No messages yet
              </p>
            ) : (
              userMessages.map((message) => (
                <TimelineItem
                  key={message.id}
                  message={message}
                  onFork={handleFork}
                  onRevert={handleRevert}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
