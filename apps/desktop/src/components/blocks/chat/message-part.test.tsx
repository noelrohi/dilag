import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { MessagePart as MessagePartType } from "@/context/session-store"
import { MessagePart } from "./message-part"

const reasoningPart: MessagePartType = {
  id: "reasoning-1",
  messageID: "message-1",
  sessionID: "session-1",
  type: "reasoning",
  text: "I should inspect the project before editing.",
}

describe("MessagePart", () => {
  it("shows reasoning content while it is streaming", () => {
    render(<MessagePart part={reasoningPart} isStreaming />)

    expect(screen.getByText(/Thinking/)).toBeInTheDocument()
    expect(screen.getByText("I should inspect the project before editing.")).toBeInTheDocument()
  })

  it("collapses completed reasoning by default", () => {
    render(<MessagePart part={reasoningPart} isStreaming={false} />)

    expect(screen.getByText(/Thought/)).toBeInTheDocument()
    expect(screen.queryByText("I should inspect the project before editing.")).not.toBeInTheDocument()
  })
})
