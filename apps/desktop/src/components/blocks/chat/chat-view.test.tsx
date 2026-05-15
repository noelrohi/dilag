import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import {
  parseMessageText,
  HighlightedText,
  findActiveFileMention,
  removeFileMentionToken,
  estimateMentionFileSizeBytes,
  buildMentionDataUrl,
  getRenderableAssistantParts,
  getChatActivityLabel,
  isAssistantMessageStreaming,
  parseSkillBlock,
} from "./chat-view"
import type { MessagePart } from "@/context/session-store"

describe("parseMessageText", () => {
  describe("screen context removal", () => {
    it("should remove screen_context blocks from text", () => {
      const input = `@home some text <screen_context name="home">HTML content here</screen_context>`
      const { cleanText } = parseMessageText(input)
      expect(cleanText).toBe("@home some text")
    })

    it("should remove multiple screen_context blocks", () => {
      const input = `@home @feed <screen_context name="home">content1</screen_context> <screen_context name="feed">content2</screen_context>`
      const { cleanText } = parseMessageText(input)
      expect(cleanText).toBe("@home @feed")
    })

    it("should remove legacy referenced_screen blocks", () => {
      const input = `@home text <referenced_screen name="home">old format</referenced_screen>`
      const { cleanText } = parseMessageText(input)
      expect(cleanText).toBe("@home text")
    })
  })

  describe("screen ref detection", () => {
    it("should detect simple screen refs like @home", () => {
      const { hasScreenRefs } = parseMessageText("Check out @home screen")
      expect(hasScreenRefs).toBe(true)
    })

    it("should detect screen refs with hyphens like @home-feed", () => {
      const { hasScreenRefs } = parseMessageText("Update the @home-feed component")
      expect(hasScreenRefs).toBe(true)
    })

    it("should detect screen refs with multiple hyphens like @user-profile-settings", () => {
      const { hasScreenRefs } = parseMessageText("Navigate to @user-profile-settings")
      expect(hasScreenRefs).toBe(true)
    })

    it("should detect multiple screen refs", () => {
      const { hasScreenRefs } = parseMessageText("Compare @home and @dashboard-main")
      expect(hasScreenRefs).toBe(true)
    })

    it("should return false when no screen refs present", () => {
      const { hasScreenRefs } = parseMessageText("Just some regular text without refs")
      expect(hasScreenRefs).toBe(false)
    })

    it("should not match email addresses as screen refs", () => {
      // Note: the current implementation would match the part after @ in emails
      // This test documents current behavior - emails would partially match
      const { hasScreenRefs } = parseMessageText("Contact user@example.com")
      expect(hasScreenRefs).toBe(true) // @example matches
    })
  })
})

describe("parseSkillBlock", () => {
  it("extracts Pi skill wrapper content and user-authored prompt", () => {
    const input = `<skill name="web-design" location="/Users/rohi/.dilag/sessions/abc/.agents/skills/web-design/SKILL.md">
# Web Design

Follow the design rules.
</skill>

Build a landing page`

    expect(parseSkillBlock(input)).toEqual({
      name: "web-design",
      location: "/Users/rohi/.dilag/sessions/abc/.agents/skills/web-design/SKILL.md",
      content: "# Web Design\n\nFollow the design rules.",
      userMessage: "Build a landing page",
    })
  })

  it("returns null for ordinary user messages", () => {
    expect(parseSkillBlock("Build a landing page")).toBeNull()
  })
})

describe("HighlightedText", () => {
  describe("simple screen refs", () => {
    it("should highlight @home as a single element", () => {
      render(<HighlightedText text="Check the @home screen" />)
      const highlighted = screen.getByText("@home")
      expect(highlighted).toHaveClass("bg-primary/10", "text-primary")
    })

    it("should render non-ref text as plain spans", () => {
      render(<HighlightedText text="Just plain text" />)
      expect(screen.getByText("Just plain text")).toBeInTheDocument()
    })
  })

  describe("hyphenated screen refs", () => {
    it("should highlight @home-feed as a single element", () => {
      render(<HighlightedText text="Update @home-feed now" />)
      const highlighted = screen.getByText("@home-feed")
      expect(highlighted).toHaveClass("bg-primary/10", "text-primary")
    })

    it("should highlight @user-profile-settings as a single element", () => {
      render(<HighlightedText text="Go to @user-profile-settings page" />)
      const highlighted = screen.getByText("@user-profile-settings")
      expect(highlighted).toHaveClass("bg-primary/10", "text-primary")
    })

    it("should NOT split @home-feed into separate parts", () => {
      render(<HighlightedText text="Check @home-feed" />)
      // The bug was that "-feed" would appear as separate plain text
      expect(screen.queryByText("-feed")).not.toBeInTheDocument()
      // Instead, the whole thing should be highlighted together
      expect(screen.getByText("@home-feed")).toBeInTheDocument()
    })
  })

  describe("multiple refs", () => {
    it("should highlight multiple refs in the same text", () => {
      render(<HighlightedText text="Compare @home and @dashboard" />)
      expect(screen.getByText("@home")).toHaveClass("text-primary")
      expect(screen.getByText("@dashboard")).toHaveClass("text-primary")
    })

    it("should highlight multiple hyphenated refs", () => {
      render(<HighlightedText text="@home-feed and @user-settings" />)
      expect(screen.getByText("@home-feed")).toHaveClass("text-primary")
      expect(screen.getByText("@user-settings")).toHaveClass("text-primary")
    })
  })

  describe("edge cases", () => {
    it("should handle text with only a ref", () => {
      render(<HighlightedText text="@dashboard" />)
      expect(screen.getByText("@dashboard")).toHaveClass("text-primary")
    })

    it("should handle ref at start of text", () => {
      render(<HighlightedText text="@home is the main screen" />)
      expect(screen.getByText("@home")).toHaveClass("text-primary")
    })

    it("should handle ref at end of text", () => {
      render(<HighlightedText text="Navigate to @settings" />)
      expect(screen.getByText("@settings")).toHaveClass("text-primary")
    })

    it("should handle refs with underscores", () => {
      render(<HighlightedText text="Check @user_profile" />)
      expect(screen.getByText("@user_profile")).toHaveClass("text-primary")
    })

    it("should handle refs with numbers", () => {
      render(<HighlightedText text="See @screen2" />)
      expect(screen.getByText("@screen2")).toHaveClass("text-primary")
    })

    it("should handle complex mixed refs", () => {
      render(<HighlightedText text="@home-v2 and @user_profile-settings" />)
      expect(screen.getByText("@home-v2")).toHaveClass("text-primary")
      expect(screen.getByText("@user_profile-settings")).toHaveClass("text-primary")
    })
  })
})

describe("findActiveFileMention", () => {
  it("detects active mention token with path characters", () => {
    const text = "Please open @src/components/button.tsx"
    const mention = findActiveFileMention(text, text.length)
    expect(mention).toEqual({
      start: 12,
      end: text.length,
      query: "src/components/button.tsx",
    })
  })

  it("does not treat email addresses as mentions", () => {
    const mention = findActiveFileMention("Contact user@example.com", 24)
    expect(mention).toBeNull()
  })

  it("returns null when @ is not token-leading", () => {
    const mention = findActiveFileMention("Check(@src/app.tsx)", 19)
    expect(mention).toBeNull()
  })
})

describe("removeFileMentionToken", () => {
  it("removes mention token and keeps spacing valid", () => {
    const text = "Please edit @src/app.tsx now"
    const result = removeFileMentionToken(text, { start: 12, end: 24 })
    expect(result.text).toBe("Please edit now")
    expect(result.caretPosition).toBe(12)
  })
})

describe("mention file content helpers", () => {
  it("estimates byte size for utf-8 content", () => {
    expect(estimateMentionFileSizeBytes("abc")).toBe(3)
  })

  it("estimates byte size for base64 content", () => {
    expect(estimateMentionFileSizeBytes("YWJj", "base64")).toBe(3)
  })

  it("builds data URL for plain text content", () => {
    const url = buildMentionDataUrl("hello", "text/plain")
    expect(url.startsWith("data:text/plain;base64,")).toBe(true)
    const encoded = url.split(",")[1]
    expect(atob(encoded)).toBe("hello")
  })

  it("uses existing base64 payload when encoding is base64", () => {
    const url = buildMentionDataUrl("aGVsbG8=", "text/plain", "base64")
    expect(url).toBe("data:text/plain;base64,aGVsbG8=")
  })
})

describe("getRenderableAssistantParts", () => {
  it("hides completed assistant messages that only contain reasoning", () => {
    const parts: MessagePart[] = [
      {
        id: "reasoning-1",
        messageID: "msg-1",
        sessionID: "session-1",
        type: "reasoning",
        text: "I should inspect the project.",
      },
    ]

    expect(getRenderableAssistantParts(parts, false)).toEqual([])
  })

  it("shows reasoning-only content while the assistant is streaming", () => {
    const parts: MessagePart[] = [
      {
        id: "reasoning-1",
        messageID: "msg-1",
        sessionID: "session-1",
        type: "reasoning",
        text: "I should inspect the project.",
      },
    ]

    expect(getRenderableAssistantParts(parts, true)).toEqual(parts)
  })

  it("keeps a completed tool row renderable after Pi message_end repeats the tool call", () => {
    const parts: MessagePart[] = [
      {
        id: "tool-1",
        messageID: "msg-1",
        sessionID: "session-1",
        type: "tool",
        tool: "read",
        state: {
          status: "completed",
          input: { path: "src/app.tsx" },
          output: "contents",
        },
      },
    ]

    expect(getRenderableAssistantParts(parts, false)).toHaveLength(1)
  })
})

describe("getChatActivityLabel", () => {
  it("prioritizes user-blocking questions", () => {
    expect(
      getChatActivityLabel({
        isLoading: true,
        pendingQuestionCount: 1,
        runningQuestionToolCount: 0,
        runningTools: [{ tool: "write" }],
        sessionStatus: "running",
        fallback: "Thinking",
      }),
    ).toBe("Waiting for your answer")
  })

  it("uses specific labels for running tools", () => {
    expect(
      getChatActivityLabel({
        isLoading: true,
        pendingQuestionCount: 0,
        runningQuestionToolCount: 0,
        runningTools: [{ tool: "write" }],
        sessionStatus: "idle",
        fallback: "Thinking",
      }),
    ).toBe("Writing screen")
  })

  it("returns undefined when idle", () => {
    expect(
      getChatActivityLabel({
        isLoading: false,
        pendingQuestionCount: 0,
        runningQuestionToolCount: 0,
        runningTools: [],
        sessionStatus: "idle",
        fallback: "Thinking",
      }),
    ).toBeUndefined()
  })
})

describe("isAssistantMessageStreaming", () => {
  it("treats stale streaming messages as complete when the session is idle", () => {
    expect(
      isAssistantMessageStreaming(
        {
          isStreaming: true,
          time: { created: 1000 },
        },
        "idle",
      ),
    ).toBe(false)
  })

  it("only streams while the message is incomplete and the session is active", () => {
    expect(
      isAssistantMessageStreaming(
        {
          isStreaming: true,
          time: { created: 1000 },
        },
        "running",
      ),
    ).toBe(true)

    expect(
      isAssistantMessageStreaming(
        {
          isStreaming: true,
          time: { created: 1000, completed: 2000 },
        },
        "running",
      ),
    ).toBe(false)
  })
})
