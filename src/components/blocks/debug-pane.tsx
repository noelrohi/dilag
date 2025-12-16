import { useState, useEffect, useRef } from "react";
import { Bug, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { Event } from "@opencode-ai/sdk/v2/client";

interface DebugPaneProps {
  events: Event[];
  onClear: () => void;
}

export function DebugPane({ events, onClear }: DebugPaneProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<string>("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events, isOpen]);

  const filteredEvents = filter
    ? events.filter((e) => e.type.includes(filter))
    : events;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border-t bg-background">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-between rounded-none h-8 px-4"
          >
            <div className="flex items-center gap-2">
              <Bug className="size-4" />
              <span className="text-xs font-medium">Debug Events</span>
              <span className="text-xs text-muted-foreground">
                ({events.length})
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              {isOpen ? "▼" : "▲"}
            </span>
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t">
            {/* Toolbar */}
            <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30">
              <input
                type="text"
                placeholder="Filter by event type..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="flex-1 text-xs bg-transparent border-none outline-none placeholder:text-muted-foreground"
              />
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                onClick={onClear}
              >
                <Trash2 className="size-3" />
              </Button>
            </div>

            {/* Events list */}
            <div
              ref={scrollRef}
              className="max-h-64 overflow-auto font-mono text-xs"
            >
              {filteredEvents.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  No events yet
                </div>
              ) : (
                filteredEvents.map((event, index) => (
                  <EventItem key={index} event={event} index={index} />
                ))
              )}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function EventItem({
  event,
  index,
}: {
  event: Event;
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);

  const typeColor = getTypeColor(event.type);

  return (
    <div
      className={cn(
        "border-b last:border-b-0 hover:bg-muted/30 cursor-pointer",
        expanded && "bg-muted/20"
      )}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-2 px-4 py-1.5">
        <span className="text-muted-foreground w-6">{index}</span>
        <span className={cn("font-medium", typeColor)}>{event.type}</span>
        {!expanded && (
          <span className="text-muted-foreground truncate flex-1">
            {getEventPreview(event)}
          </span>
        )}
      </div>
      {expanded && (
        <pre className="px-4 pb-2 text-[10px] text-muted-foreground overflow-x-auto">
          {JSON.stringify(event, null, 2)}
        </pre>
      )}
    </div>
  );
}

function getTypeColor(type: string): string {
  if (type.includes("error")) return "text-red-500";
  if (type.includes("updated")) return "text-blue-500";
  if (type.includes("created")) return "text-green-500";
  if (type.includes("completed")) return "text-purple-500";
  return "text-foreground";
}

function getEventPreview(event: Event): string {
  const props = event.properties as Record<string, unknown>;

  if (event.type === "message.part.updated") {
    const part = props.part as Record<string, unknown> | undefined;
    if (part) {
      if (part.type === "text") {
        const delta = props.delta as string | undefined;
        return delta ? `"${delta.slice(0, 50)}${delta.length > 50 ? "..." : ""}"` : "";
      }
      if (part.type === "tool") {
        return `tool: ${part.tool}`;
      }
      return `type: ${part.type}`;
    }
  }

  if (event.type === "message.updated") {
    const info = props.info as Record<string, unknown> | undefined;
    if (info) {
      const time = info.time as Record<string, unknown> | undefined;
      return `role: ${info.role}, completed: ${!!time?.completed}`;
    }
  }

  return "";
}
