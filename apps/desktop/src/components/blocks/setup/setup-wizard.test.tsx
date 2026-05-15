import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import { SetupWizard } from "./setup-wizard"

describe("SetupWizard", () => {
  const mockOnComplete = vi.fn()
  const mockCheckOpenCode = vi.mocked(window.desktopBridge!.opencode.checkInstallation)
  const mockCheckBun = vi.mocked(window.desktopBridge!.opencode.checkBunInstallation)

  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckOpenCode.mockReset()
    mockCheckBun.mockReset()
  })

  describe("dependency checking", () => {
    it("should check OpenCode first, then Bun", async () => {
      mockCheckOpenCode.mockResolvedValueOnce({ installed: true, version: "1.0.0", error: null })
      mockCheckBun.mockResolvedValueOnce({ installed: true, version: "1.1.0", error: null })

      render(<SetupWizard onComplete={mockOnComplete} />)

      await waitFor(() => {
        expect(mockCheckOpenCode).toHaveBeenCalled()
      })

      await waitFor(() => {
        expect(mockCheckBun).toHaveBeenCalled()
      })

      expect(mockCheckOpenCode).toHaveBeenCalledTimes(1)
      expect(mockCheckBun).toHaveBeenCalledTimes(1)
    })

    it("should show checking state initially", () => {
      mockCheckOpenCode.mockImplementation(() => new Promise(() => {}))

      render(<SetupWizard onComplete={mockOnComplete} />)

      expect(screen.getByText("Checking setup...")).toBeInTheDocument()
    })

    it("should call onComplete when both dependencies are installed", async () => {
      mockCheckOpenCode.mockResolvedValueOnce({ installed: true, version: "1.0.0", error: null })
      mockCheckBun.mockResolvedValueOnce({ installed: true, version: "1.1.0", error: null })

      render(<SetupWizard onComplete={mockOnComplete} />)

      await waitFor(() => {
        expect(screen.getByText("Ready")).toBeInTheDocument()
      })

      await waitFor(
        () => {
          expect(mockOnComplete).toHaveBeenCalled()
        },
        { timeout: 1500 },
      )
    })

    it("should show missing state when OpenCode is missing", async () => {
      mockCheckOpenCode.mockResolvedValueOnce({
        installed: false,
        version: null,
        error: "OpenCode CLI not found",
      })

      render(<SetupWizard onComplete={mockOnComplete} />)

      await waitFor(() => {
        expect(screen.getByText("Install required dependencies")).toBeInTheDocument()
      })

      expect(mockCheckOpenCode).toHaveBeenCalledTimes(1)
      expect(mockCheckBun).not.toHaveBeenCalled()
      expect(mockOnComplete).not.toHaveBeenCalled()
    })

    it("should show missing state when Bun is missing", async () => {
      mockCheckOpenCode.mockResolvedValueOnce({ installed: true, version: "1.0.0", error: null })
      mockCheckBun.mockResolvedValueOnce({
        installed: false,
        version: null,
        error: "Bun not found",
      })

      render(<SetupWizard onComplete={mockOnComplete} />)

      await waitFor(() => {
        expect(screen.getByText("Install required dependencies")).toBeInTheDocument()
      })

      expect(mockCheckOpenCode).toHaveBeenCalledTimes(1)
      expect(mockCheckBun).toHaveBeenCalledTimes(1)
      expect(mockOnComplete).not.toHaveBeenCalled()
    })

    it("should show install and skip actions when dependencies are missing", async () => {
      mockCheckOpenCode.mockResolvedValueOnce({
        installed: false,
        version: null,
        error: null,
      })

      render(<SetupWizard onComplete={mockOnComplete} />)

      await waitFor(() => {
        expect(screen.getByText("Install")).toBeInTheDocument()
        expect(screen.getByText("Skip")).toBeInTheDocument()
      })
    })
  })

  describe("retry functionality", () => {
    it("should retry checking dependencies when 'Try again' is clicked", async () => {
      mockCheckOpenCode.mockRejectedValueOnce(new Error("Network error"))

      render(<SetupWizard onComplete={mockOnComplete} />)

      await waitFor(() => {
        expect(screen.getByText("Try again")).toBeInTheDocument()
      })

      mockCheckOpenCode.mockResolvedValueOnce({ installed: true, version: "1.0.0", error: null })
      mockCheckBun.mockResolvedValueOnce({ installed: true, version: "1.1.0", error: null })

      fireEvent.click(screen.getByText("Try again"))

      await waitFor(() => {
        expect(mockCheckOpenCode).toHaveBeenCalledTimes(2)
      })

      expect(mockCheckBun).toHaveBeenCalledTimes(1)
    })
  })

  describe("continue anyway", () => {
    it("should allow user to skip setup when dependency is missing", async () => {
      mockCheckOpenCode.mockResolvedValue({
        installed: false,
        version: null,
        error: null,
      })

      render(<SetupWizard onComplete={mockOnComplete} />)

      await waitFor(() => {
        expect(screen.getByText("Skip")).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText("Skip"))

      expect(mockOnComplete).toHaveBeenCalled()
    })
  })

  describe("error handling", () => {
    it("should show error state when check throws", async () => {
      mockCheckOpenCode.mockRejectedValueOnce(new Error("Network error"))

      render(<SetupWizard onComplete={mockOnComplete} />)

      await waitFor(() => {
        expect(screen.getByText("Setup failed")).toBeInTheDocument()
        expect(screen.getByText("Network error")).toBeInTheDocument()
      })
    })
  })
})
