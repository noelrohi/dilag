import { useState, useEffect } from "react";
import { DangerTriangle } from "@solar-icons/react";
import {
  useCurrentSessionId,
  useRunningQuestionTools,
  useRunningPermissionTools,
  usePendingQuestions,
  usePendingPermissions,
} from "@/context/session-store";
import { cn } from "@/lib/utils";

interface StuckToolWarningProps {
  sessionId?: string;
  className?: string;
  /** Time in ms before showing warning (default: 3000) */
  threshold?: number;
}

type StuckType = "question" | "permission" | null;

/**
 * Detects and displays a warning when a tool is running
 * but no pending question/permission exists in the queue.
 *
 * This typically indicates:
 * - For questions: tool validation failed server-side (e.g., too many options)
 * - For permissions: the permission.asked event was lost during SSE connection
 */
export function StuckToolWarning({
  sessionId,
  className,
  threshold = 3000,
}: StuckToolWarningProps) {
  const currentSessionId = useCurrentSessionId();
  const effectiveSessionId = sessionId ?? currentSessionId;

  // Question tools detection
  const runningQuestionTools = useRunningQuestionTools(effectiveSessionId);
  const pendingQuestions = usePendingQuestions(effectiveSessionId);

  // Permission tools detection
  const runningPermissionTools = useRunningPermissionTools(effectiveSessionId);
  const pendingPermissions = usePendingPermissions(effectiveSessionId);

  const [showWarning, setShowWarning] = useState(false);
  const [stuckSince, setStuckSince] = useState<number | null>(null);
  const [stuckType, setStuckType] = useState<StuckType>(null);
  const [stuckToolName, setStuckToolName] = useState<string | null>(null);

  useEffect(() => {
    // Check if there are running question tools with no pending questions
    const hasRunningQuestionTools = runningQuestionTools.length > 0;
    const hasPendingQuestions = pendingQuestions.length > 0;
    const isQuestionStuck = hasRunningQuestionTools && !hasPendingQuestions;

    // Check if there are running permission tools with no pending permissions
    const hasRunningPermissionTools = runningPermissionTools.length > 0;
    const hasPendingPermissions = pendingPermissions.length > 0;
    const isPermissionStuck = hasRunningPermissionTools && !hasPendingPermissions;

    if (!isQuestionStuck && !isPermissionStuck) {
      setShowWarning(false);
      setStuckSince(null);
      setStuckType(null);
      setStuckToolName(null);
      return;
    }

    // Determine which type is stuck and find earliest start time
    let earliestStart: number;
    let type: StuckType;
    let toolName: string | null = null;

    if (isQuestionStuck && isPermissionStuck) {
      // Both stuck - use the one that started earlier
      const questionEarliest = Math.min(...runningQuestionTools.map((t) => t.startTime));
      const permissionEarliest = Math.min(...runningPermissionTools.map((t) => t.startTime));
      if (questionEarliest <= permissionEarliest) {
        earliestStart = questionEarliest;
        type = "question";
      } else {
        earliestStart = permissionEarliest;
        type = "permission";
        toolName = runningPermissionTools.find((t) => t.startTime === permissionEarliest)?.tool ?? null;
      }
    } else if (isQuestionStuck) {
      earliestStart = Math.min(...runningQuestionTools.map((t) => t.startTime));
      type = "question";
    } else {
      earliestStart = Math.min(...runningPermissionTools.map((t) => t.startTime));
      type = "permission";
      toolName = runningPermissionTools.find((t) => t.startTime === earliestStart)?.tool ?? null;
    }

    const now = Date.now();
    const stuckDuration = now - earliestStart;

    if (stuckDuration >= threshold) {
      setShowWarning(true);
      setStuckSince(earliestStart);
      setStuckType(type);
      setStuckToolName(toolName);
    } else {
      // Set a timer to show warning after threshold
      const remaining = threshold - stuckDuration;
      const timer = setTimeout(() => {
        setShowWarning(true);
        setStuckSince(earliestStart);
        setStuckType(type);
        setStuckToolName(toolName);
      }, remaining);

      return () => clearTimeout(timer);
    }
  }, [runningQuestionTools, runningPermissionTools, pendingQuestions, pendingPermissions, threshold]);

  if (!showWarning) {
    return null;
  }

  const stuckDuration = stuckSince ? Math.floor((Date.now() - stuckSince) / 1000) : 0;

  const getMessage = () => {
    if (stuckType === "question") {
      return {
        title: "Question tool may be stuck",
        description: `A question tool has been running for ${stuckDuration}s without a pending question. This usually means validation failed. Try sending another message to retry.`,
      };
    }
    return {
      title: `${stuckToolName ?? "Tool"} may be stuck`,
      description: `A ${stuckToolName ?? "tool"} has been running for ${stuckDuration}s without a pending permission. The permission request may have been lost. Try refreshing or sending another message.`,
    };
  };

  const message = getMessage();

  return (
    <div
      className={cn(
        "rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3",
        "animate-slide-up",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <DangerTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-sm font-medium text-amber-500">
            {message.title}
          </span>
          <span className="text-xs text-amber-500/80">
            {message.description}
          </span>
        </div>
      </div>
    </div>
  );
}
