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
})
