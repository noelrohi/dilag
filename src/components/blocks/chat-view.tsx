import { useState, useRef, useEffect } from "react";
import { Send, Loader2 } from "lucide-react";
import { useSessions } from "@/hooks/use-sessions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { MessagePart } from "./message-part";
import { extractTextFromParts } from "@/lib/opencode";

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

  // Show loading state while server is starting
  if (!isServerReady) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Starting OpenCode server...
          </p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center px-4">
          <p className="text-sm text-destructive">{error}</p>
          <p className="text-xs text-muted-foreground">
            Make sure OpenCode is installed and configured correctly.
          </p>
        </div>
      </div>
    );
  }

  // Show empty state when no session is selected
  if (!currentSessionId) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center px-4">
          <p className="text-lg font-medium">No session selected</p>
          <p className="text-sm text-muted-foreground">
            Create a new session to start chatting.
          </p>
          <Button onClick={() => createSession()}>Create Session</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">
              Send a message to start the conversation.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {message.role === "user" ? (
                  // User messages: simple bubble with text
                  <div className="max-w-[80%] rounded-lg px-4 py-2 bg-primary text-primary-foreground">
                    <p className="whitespace-pre-wrap text-sm">
                      {extractTextFromParts(message.parts)}
                    </p>
                  </div>
                ) : (
                  // Assistant messages: render all parts
                  <div className="max-w-[80%] flex flex-col gap-2">
                    {message.parts
                      .filter((p) => !(p.type === "tool" && p.tool === "todoread"))
                      .map((part) => (
                        <MessagePart key={part.id} part={part} />
                      ))}
                    {message.isStreaming && message.parts.length === 0 && (
                      <div className="bg-muted rounded-lg px-4 py-2">
                        <span className="inline-block w-2 h-4 bg-current animate-pulse" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            disabled={isLoading}
            className="min-h-[60px] max-h-[200px] resize-none"
            rows={1}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isLoading}
            className="shrink-0"
          >
            {isLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            <span className="sr-only">Send message</span>
          </Button>
        </form>
      </div>
    </div>
  );
}
