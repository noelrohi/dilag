import { useCallback } from "react"
import {
  usePendingQuestions,
  useCurrentSessionId,
  useSessionStore,
  type QuestionRequest,
} from "@/context/session-store"
import { QuestionPrompt } from "./question-prompt"
import { cn } from "@/lib/utils"
import { bridge } from "@/lib/bridge"

// Timeout for question reply requests (30 seconds)
const QUESTION_REPLY_TIMEOUT = 30000

async function withQuestionTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), QUESTION_REPLY_TIMEOUT)
      }),
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

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
      await withQuestionTimeout(
        bridge.agent.replyQuestion({ requestID: request.id, answers }),
        "Question reply timed out. Please retry.",
      )
      if (effectiveSessionId) removePendingQuestion(effectiveSessionId, request.id)
    },
    [effectiveSessionId, removePendingQuestion],
  )

  const handleReject = useCallback(
    async (request: QuestionRequest) => {
      await withQuestionTimeout(
        bridge.agent.rejectQuestion({ requestID: request.id }),
        "Question dismissal timed out. Please retry.",
      )
      if (effectiveSessionId) removePendingQuestion(effectiveSessionId, request.id)
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
