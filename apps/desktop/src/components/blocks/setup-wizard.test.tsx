import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { SetupWizard } from "./setup-wizard";

const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn(),
}));

describe("SetupWizard", () => {
  const mockOnComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockReset();
  });

  describe("dependency checking", () => {
    it("should check OpenCode first, then Bun", async () => {
      mockInvoke
        .mockResolvedValueOnce({ installed: true, version: "1.0.0", error: null })
        .mockResolvedValueOnce({ installed: true, version: "1.1.0", error: null });

      render(<SetupWizard onComplete={mockOnComplete} />);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith("check_opencode_installation");
      });

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith("check_bun_installation");
      });

      expect(mockInvoke).toHaveBeenCalledTimes(2);
    });

    it("should show checking state initially", () => {
      mockInvoke.mockImplementation(() => new Promise(() => {}));

      render(<SetupWizard onComplete={mockOnComplete} />);

      expect(screen.getByText("Checking setup...")).toBeInTheDocument();
    });

    it("should call onComplete when both dependencies are installed", async () => {
      mockInvoke
        .mockResolvedValueOnce({ installed: true, version: "1.0.0", error: null })
        .mockResolvedValueOnce({ installed: true, version: "1.1.0", error: null });

      render(<SetupWizard onComplete={mockOnComplete} />);

      await waitFor(() => {
        expect(screen.getByText("Ready")).toBeInTheDocument();
      });

      await waitFor(
        () => {
          expect(mockOnComplete).toHaveBeenCalled();
        },
        { timeout: 1500 }
      );
    });

    it("should show missing state when OpenCode is missing", async () => {
      mockInvoke.mockResolvedValueOnce({
        installed: false,
        version: null,
        error: "OpenCode CLI not found",
      });

      render(<SetupWizard onComplete={mockOnComplete} />);

      await waitFor(() => {
        expect(screen.getByText("Install required dependencies")).toBeInTheDocument();
      });

      expect(mockInvoke).toHaveBeenCalledWith("check_opencode_installation");
      expect(mockInvoke).toHaveBeenCalledTimes(1);
      expect(mockOnComplete).not.toHaveBeenCalled();
    });

    it("should show missing state when Bun is missing", async () => {
      mockInvoke
        .mockResolvedValueOnce({ installed: true, version: "1.0.0", error: null })
        .mockResolvedValueOnce({
          installed: false,
          version: null,
          error: "Bun not found",
        });

      render(<SetupWizard onComplete={mockOnComplete} />);

      await waitFor(() => {
        expect(screen.getByText("Install required dependencies")).toBeInTheDocument();
      });

      expect(mockInvoke).toHaveBeenCalledWith("check_opencode_installation");
      expect(mockInvoke).toHaveBeenCalledWith("check_bun_installation");
      expect(mockInvoke).toHaveBeenCalledTimes(2);
      expect(mockOnComplete).not.toHaveBeenCalled();
    });

    it("should show install and skip actions when dependencies are missing", async () => {
      mockInvoke.mockResolvedValueOnce({
        installed: false,
        version: null,
        error: null,
      });

      render(<SetupWizard onComplete={mockOnComplete} />);

      await waitFor(() => {
        expect(screen.getByText("Install")).toBeInTheDocument();
        expect(screen.getByText("Skip")).toBeInTheDocument();
      });
    });
  });

  describe("retry functionality", () => {
    it("should retry checking dependencies when 'Try again' is clicked", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("Network error"));

      render(<SetupWizard onComplete={mockOnComplete} />);

      await waitFor(() => {
        expect(screen.getByText("Try again")).toBeInTheDocument();
      });

      mockInvoke.mockResolvedValueOnce({ installed: true, version: "1.0.0", error: null });
      mockInvoke.mockResolvedValueOnce({ installed: true, version: "1.1.0", error: null });

      fireEvent.click(screen.getByText("Try again"));

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith("check_opencode_installation");
      });

      expect(mockInvoke).toHaveBeenCalledTimes(3);
    });
  });

  describe("continue anyway", () => {
    it("should allow user to skip setup when dependency is missing", async () => {
      mockInvoke.mockResolvedValue({
        installed: false,
        version: null,
        error: null,
      });

      render(<SetupWizard onComplete={mockOnComplete} />);

      await waitFor(() => {
        expect(screen.getByText("Skip")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Skip"));

      expect(mockOnComplete).toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("should show error state when check throws", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("Network error"));

      render(<SetupWizard onComplete={mockOnComplete} />);

      await waitFor(() => {
        expect(screen.getByText("Setup failed")).toBeInTheDocument();
        expect(screen.getByText("Network error")).toBeInTheDocument();
      });
    });
  });
});
