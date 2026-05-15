import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ToolPart } from "./tool-part"

describe("ToolPart", () => {
  it("shows completed read output by default", async () => {
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

    expect(screen.getByText("Read")).toBeInTheDocument()
    expect(await screen.findByText(/Wellness content/)).toBeInTheDocument()
  })
})
