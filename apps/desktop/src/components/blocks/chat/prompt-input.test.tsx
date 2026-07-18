import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { PromptInputProvider, PromptInputTextarea } from "./prompt-input"

describe("PromptInputTextarea", () => {
  function renderTextarea(onSubmit = vi.fn()) {
    render(
      <PromptInputProvider>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit()
          }}
        >
          <PromptInputTextarea aria-label="Prompt" />
          <button type="submit">Send</button>
        </form>
      </PromptInputProvider>,
    )

    return {
      textarea: screen.getByRole("textbox", { name: "Prompt" }),
      onSubmit,
    }
  }

  it("submits on plain Enter", () => {
    const { textarea, onSubmit } = renderTextarea()

    fireEvent.keyDown(textarea, { key: "Enter" })

    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it("leaves Cmd/Ctrl+Enter for higher-level steering shortcuts", () => {
    const { textarea, onSubmit } = renderTextarea()

    fireEvent.keyDown(textarea, { key: "Enter", metaKey: true })
    fireEvent.keyDown(textarea, { key: "Enter", ctrlKey: true })

    expect(onSubmit).not.toHaveBeenCalled()
  })
})
