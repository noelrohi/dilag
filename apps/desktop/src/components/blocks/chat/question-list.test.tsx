import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useSessionStore } from "@/context/session-store"
import { QuestionList } from "./question-list"

const replyQuestion = vi.mocked(window.desktopBridge!.agent.replyQuestion)

describe("QuestionList", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSessionStore.setState({
      currentSessionId: "session-1",
      pendingQuestions: {
        "session-1": [
          {
            id: "question-1",
            sessionID: "session-1",
            questions: [
              {
                header: "Format",
                question: "Which format should we use?",
                options: [{ label: "Mobile", description: "Phone layout" }],
              },
            ],
          },
        ],
      },
    })
  })

  it("keeps answers visible after reply failure and retries them", async () => {
    const user = userEvent.setup()
    replyQuestion
      .mockRejectedValueOnce(new Error("Connection lost"))
      .mockResolvedValueOnce(undefined)

    render(<QuestionList sessionId="session-1" />)

    await user.click(screen.getByRole("button", { name: "Mobile" }))
    await user.click(screen.getByRole("button", { name: "Submit" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Connection lost")
    expect(screen.getByRole("button", { name: "Mobile" })).toHaveClass("bg-foreground")
    expect(useSessionStore.getState().pendingQuestions["session-1"]).toHaveLength(1)

    await user.click(screen.getByRole("button", { name: "Retry" }))

    await waitFor(() => {
      expect(screen.queryByText("Which format should we use?")).not.toBeInTheDocument()
    })
    expect(replyQuestion).toHaveBeenNthCalledWith(1, {
      requestID: "question-1",
      answers: [["Mobile"]],
    })
    expect(replyQuestion).toHaveBeenNthCalledWith(2, {
      requestID: "question-1",
      answers: [["Mobile"]],
    })
  })
})
