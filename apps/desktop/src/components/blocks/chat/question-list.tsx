import { useCallback } from "react"
import {
  usePendingQuestions,
  useCurrentSessionId,
  useSessionStore,
  type QuestionRequest,
} from "@/context/session-store"
import { QuestionPrompt } from "@/components/ai-elements/question-prompt"
import { cn } from "@/lib/utils"
import { bridge } from "@/lib/bridge"

// Timeout for question reply requests (30 seconds)
const QUESTION_REPLY_TIMEOUT = 30000

interface QuestionListProps {
  sessionId?: string
  className?: string
}

export function QuestionList({ sessionId, className }: QuestionListProps) {
  const currentSessionId = useCurrentSessionId()
  const effectiveSessionId = sessionId ?? currentSessionId
  const pendingQuestions = usePendingQuestions(effectiveSessionId)
  const removePendingQuestion = useSessionStore((s) => s.removePendingQuestion)

  const handleReply = useCallback(
    async (request: QuestionRequest, answers: string[][]) => {
      try {
        // Create a timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("Question reply timeout")), QUESTION_REPLY_TIMEOUT)
        })

        // Race between the actual reply and timeout
        await Promise.race([
          bridge.agent.replyQuestion({
            requestID: request.id,
            answers,
          }),
          timeoutPromise,
        ])

        if (effectiveSessionId) {
          removePendingQuestion(effectiveSessionId, request.id)
          console.log("[QuestionList] Question reply successful, removed from store")
        }
      } catch (err) {
        console.error("[QuestionList] Failed to reply:", err)
        // Remove question on timeout/error to prevent stuck state
        if (effectiveSessionId) {
          removePendingQuestion(effectiveSessionId, request.id)
          useSessionStore.getState().abortRunningTools(effectiveSessionId)
        }
      }
    },
    [effectiveSessionId, removePendingQuestion],
  )

  const handleReject = useCallback(
    async (request: QuestionRequest) => {
      try {
        // Create a timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("Question reject timeout")), QUESTION_REPLY_TIMEOUT)
        })

        // Race between the actual reject and timeout
        await Promise.race([
          bridge.agent.rejectQuestion({
            requestID: request.id,
          }),
          timeoutPromise,
        ])

        if (effectiveSessionId) {
          removePendingQuestion(effectiveSessionId, request.id)
          console.log("[QuestionList] Question reject successful, removed from store")
        }
      } catch (err) {
        console.error("[QuestionList] Failed to reject:", err)
        // Remove question on timeout/error to prevent stuck state
        if (effectiveSessionId) {
          removePendingQuestion(effectiveSessionId, request.id)
          useSessionStore.getState().abortRunningTools(effectiveSessionId)
        }
      }
    },
    [effectiveSessionId, removePendingQuestion],
  )

  if (!effectiveSessionId || pendingQuestions.length === 0) {
    return null
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
  )
}
