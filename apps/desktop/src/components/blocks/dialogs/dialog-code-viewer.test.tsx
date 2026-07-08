import { describe, it, expect, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { DesignMutationResult } from "@dilag/desktop-bridge"

const mocks = vi.hoisted(() => ({
  write: vi.fn(),
}))

vi.mock("@/lib/bridge", () => ({
  bridge: {
    designs: {
      write: mocks.write,
    },
  },
}))

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

// @pierre/diffs/react pulls in a CJS `lru_map` dependency that does not
// interop cleanly under vitest's ESM transform; it is irrelevant to what
// these tests assert (dirty-state, save, and violation rendering), so stub
// it with a plain <pre> that surfaces the contents for assertions.
vi.mock("@pierre/diffs/react", () => ({
  File: ({ file }: { file: { contents: string } }) => <pre>{file.contents}</pre>,
}))

import { CodeViewerDialog } from "./dialog-code-viewer"

const CODE = "<!doctype html><title>Home</title>"

describe("CodeViewerDialog", () => {
  it("does not render an Edit button in view-only mode (no sessionCwd/filename)", async () => {
    const user = userEvent.setup()
    render(
      <CodeViewerDialog code={CODE} title="Home">
        <button type="button">Open</button>
      </CodeViewerDialog>,
    )

    await user.click(screen.getByRole("button", { name: "Open" }))

    expect(screen.queryByRole("button", { name: /save/i })).not.toBeInTheDocument()
    expect(document.querySelector("textarea")).not.toBeInTheDocument()
  })

  it("does not render an Edit button when readOnly", async () => {
    const user = userEvent.setup()
    render(
      <CodeViewerDialog
        code={CODE}
        title="Home"
        sessionCwd="/tmp/session"
        filename="home.html"
        readOnly
      >
        <button type="button">Open</button>
      </CodeViewerDialog>,
    )

    await user.click(screen.getByRole("button", { name: "Open" }))

    expect(document.querySelector("textarea")).not.toBeInTheDocument()
  })

  it("edits, saves, and exits edit mode on a successful write", async () => {
    mocks.write.mockResolvedValueOnce({
      ok: true,
      filename: "home.html",
    } satisfies DesignMutationResult)
    const onSaved = vi.fn()
    const user = userEvent.setup()

    render(
      <CodeViewerDialog
        code={CODE}
        title="Home"
        sessionCwd="/tmp/session"
        filename="home.html"
        onSaved={onSaved}
      >
        <button type="button">Open</button>
      </CodeViewerDialog>,
    )

    await user.click(screen.getByRole("button", { name: "Open" }))

    const editButtons = screen.getAllByRole("button")
    const editButton = editButtons.find((button) => button.querySelector("svg.tabler-icon-pencil"))
    expect(editButton).toBeTruthy()
    await user.click(editButton as HTMLElement)

    const textarea = document.querySelector("textarea") as HTMLTextAreaElement
    expect(textarea).toBeTruthy()
    await user.clear(textarea)
    await user.type(textarea, "<p>Updated</p>")

    await user.click(screen.getByRole("button", { name: /save/i }))

    await waitFor(() => {
      expect(mocks.write).toHaveBeenCalledWith({
        sessionCwd: "/tmp/session",
        filename: "home.html",
        html: "<p>Updated</p>",
      })
    })
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    await waitFor(() => expect(document.querySelector("textarea")).not.toBeInTheDocument())
  })

  it("shows violations inline and stays in edit mode without calling onSaved", async () => {
    mocks.write.mockResolvedValueOnce({
      ok: false,
      reason: "Validation failed",
      violations: [{ rule: "keyframes", snippet: "@keyframes" }],
    } satisfies DesignMutationResult)
    const onSaved = vi.fn()
    const user = userEvent.setup()

    render(
      <CodeViewerDialog
        code={CODE}
        title="Home"
        sessionCwd="/tmp/session"
        filename="home.html"
        onSaved={onSaved}
      >
        <button type="button">Open</button>
      </CodeViewerDialog>,
    )

    await user.click(screen.getByRole("button", { name: "Open" }))

    const editButtons = screen.getAllByRole("button")
    const editButton = editButtons.find((button) => button.querySelector("svg.tabler-icon-pencil"))
    await user.click(editButton as HTMLElement)

    const textarea = document.querySelector("textarea") as HTMLTextAreaElement
    await user.type(textarea, " edited")
    await user.click(screen.getByRole("button", { name: /save/i }))

    await waitFor(() => expect(screen.getByText("@keyframes")).toBeInTheDocument())
    expect(document.querySelector("textarea")).toBeInTheDocument()
    expect(onSaved).not.toHaveBeenCalled()
  })
})
