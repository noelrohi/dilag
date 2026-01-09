import { useCallback } from "react";
import {
  usePendingQuestions,
  useCurrentSessionId,
  useSessionStore,
  type QuestionRequest,
} from "@/context/session-store";
import { QuestionPrompt } from "@/components/ai-elements/question-prompt";
import { cn } from "@/lib/utils";
import { useSessionsList } from "@/hooks/use-session-data";
import { useSDK } from "@/context/global-events";

// Timeout for question reply requests (30 seconds)
const QUESTION_REPLY_TIMEOUT = 30000;

interface QuestionListProps {
  sessionId?: string;
  className?: string;
}

export function QuestionList({ sessionId, className }: QuestionListProps) {
  const sdk = useSDK();
  const currentSessionId = useCurrentSessionId();
  const effectiveSessionId = sessionId ?? currentSessionId;
  const pendingQuestions = usePendingQuestions(effectiveSessionId);
  const removePendingQuestion = useSessionStore((s) => s.removePendingQuestion);
  const { data: sessions = [] } = useSessionsList();

  // Get the session's directory (cwd) for API calls
  const getSessionDirectory = useCallback(
    (sessionID: string): string | undefined => {
      const session = sessions.find((s) => s.id === sessionID);
      return session?.cwd;
    },
    [sessions]
  );

  const handleReply = useCallback(
    async (request: QuestionRequest, answers: string[][]) => {
      const directory = getSessionDirectory(request.sessionID);
      try {
        // Create a timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error("Question reply timeout")),
            QUESTION_REPLY_TIMEOUT
          );
        });

        // Race between the actual reply and timeout
        const response = await Promise.race([
          sdk.question.reply({
            requestID: request.id,
            directory,
            answers,
          }),
          timeoutPromise,
        ]);

        if (response.data !== undefined && effectiveSessionId) {
          removePendingQuestion(effectiveSessionId, request.id);
          console.log("[QuestionList] Question reply successful, removed from store");
        } else {
          console.error("[QuestionList] Failed to reply:", response.error);
          // Still remove on error to prevent stuck state
          if (effectiveSessionId) {
            removePendingQuestion(effectiveSessionId, request.id);
          }
        }
      } catch (err) {
        console.error("[QuestionList] Failed to reply:", err);
        // Remove question on timeout/error to prevent stuck state
        if (effectiveSessionId) {
          removePendingQuestion(effectiveSessionId, request.id);
          useSessionStore.getState().abortRunningTools(effectiveSessionId);
        }
      }
    },
    [effectiveSessionId, removePendingQuestion, getSessionDirectory, sdk]
  );

  const handleReject = useCallback(
    async (request: QuestionRequest) => {
      const directory = getSessionDirectory(request.sessionID);
      try {
        // Create a timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error("Question reject timeout")),
            QUESTION_REPLY_TIMEOUT
          );
        });

        // Race between the actual reject and timeout
        const response = await Promise.race([
          sdk.question.reject({
            requestID: request.id,
            directory,
          }),
          timeoutPromise,
        ]);

        if (response.data !== undefined && effectiveSessionId) {
          removePendingQuestion(effectiveSessionId, request.id);
          console.log("[QuestionList] Question reject successful, removed from store");
        } else {
          console.error("[QuestionList] Failed to reject:", response.error);
          // Still remove on error to prevent stuck state
          if (effectiveSessionId) {
            removePendingQuestion(effectiveSessionId, request.id);
          }
        }
      } catch (err) {
        console.error("[QuestionList] Failed to reject:", err);
        // Remove question on timeout/error to prevent stuck state
        if (effectiveSessionId) {
          removePendingQuestion(effectiveSessionId, request.id);
          useSessionStore.getState().abortRunningTools(effectiveSessionId);
        }
      }
    },
    [effectiveSessionId, removePendingQuestion, getSessionDirectory, sdk]
  );

  if (!effectiveSessionId || pendingQuestions.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-2", className)}>
      {pendingQuestions.map((request) => (
        <QuestionPrompt
          key={request.id}
          request={request}
          onReply={(answers) => handleReply(request, answers)}
          onReject={() => handleReject(request)}
        />
      ))}
    </div>
  );
}
