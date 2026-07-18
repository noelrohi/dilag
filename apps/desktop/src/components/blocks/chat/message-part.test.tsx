import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { MessagePart as MessagePartType } from "@/context/session-store"
import { getReasoningBody, getReasoningTitle, MessagePart } from "./message-part"

const reasoningPart: MessagePartType = {
  id: "reasoning-1",
  messageID: "message-1",
  sessionID: "session-1",
  type: "reasoning",
  text: "I should inspect the project before editing.",
}

describe("MessagePart", () => {
  it("renders plain reasoning inline like Pi TUI", () => {
    render(<MessagePart part={reasoningPart} isStreaming />)

    expect(screen.queryByText(/Thinking/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Thought/)).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /I should inspect/ })).not.toBeInTheDocument()
    expect(screen.getByText("I should inspect the project before editing.")).toBeInTheDocument()
  })

  it("uses model-provided markdown headings as expandable reasoning titles", () => {
    render(
      <MessagePart
        part={{
          ...reasoningPart,
          text: "**Testing duplicate content**\n\nI'm thinking about tests.",
        }}
        isStreaming={false}
      />,
    )

    const trigger = screen.getByRole("button", { name: /Testing duplicate content/ })
    expect(trigger).toHaveClass("h-7", "py-1")
    expect(screen.getByText("I'm thinking about tests.")).toBeInTheDocument()
  })

  it("normalizes markdown-ish reasoning titles and excludes the title from body", () => {
    expect(getReasoningTitle("## Plan\nMore detail")).toBe("Plan")
    expect(getReasoningTitle("- Inspect files\nThen edit")).toBeUndefined()
    expect(getReasoningTitle("**Testing duplicate content**\nMore detail")).toBe(
      "Testing duplicate content",
    )
    expect(getReasoningTitle("\n\n")).toBeUndefined()
    expect(getReasoningBody("## Plan\nMore detail")).toBe("More detail")
    expect(getReasoningBody("I need to inspect files.\nThen edit.")).toBe(
      "I need to inspect files.\nThen edit.",
    )
  })

  it.each(["pending", "running"] as const)("hides %s question tool duplicates", (status) => {
    const { container } = render(
      <MessagePart
        part={{
          id: "question-1",
          type: "tool",
          tool: "question",
          state: {
            status,
            input: { questions: [{ header: "Format", question: "Which format?" }] },
          },
        }}
        isStreaming
      />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  it("renders a completed question tool", () => {
    render(
      <MessagePart
        part={{
          id: "question-1",
          type: "tool",
          tool: "question",
          state: {
            status: "completed",
            input: { questions: [{ header: "Format", question: "Which format?" }] },
            metadata: { answers: [["Mobile"]] },
          },
        }}
      />,
    )

    expect(screen.getByRole("button", { name: /Asked question.*Mobile.*Success/ })).toBeInTheDocument()
  })

  it("renders an interrupted question tool as a terminal row", () => {
    render(
      <MessagePart
        part={{
          id: "question-1",
          type: "tool",
          tool: "question",
          state: {
            status: "error",
            error: "Interrupted",
            input: { questions: [{ header: "Format", question: "Which format?" }] },
          },
        }}
      />,
    )

    expect(screen.getByRole("button", { name: /Interrupted.*Which format.*Interrupted/ })).toBeInTheDocument()
  })
})
