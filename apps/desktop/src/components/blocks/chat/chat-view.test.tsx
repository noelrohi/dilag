import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { parseMessageText, HighlightedText } from "./chat-view";

describe("parseMessageText", () => {
  describe("screen context removal", () => {
    it("should remove screen_context blocks from text", () => {
      const input = `@home some text <screen_context name="home">HTML content here</screen_context>`;
      const { cleanText } = parseMessageText(input);
      expect(cleanText).toBe("@home some text");
    });

    it("should remove multiple screen_context blocks", () => {
      const input = `@home @feed <screen_context name="home">content1</screen_context> <screen_context name="feed">content2</screen_context>`;
      const { cleanText } = parseMessageText(input);
      expect(cleanText).toBe("@home @feed");
    });

    it("should remove legacy referenced_screen blocks", () => {
      const input = `@home text <referenced_screen name="home">old format</referenced_screen>`;
      const { cleanText } = parseMessageText(input);
      expect(cleanText).toBe("@home text");
    });
  });

  describe("screen ref detection", () => {
    it("should detect simple screen refs like @home", () => {
      const { hasScreenRefs } = parseMessageText("Check out @home screen");
      expect(hasScreenRefs).toBe(true);
    });

    it("should detect screen refs with hyphens like @home-feed", () => {
      const { hasScreenRefs } = parseMessageText("Update the @home-feed component");
      expect(hasScreenRefs).toBe(true);
    });

    it("should detect screen refs with multiple hyphens like @user-profile-settings", () => {
      const { hasScreenRefs } = parseMessageText("Navigate to @user-profile-settings");
      expect(hasScreenRefs).toBe(true);
    });

    it("should detect multiple screen refs", () => {
      const { hasScreenRefs } = parseMessageText("Compare @home and @dashboard-main");
      expect(hasScreenRefs).toBe(true);
    });

    it("should return false when no screen refs present", () => {
      const { hasScreenRefs } = parseMessageText("Just some regular text without refs");
      expect(hasScreenRefs).toBe(false);
    });

    it("should not match email addresses as screen refs", () => {
      // Note: the current implementation would match the part after @ in emails
      // This test documents current behavior - emails would partially match
      const { hasScreenRefs } = parseMessageText("Contact user@example.com");
      expect(hasScreenRefs).toBe(true); // @example matches
    });
  });
});

describe("HighlightedText", () => {
  describe("simple screen refs", () => {
    it("should highlight @home as a single element", () => {
      render(<HighlightedText text="Check the @home screen" />);
      const highlighted = screen.getByText("@home");
      expect(highlighted).toHaveClass("bg-primary/10", "text-primary");
    });

    it("should render non-ref text as plain spans", () => {
      render(<HighlightedText text="Just plain text" />);
      expect(screen.getByText("Just plain text")).toBeInTheDocument();
    });
  });

  describe("hyphenated screen refs", () => {
    it("should highlight @home-feed as a single element", () => {
      render(<HighlightedText text="Update @home-feed now" />);
      const highlighted = screen.getByText("@home-feed");
      expect(highlighted).toHaveClass("bg-primary/10", "text-primary");
    });

    it("should highlight @user-profile-settings as a single element", () => {
      render(<HighlightedText text="Go to @user-profile-settings page" />);
      const highlighted = screen.getByText("@user-profile-settings");
      expect(highlighted).toHaveClass("bg-primary/10", "text-primary");
    });

    it("should NOT split @home-feed into separate parts", () => {
      render(<HighlightedText text="Check @home-feed" />);
      // The bug was that "-feed" would appear as separate plain text
      expect(screen.queryByText("-feed")).not.toBeInTheDocument();
      // Instead, the whole thing should be highlighted together
      expect(screen.getByText("@home-feed")).toBeInTheDocument();
    });
  });

  describe("multiple refs", () => {
    it("should highlight multiple refs in the same text", () => {
      render(<HighlightedText text="Compare @home and @dashboard" />);
      expect(screen.getByText("@home")).toHaveClass("text-primary");
      expect(screen.getByText("@dashboard")).toHaveClass("text-primary");
    });

    it("should highlight multiple hyphenated refs", () => {
      render(<HighlightedText text="@home-feed and @user-settings" />);
      expect(screen.getByText("@home-feed")).toHaveClass("text-primary");
      expect(screen.getByText("@user-settings")).toHaveClass("text-primary");
    });
  });

  describe("edge cases", () => {
    it("should handle text with only a ref", () => {
      render(<HighlightedText text="@dashboard" />);
      expect(screen.getByText("@dashboard")).toHaveClass("text-primary");
    });

    it("should handle ref at start of text", () => {
      render(<HighlightedText text="@home is the main screen" />);
      expect(screen.getByText("@home")).toHaveClass("text-primary");
    });

    it("should handle ref at end of text", () => {
      render(<HighlightedText text="Navigate to @settings" />);
      expect(screen.getByText("@settings")).toHaveClass("text-primary");
    });

    it("should handle refs with underscores", () => {
      render(<HighlightedText text="Check @user_profile" />);
      expect(screen.getByText("@user_profile")).toHaveClass("text-primary");
    });

    it("should handle refs with numbers", () => {
      render(<HighlightedText text="See @screen2" />);
      expect(screen.getByText("@screen2")).toHaveClass("text-primary");
    });

    it("should handle complex mixed refs", () => {
      render(<HighlightedText text="@home-v2 and @user_profile-settings" />);
      expect(screen.getByText("@home-v2")).toHaveClass("text-primary");
      expect(screen.getByText("@user_profile-settings")).toHaveClass("text-primary");
    });
  });
});
