import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import { SetupWizard } from "./setup-wizard"

describe("SetupWizard", () => {
  const mockOnComplete = vi.fn()
  const mockStartAgent = vi.mocked(window.desktopBridge!.agent.start)

  beforeEach(() => {
    vi.clearAllMocks()
    mockStartAgent.mockReset()
  })

  it("starts the embedded Pi runtime", async () => {
    mockStartAgent.mockResolvedValueOnce({
      running: true,
      agentDir: "~/.dilag/pi",
      sessionCount: 0,
    })

    render(<SetupWizard onComplete={mockOnComplete} />)

    await waitFor(() => {
      expect(mockStartAgent).toHaveBeenCalledTimes(1)
      expect(screen.getByText("Ready")).toBeInTheDocument()
    })
  })

  it("shows checking state initially", () => {
    mockStartAgent.mockImplementation(() => new Promise(() => {}))

    render(<SetupWizard onComplete={mockOnComplete} />)

    expect(screen.getByText("Checking setup...")).toBeInTheDocument()
  })

  it("calls onComplete when Pi is ready", async () => {
    mockStartAgent.mockResolvedValueOnce({
      running: true,
      agentDir: "~/.dilag/pi",
      sessionCount: 0,
    })

    render(<SetupWizard onComplete={mockOnComplete} />)

    await waitFor(
      () => {
        expect(mockOnComplete).toHaveBeenCalled()
      },
      { timeout: 1500 },
    )
  })

  it("shows error actions when Pi startup fails", async () => {
    mockStartAgent.mockRejectedValueOnce(new Error("Pi startup failed"))

    render(<SetupWizard onComplete={mockOnComplete} />)

    await waitFor(() => {
      expect(screen.getByText("Setup failed")).toBeInTheDocument()
      expect(screen.getByText("Pi startup failed")).toBeInTheDocument()
      expect(screen.getByText("Try again")).toBeInTheDocument()
      expect(screen.getByText("Skip")).toBeInTheDocument()
    })
  })

  it("retries startup when Try again is clicked", async () => {
    mockStartAgent.mockRejectedValueOnce(new Error("Network error"))

    render(<SetupWizard onComplete={mockOnComplete} />)

    await waitFor(() => {
      expect(screen.getByText("Try again")).toBeInTheDocument()
    })

    mockStartAgent.mockResolvedValueOnce({
      running: true,
      agentDir: "~/.dilag/pi",
      sessionCount: 0,
    })

    fireEvent.click(screen.getByText("Try again"))

    await waitFor(() => {
      expect(mockStartAgent).toHaveBeenCalledTimes(2)
      expect(screen.getByText("Ready")).toBeInTheDocument()
    })
  })

  it("allows the user to skip setup after an error", async () => {
    mockStartAgent.mockRejectedValueOnce(new Error("Pi startup failed"))

    render(<SetupWizard onComplete={mockOnComplete} />)

    await waitFor(() => {
      expect(screen.getByText("Skip")).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText("Skip"))

    expect(mockOnComplete).toHaveBeenCalled()
  })
})
