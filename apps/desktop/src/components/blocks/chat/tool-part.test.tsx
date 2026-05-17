import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { ToolPart } from "./tool-part"

describe("ToolPart", () => {
  it("shows completed read output after expanding", async () => {
    render(
      <ToolPart
        tool="read"
        state={{
          status: "completed",
          input: { filePath: "wellness.html" },
          output: "<html>\n  <body>Wellness content</body>\n</html>",
        }}
      />,
    )

    const trigger = screen.getByRole("button", { name: /Read.*wellness\.html/ })
    expect(trigger).toBeInTheDocument()
    expect(screen.queryByText(/Wellness content/)).not.toBeInTheDocument()

    await userEvent.click(trigger)

    expect(await screen.findByText(/Wellness content/)).toBeInTheDocument()
  })

  it("shows stale running tools as complete when the parent message is done", async () => {
    render(
      <ToolPart
        tool="write"
        isMessageComplete
        state={{
          status: "running",
          input: { filePath: "step-profile.html", content: "<html>Profile</html>" },
        }}
      />,
    )

    expect(screen.queryByText("Running")).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: /Wrote.*step-profile\.html/ }))

    expect(await screen.findByText("Success")).toBeInTheDocument()
  })

  it("shows write line additions without the pending shimmer treatment", () => {
    render(
      <ToolPart
        tool="write"
        state={{
          status: "pending",
          input: { filePath: "notes-app-dashboard.html", content: "<html>\n<body>\n</body>" },
        }}
      />,
    )

    expect(screen.getByRole("button", { name: /Writing.*notes-app-dashboard\.html.*\+3/ })).toBeInTheDocument()
    expect(screen.queryByText("Thinking...")).not.toBeInTheDocument()
  })

  it("shows edit additions and deletions from unified diff metadata", () => {
    render(
      <ToolPart
        tool="edit"
        state={{
          status: "completed",
          input: { filePath: "profile.html" },
          metadata: {
            diff: [
              "--- a/profile.html",
              "+++ b/profile.html",
              "@@ -1,3 +1,4 @@",
              "-old title",
              "-old copy",
              "+new title",
              "+new copy",
              "+new button",
            ].join("\n"),
          },
        }}
      />,
    )

    expect(screen.getByRole("button", { name: /Edited.*profile\.html.*\+3.*-2/ })).toBeInTheDocument()
  })
})
