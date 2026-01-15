"use client";

import { useState, useCallback } from "react";
import { Alert, AlertTitle, AlertDescription } from "@dilag/ui/alert";
import { Button } from "@dilag/ui/button";
import { Textarea } from "@dilag/ui/textarea";
import { cn } from "@/lib/utils";
import {
  ShieldQuestion,
  Terminal,
  FileEdit,
  FolderSearch,
  Search,
  Globe,
  Bot,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  FileText,
} from "lucide-react";
import type { PermissionRequest } from "@/context/session-store";

export type PermissionReply = "once" | "always" | "reject";

export interface PermissionPromptProps {
  request: PermissionRequest;
  onReply: (reply: PermissionReply, message?: string) => Promise<void>;
  className?: string;
}

// Map permission types to icons and labels
const PERMISSION_CONFIG: Record<
  string,
  { icon: typeof ShieldQuestion; label: string; colorClass: string }
> = {
  bash: {
    icon: Terminal,
    label: "Shell Command",
    colorClass: "text-amber-500",
  },
  edit: {
    icon: FileEdit,
    label: "Edit File",
    colorClass: "text-blue-500",
  },
  write: {
    icon: FileEdit,
    label: "Write File",
    colorClass: "text-green-500",
  },
  read: {
    icon: FileText,
    label: "Read File",
    colorClass: "text-purple-500",
  },
  glob: {
    icon: FolderSearch,
    label: "Search Files",
    colorClass: "text-cyan-500",
  },
  grep: {
    icon: Search,
    label: "Search Content",
    colorClass: "text-cyan-500",
  },
  list: {
    icon: FolderOpen,
    label: "List Directory",
    colorClass: "text-purple-500",
  },
  webfetch: {
    icon: Globe,
    label: "Fetch URL",
    colorClass: "text-indigo-500",
  },
  websearch: {
    icon: Globe,
    label: "Web Search",
    colorClass: "text-indigo-500",
  },
  task: {
    icon: Bot,
    label: "Run Task",
    colorClass: "text-orange-500",
  },
  external_directory: {
    icon: FolderOpen,
    label: "External Directory",
    colorClass: "text-rose-500",
  },
};

function getPermissionConfig(permission: string) {
  return (
    PERMISSION_CONFIG[permission] ?? {
      icon: ShieldQuestion,
      label: permission,
      colorClass: "text-muted-foreground",
    }
  );
}

export function PermissionPrompt({
  request,
  onReply,
  className,
}: PermissionPromptProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectMessage, setRejectMessage] = useState("");
  const [expanded, setExpanded] = useState(false);

  const config = getPermissionConfig(request.permission);
  const Icon = config.icon;

  const handleReply = useCallback(
    async (reply: PermissionReply) => {
      setIsLoading(true);
      try {
        const message =
          reply === "reject" && rejectMessage.trim()
            ? rejectMessage.trim()
            : undefined;
        await onReply(reply, message);
      } finally {
        setIsLoading(false);
      }
    },
    [onReply, rejectMessage]
  );

  // Extract useful metadata based on permission type
  const getMetadataDisplay = () => {
    const { metadata, permission } = request;
    if (!metadata || Object.keys(metadata).length === 0) return null;

    if (permission === "bash") {
      const command = metadata.command as string | undefined;
      const description = metadata.description as string | undefined;
      return (
        <div className="space-y-1.5">
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
          {command && (
            <pre className="text-xs font-mono bg-muted/50 rounded px-2 py-1.5 overflow-x-auto whitespace-pre-wrap break-all">
              $ {command}
            </pre>
          )}
        </div>
      );
    }

    if (permission === "edit" || permission === "write") {
      const filepath = metadata.filepath as string | undefined;
      const diff = metadata.diff as string | undefined;
      return (
        <div className="space-y-1.5">
          {filepath && (
            <code className="text-xs text-muted-foreground font-mono bg-muted/30 px-1.5 py-0.5 rounded">
              {filepath}
            </code>
          )}
          {diff && (
            <pre className="text-xs font-mono bg-muted/50 rounded px-2 py-1.5 overflow-x-auto max-h-32 whitespace-pre-wrap">
              {diff}
            </pre>
          )}
        </div>
      );
    }

    if (permission === "read" || permission === "list") {
      const path = (metadata.filePath ?? metadata.path) as string | undefined;
      return path ? (
        <code className="text-xs text-muted-foreground font-mono bg-muted/30 px-1.5 py-0.5 rounded">
          {path}
        </code>
      ) : null;
    }

    if (permission === "glob") {
      const pattern = metadata.pattern as string | undefined;
      return pattern ? (
        <code className="text-xs text-muted-foreground font-mono bg-muted/30 px-1.5 py-0.5 rounded">
          {pattern}
        </code>
      ) : null;
    }

    if (permission === "grep") {
      const pattern = metadata.pattern as string | undefined;
      return pattern ? (
        <div className="text-sm">
          <span className="text-muted-foreground">Search: </span>
          <code className="font-mono bg-muted/30 px-1.5 py-0.5 rounded">
            {pattern}
          </code>
        </div>
      ) : null;
    }

    if (permission === "webfetch" || permission === "websearch") {
      const url = metadata.url as string | undefined;
      const query = metadata.query as string | undefined;
      return (
        <code className="text-xs text-muted-foreground font-mono bg-muted/30 px-1.5 py-0.5 rounded break-all">
          {url ?? query}
        </code>
      );
    }

    if (permission === "task") {
      const agentType = metadata.subagent_type as string | undefined;
      const description = metadata.description as string | undefined;
      return (
        <div className="space-y-1">
          {agentType && (
            <span className="text-xs font-medium bg-muted px-1.5 py-0.5 rounded capitalize">
              {agentType}
            </span>
          )}
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      );
    }

    return null;
  };

  // Format patterns for display
  const patternDisplay =
    request.patterns.length > 0 ? request.patterns.join(", ") : null;

  return (
    <Alert
      className={cn(
        "flex flex-col gap-3 border-amber-500/30 bg-amber-500/5",
        className
      )}
    >
      <Icon className={cn("size-4", config.colorClass)} />

      <div className="flex flex-col gap-2">
        <AlertTitle className="flex items-center gap-2">
          <span>Permission Required</span>
          <span
            className={cn(
              "text-xs px-1.5 py-0.5 rounded-md bg-muted",
              config.colorClass
            )}
          >
            {config.label}
          </span>
        </AlertTitle>

        <AlertDescription className="space-y-2">
          {/* Metadata display */}
          {getMetadataDisplay()}

          {/* Patterns display (if no metadata) */}
          {!getMetadataDisplay() && patternDisplay && (
            <p className="text-sm">
              <span className="text-muted-foreground">Patterns: </span>
              <code className="text-xs bg-muted px-1 rounded">
                {patternDisplay}
              </code>
            </p>
          )}

          {/* Expandable "always" options */}
          {request.always.length > 0 && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? (
                <ChevronUp className="size-3" />
              ) : (
                <ChevronDown className="size-3" />
              )}
              {expanded ? "Hide" : "Show"} &quot;Allow always&quot; patterns
            </button>
          )}
          {expanded && request.always.length > 0 && (
            <div className="text-xs text-muted-foreground bg-muted/30 rounded p-2 space-y-1">
              {request.always.map((opt, i) => (
                <div key={i} className="font-mono">
                  {opt}
                </div>
              ))}
            </div>
          )}
        </AlertDescription>
      </div>

      {/* Reject message input */}
      {showRejectInput && (
        <div className="space-y-2 col-span-full">
          <Textarea
            placeholder="Tell the AI what to do differently (optional)"
            value={rejectMessage}
            onChange={(e) => setRejectMessage(e.target.value)}
            className="text-sm min-h-[60px] resize-none"
            rows={2}
          />
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-2 col-span-full">
        {!showRejectInput ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowRejectInput(true)}
              disabled={isLoading}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              Reject
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleReply("once")}
              disabled={isLoading}
            >
              Allow once
            </Button>
            <Button
              size="sm"
              onClick={() => handleReply("always")}
              disabled={isLoading}
            >
              Allow always
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowRejectInput(false);
                setRejectMessage("");
              }}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => handleReply("reject")}
              disabled={isLoading}
            >
              Confirm Reject
            </Button>
          </>
        )}
      </div>
    </Alert>
  );
}
