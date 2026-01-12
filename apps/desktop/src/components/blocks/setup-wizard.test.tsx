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

      expect(screen.getByText("Setting up...")).toBeInTheDocument();
    });

    it("should call onComplete when both dependencies are installed", async () => {
      mockInvoke
        .mockResolvedValueOnce({ installed: true, version: "1.0.0", error: null })
        .mockResolvedValueOnce({ installed: true, version: "1.1.0", error: null });

      render(<SetupWizard onComplete={mockOnComplete} />);

      await waitFor(() => {
        expect(screen.getByText("Ready to go")).toBeInTheDocument();
      });

      await waitFor(
        () => {
          expect(mockOnComplete).toHaveBeenCalled();
        },
        { timeout: 1500 }
      );
    });

    it("should show OpenCode not found when OpenCode is missing", async () => {
      mockInvoke.mockResolvedValueOnce({
        installed: false,
        version: null,
        error: "OpenCode CLI not found",
      });

      render(<SetupWizard onComplete={mockOnComplete} />);

      await waitFor(() => {
        expect(screen.getByText("OpenCode not found")).toBeInTheDocument();
      });

      expect(mockOnComplete).not.toHaveBeenCalled();
    });

    it("should show Bun not found when OpenCode is installed but Bun is missing", async () => {
      mockInvoke
        .mockResolvedValueOnce({ installed: true, version: "1.0.0", error: null })
        .mockResolvedValueOnce({
          installed: false,
          version: null,
          error: "Bun not found",
        });

      render(<SetupWizard onComplete={mockOnComplete} />);

      await waitFor(() => {
        expect(screen.getByText("Bun not found")).toBeInTheDocument();
      });

      expect(mockOnComplete).not.toHaveBeenCalled();
    });

    it("should show 'Get Bun' button when Bun is missing", async () => {
      mockInvoke
        .mockResolvedValueOnce({ installed: true, version: "1.0.0", error: null })
        .mockResolvedValueOnce({
          installed: false,
          version: null,
          error: "Bun not found",
        });

      render(<SetupWizard onComplete={mockOnComplete} />);

      await waitFor(() => {
        expect(screen.getByText("Get Bun")).toBeInTheDocument();
      });
    });

    it("should show 'Get OpenCode' button when OpenCode is missing", async () => {
      mockInvoke.mockResolvedValueOnce({
        installed: false,
        version: null,
        error: null,
      });

      render(<SetupWizard onComplete={mockOnComplete} />);

      await waitFor(() => {
        expect(screen.getByText("Get OpenCode")).toBeInTheDocument();
      });
    });
  });

  describe("retry functionality", () => {
    it("should retry checking dependencies when 'Check again' is clicked", async () => {
      mockInvoke.mockResolvedValue({
        installed: false,
        version: null,
        error: null,
      });

      render(<SetupWizard onComplete={mockOnComplete} />);

      await waitFor(() => {
        expect(screen.getByText("Check again")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Check again"));

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe("continue anyway", () => {
    it("should allow user to continue anyway when dependency is missing", async () => {
      mockInvoke.mockResolvedValue({
        installed: false,
        version: null,
        error: null,
      });

      render(<SetupWizard onComplete={mockOnComplete} />);

      await waitFor(() => {
        expect(screen.getByText("Continue anyway")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Continue anyway"));

      expect(mockOnComplete).toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("should show error state when check throws", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("Network error"));

      render(<SetupWizard onComplete={mockOnComplete} />);

      await waitFor(() => {
        expect(screen.getByText("Something went wrong")).toBeInTheDocument();
      });
    });

    it("should show PATH issue hint when error suggests it", async () => {
      mockInvoke.mockResolvedValueOnce({
        installed: false,
        version: null,
        error: "No such file or directory",
      });

      render(<SetupWizard onComplete={mockOnComplete} />);

      await waitFor(() => {
        expect(
          screen.getByText(/may be installed but not in your PATH/i)
        ).toBeInTheDocument();
      });
    });
  });
});
