import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { ToolPart } from "./tool-part"

describe("ToolPart", () => {
  it("uses inline command labels before and after expanding a shell row", async () => {
    render(
      <ToolPart
        tool="bash"
        state={{
          status: "completed",
          input: {
            command:
              "git diff -- /Users/rohi/xcode/katkat/katkat/Domain/Services/TrackerCSVImport.swift",
          },
          metadata: {
            output: "diff --git a/katkatTests/katkatTests.swift b/katkatTests/katkatTests.swift",
          },
        }}
      />,
    )

    const trigger = screen.getByRole("button", { name: /Ran git diff --/ })
    expect(trigger).toBeInTheDocument()
    expect(trigger).toHaveClass("px-2")

    await userEvent.click(trigger)

    expect(screen.getByRole("button", { name: "Ran command" })).toBeInTheDocument()
    expect(screen.getByText("Shell")).toBeInTheDocument()
    expect(screen.getByText("Success")).toBeInTheDocument()
  })

  it("shows a shell exit code label for non-zero command exits", async () => {
    render(
      <ToolPart
        tool="bash"
        state={{
          status: "completed",
          input: {
            command:
              "xcodebuild test -project /Users/rohi/xcode/katkat/katkat.xcodeproj -scheme katkat",
          },
          metadata: {
            exit: 65,
            output: "Command line invocation:",
          },
        }}
      />,
    )

    await userEvent.click(screen.getByRole("button", { name: /Ran xcodebuild test/ }))

    expect(screen.getByRole("button", { name: "Ran command" })).toBeInTheDocument()
    expect(screen.getByText("Exit code 65")).toBeInTheDocument()
  })

  it("uses the searched-for phrasing for exploration rows", () => {
    render(
      <ToolPart
        tool="grep"
        state={{
          status: "completed",
          input: { pattern: "SmartImport|FoundationModels|Apple Intelligence" },
          output: "apps/desktop/src/example.ts:1:SmartImport",
        }}
      />,
    )

    expect(screen.getByRole("button", { name: /Searched for SmartImport/ })).toBeInTheDocument()
  })

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

    expect(
      screen.getByRole("button", { name: /Writing.*notes-app-dashboard\.html.*\+3/ }),
    ).toBeInTheDocument()
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

    expect(
      screen.getByRole("button", { name: /Edited.*profile\.html.*\+3.*-2/ }),
    ).toBeInTheDocument()
  })
})
