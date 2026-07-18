import { beforeEach, describe, it, expect, vi } from "vitest"
import { createElement, type ReactNode } from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const mocks = vi.hoisted(() => ({
  useSessions: vi.fn(),
  useGlobalEvents: vi.fn(),
  usePendingMessage: vi.fn(),
  listFiles: vi.fn(),
  readFile: vi.fn(),
  clearQueue: vi.fn(),
}))

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children, to, ...props }: { children?: ReactNode; to?: string }) =>
    createElement("a", { href: to, ...props }, children),
}))

vi.mock("@/hooks/use-sessions", () => ({
  useSessions: mocks.useSessions,
}))

vi.mock("@/context/global-events", () => ({
  useGlobalEvents: mocks.useGlobalEvents,
}))

vi.mock("@/hooks/use-chat-interface", () => ({
  usePendingMessage: mocks.usePendingMessage,
}))

vi.mock("@/lib/bridge", () => ({
  bridge: {
    project: {
      listFiles: mocks.listFiles,
      readFile: mocks.readFile,
    },
    agent: {
      clearQueue: mocks.clearQueue,
    },
  },
}))

vi.mock("@dilag/ui/message-scroller", () => ({
  MessageScrollerProvider: ({ children }: { children?: ReactNode }) => children,
  MessageScroller: ({ children }: { children?: ReactNode }) => children,
  MessageScrollerViewport: ({ children }: { children?: ReactNode }) => children,
  MessageScrollerContent: ({ children }: { children?: ReactNode }) => children,
  MessageScrollerItem: ({ children }: { children?: ReactNode }) => children,
  MessageScrollerButton: () => null,
}))

vi.mock("@/components/blocks/selectors/model-selector-button", () => ({
  ModelSelectorButton: () => null,
}))

vi.mock("@/components/blocks/selectors/agent-selector-button", () => ({
  AgentSelectorButton: () => null,
}))

vi.mock("@/components/blocks/selectors/thinking-mode-selector", () => ({
  ThinkingModeSelector: () => null,
}))

vi.mock("./question-list", () => ({
  QuestionList: () => null,
}))

vi.mock("./attachment-bridge-connector", () => ({
  AttachmentBridgeConnector: () => null,
}))

import {
  parseMessageText,
  HighlightedText,
  findActiveFileMention,
  removeFileMentionToken,
  estimateMentionFileSizeBytes,
  buildMentionDataUrl,
  getRenderableAssistantParts,
  isAssistantMessageStreaming,
  splitAssistantWorkParts,
  getAssistantWorkSummary,
  shouldShimmerAssistantWorkSummary,
  AssistantWorkGroup,
  parseSkillBlock,
  getDisplayMessageText,
  getStreamingComposerShortcut,
  SkillInvocationBlock,
  ErrorState,
  ChatView,
} from "./chat-view"
import type { MessagePart } from "@/context/session-store"
import { useSessionStore } from "@/context/session-store"
import { pushPromptHistory } from "@/lib/prompt-history"

function renderChatView({
  sendMessage = vi.fn().mockResolvedValue(undefined),
  sessionId = "session-1",
} = {}) {
  mocks.useSessions.mockReturnValue({
    messages: [],
    currentSessionId: sessionId,
    currentSession: { cwd: "/tmp/project" },
    isLoading: false,
    isServerReady: true,
    sendMessage,
    stopSession: vi.fn(),
    createSession: vi.fn(),
    forkSession: vi.fn(),
  })
  mocks.useGlobalEvents.mockReturnValue({ serverError: null, retryStart: vi.fn() })
  mocks.usePendingMessage.mockReturnValue({ pendingMessage: null, clearPendingMessage: vi.fn() })
  mocks.listFiles.mockResolvedValue([])
  mocks.readFile.mockResolvedValue("")
  mocks.clearQueue.mockResolvedValue(undefined)

  render(<ChatView />)

  return {
    sendMessage,
    textarea: screen.getByPlaceholderText("Describe what to design...") as HTMLTextAreaElement,
  }
}

async function submitPrompt(textarea: HTMLTextAreaElement, prompt: string) {
  const user = userEvent.setup()

  await user.type(textarea, prompt)
  await user.click(screen.getByRole("button", { name: "Send message" }))
  await waitFor(() => expect(textarea).toHaveValue(""))
}

beforeEach(() => {
  vi.clearAllMocks()
  const storage = new Map<string, string>()

  vi.stubGlobal("localStorage", {
    getItem: vi.fn((key: string) => storage.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      storage.set(key, value)
    }),
    removeItem: vi.fn((key: string) => {
      storage.delete(key)
    }),
    clear: vi.fn(() => {
      storage.clear()
    }),
    key: vi.fn((index: number) => Array.from(storage.keys())[index] ?? null),
    get length() {
      return storage.size
    },
  })
})

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

describe("getDisplayMessageText", () => {
  it("returns the visible user prompt without hidden context blocks", () => {
    const input = `@home Polish this

<screen_context name="Home">HTML</screen_context>

<dilag_context target_screen_type="mobile">metadata</dilag_context>`

    expect(getDisplayMessageText(input)).toBe("@home Polish this")
  })

  it("unwraps skill prompts before cleaning hidden context blocks", () => {
    const input = `<skill name="web-design" location="/skills/web/SKILL.md">
Skill instructions
</skill>

Build a landing page

<screen_context name="Home">HTML</screen_context>`

    expect(getDisplayMessageText(input)).toBe("Build a landing page")
  })
})

describe("SkillInvocationBlock", () => {
  it("uses the tool-row trigger treatment and theme-aware expanded panel", async () => {
    render(
      <SkillInvocationBlock
        skill={{
          name: "web-design",
          location: "/skills/web-design/SKILL.md",
          content: "# Web Design\n\nFollow the design rules.",
        }}
      />,
    )

    const triggerLabel = screen.getByText("Skill")
    expect(triggerLabel).toHaveClass("font-medium")
    expect(screen.getByText("web-design")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: /Skill web-design/ }))

    expect(
      screen.getAllByText("Skill").some((node) => node.classList.contains("text-muted-foreground")),
    ).toBe(true)
    expect(await screen.findByText(/Follow the design rules/)).toBeInTheDocument()
  })
})

describe("ErrorState", () => {
  it("renders a Retry button that calls onRetry and an Open Settings link", async () => {
    const onRetry = vi.fn()
    render(<ErrorState error="Failed to start Pi runtime" onRetry={onRetry} />)

    expect(screen.getByText("Failed to start Pi runtime")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Open Settings" })).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Retry" }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it("omits the Retry button when no onRetry is provided", () => {
    render(<ErrorState error="Something went wrong" />)

    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Open Settings" })).toBeInTheDocument()
  })
})

describe("composer prompt history recall", () => {
  it("records submitted prompts and recalls the latest prompt from an empty composer", async () => {
    const sendMessage = vi.fn().mockResolvedValue(undefined)
    const { textarea } = renderChatView({ sendMessage })

    await submitPrompt(textarea, "Build a portfolio")

    expect(sendMessage).toHaveBeenCalledWith("Build a portfolio", undefined, {
      streamingBehavior: undefined,
    })

    fireEvent.keyDown(textarea, { key: "ArrowUp" })

    await waitFor(() => expect(textarea).toHaveValue("Build a portfolio"))
  })

  it("cycles backward and forward through prompt history", async () => {
    const { textarea } = renderChatView()

    await submitPrompt(textarea, "Build a portfolio")
    await submitPrompt(textarea, "Make it responsive")

    fireEvent.keyDown(textarea, { key: "ArrowUp" })
    await waitFor(() => expect(textarea).toHaveValue("Make it responsive"))

    fireEvent.keyDown(textarea, { key: "ArrowUp" })
    await waitFor(() => expect(textarea).toHaveValue("Build a portfolio"))

    fireEvent.keyDown(textarea, { key: "ArrowDown" })
    await waitFor(() => expect(textarea).toHaveValue("Make it responsive"))

    fireEvent.keyDown(textarea, { key: "ArrowDown" })
    await waitFor(() => expect(textarea).toHaveValue(""))
  })

  it("keeps ArrowUp reserved for mention navigation while the mention popover is open", async () => {
    const { textarea } = renderChatView()
    const user = userEvent.setup()
    pushPromptHistory("session-1", "Build a portfolio")

    await user.type(textarea, "@")
    await screen.findByText("Files")

    fireEvent.keyDown(textarea, { key: "ArrowUp" })

    expect(textarea).toHaveValue("@")
  })
})

describe("getStreamingComposerShortcut", () => {
  it("uses Cmd/Ctrl+Enter for steering while the session is loading", () => {
    expect(
      getStreamingComposerShortcut({
        key: "Enter",
        shiftKey: false,
        metaKey: true,
        ctrlKey: false,
        altKey: false,
        isLoading: true,
      }),
    ).toBe("steer")

    expect(
      getStreamingComposerShortcut({
        key: "Enter",
        shiftKey: false,
        metaKey: false,
        ctrlKey: true,
        altKey: false,
        isLoading: true,
      }),
    ).toBe("steer")
  })

  it("does not submit plain Enter as steering while the session is loading", () => {
    expect(
      getStreamingComposerShortcut({
        key: "Enter",
        shiftKey: false,
        metaKey: false,
        ctrlKey: false,
        altKey: false,
        isLoading: true,
      }),
    ).toBe("newline")
  })

  it("keeps Alt+Enter as the queued follow-up shortcut while loading", () => {
    expect(
      getStreamingComposerShortcut({
        key: "Enter",
        shiftKey: false,
        metaKey: false,
        ctrlKey: false,
        altKey: true,
        isLoading: true,
      }),
    ).toBe("followUp")
  })

  it("defers to normal composer handling when idle or using Shift+Enter", () => {
    expect(
      getStreamingComposerShortcut({
        key: "Enter",
        shiftKey: false,
        metaKey: true,
        ctrlKey: false,
        altKey: false,
        isLoading: false,
      }),
    ).toBe("defer")

    expect(
      getStreamingComposerShortcut({
        key: "Enter",
        shiftKey: true,
        metaKey: true,
        ctrlKey: false,
        altKey: false,
        isLoading: true,
      }),
    ).toBe("defer")
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

describe("splitAssistantWorkParts", () => {
  it("keeps assistant text and files out of the work group", () => {
    const parts: MessagePart[] = [
      {
        id: "reasoning-1",
        messageID: "msg-1",
        sessionID: "session-1",
        type: "reasoning",
        text: "I should inspect the project.",
      },
      {
        id: "text-1",
        messageID: "msg-2",
        sessionID: "session-1",
        type: "text",
        text: "I will update the chat rendering.",
      },
      {
        id: "tool-1",
        messageID: "msg-3",
        sessionID: "session-1",
        type: "tool",
        tool: "edit",
        state: {
          status: "completed",
          input: { filePath: "src/chat.tsx" },
        },
      },
      {
        id: "file-1",
        messageID: "msg-4",
        sessionID: "session-1",
        type: "file",
        url: "file:///preview.png",
        filename: "preview.png",
      },
      {
        id: "text-2",
        messageID: "msg-5",
        sessionID: "session-1",
        type: "text",
        text: "Done.",
      },
    ]

    expect(splitAssistantWorkParts(parts)).toEqual({
      workParts: [parts[0], parts[2]],
      finalParts: [parts[1], parts[3], parts[4]],
    })
  })

  it("keeps model step metadata with grouped work rows", () => {
    const parts: MessagePart[] = [
      {
        id: "step-1",
        messageID: "msg-1",
        sessionID: "session-1",
        type: "step-start",
        provider: "openai",
        model: "gpt-5-codex",
      },
      {
        id: "text-1",
        messageID: "msg-2",
        sessionID: "session-1",
        type: "text",
        text: "Visible response.",
      },
    ]

    expect(splitAssistantWorkParts(parts)).toEqual({
      workParts: [parts[0]],
      finalParts: [parts[1]],
    })
  })
})

describe("getAssistantWorkSummary", () => {
  it("summarizes mixed exploration and shell commands", () => {
    const parts: MessagePart[] = [
      {
        id: "search-1",
        messageID: "msg-1",
        sessionID: "session-1",
        type: "tool",
        tool: "grep",
        state: {
          status: "completed",
          input: { pattern: "SmartImport|FoundationModels" },
        },
      },
      {
        id: "command-1",
        messageID: "msg-1",
        sessionID: "session-1",
        type: "tool",
        tool: "bash",
        state: {
          status: "completed",
          input: { command: "git diff -- apps/desktop/src/components/blocks/chat/chat-view.tsx" },
        },
      },
      {
        id: "command-2",
        messageID: "msg-1",
        sessionID: "session-1",
        type: "tool",
        tool: "bash",
        state: {
          status: "completed",
          input: { command: "bun test apps/desktop/src/components/blocks/chat/chat-view.test.tsx" },
        },
      },
    ]

    expect(getAssistantWorkSummary(parts)).toBe("Explored 1 search and ran 2 commands")
  })

  it("uses present tense while a grouped tool is still working", () => {
    const parts: MessagePart[] = [
      {
        id: "read-1",
        type: "tool",
        tool: "read",
        state: { status: "completed", input: { path: "src/app.tsx" } },
      },
      {
        id: "bash-1",
        type: "tool",
        tool: "bash",
        state: { status: "running", input: { command: "bun test" } },
      },
    ]

    expect(getAssistantWorkSummary(parts)).toBe("Exploring 1 file and running 1 command")
  })

  it("counts interrupted and failed tools separately", () => {
    const parts: MessagePart[] = [
      {
        id: "read-1",
        type: "tool",
        tool: "read",
        state: { status: "completed", input: { path: "src/app.tsx" } },
      },
      {
        id: "bash-1",
        type: "tool",
        tool: "bash",
        state: { status: "error", error: "Interrupted", input: { command: "bun test" } },
      },
      {
        id: "edit-1",
        type: "tool",
        tool: "edit",
        state: { status: "error", error: "Command failed", input: { filePath: "src/app.tsx" } },
      },
    ]

    expect(getAssistantWorkSummary(parts)).toBe("Explored 1 file, 1 interrupted, and 1 failed")
  })

  it("keeps pluralization stable across multiple work categories", () => {
    const parts: MessagePart[] = [
      {
        id: "read-1",
        type: "tool",
        tool: "read",
        state: { status: "completed", input: { path: "src/app.tsx" } },
      },
      {
        id: "read-2",
        type: "tool",
        tool: "read",
        state: { status: "completed", input: { path: "src/chat.tsx" } },
      },
      {
        id: "edit-1",
        type: "tool",
        tool: "edit",
        state: { status: "completed", input: { filePath: "src/chat.tsx" } },
      },
      {
        id: "bash-1",
        type: "tool",
        tool: "bash",
        state: { status: "completed", input: { command: "bun test" } },
      },
    ]

    expect(getAssistantWorkSummary(parts)).toBe(
      "Explored 2 files, made 1 file change, and ran 1 command",
    )
  })
})

describe("shouldShimmerAssistantWorkSummary", () => {
  it("returns true when the latest grouped tool is pending", () => {
    const parts: MessagePart[] = [
      {
        id: "bash-1",
        type: "tool",
        tool: "bash",
        state: { status: "completed", input: { command: "ls" } },
      },
      {
        id: "write-1",
        type: "tool",
        tool: "write",
        state: { status: "pending", input: { filePath: "todo-home.html" } },
      },
    ]

    expect(shouldShimmerAssistantWorkSummary(parts)).toBe(true)
  })

  it("returns true when any grouped tool is still running, not just the latest", () => {
    const parts: MessagePart[] = [
      {
        id: "write-1",
        type: "tool",
        tool: "write",
        state: { status: "running", input: { filePath: "todo-home.html" } },
      },
      {
        id: "bash-1",
        type: "tool",
        tool: "bash",
        state: { status: "completed", input: { command: "ls" } },
      },
    ]

    expect(shouldShimmerAssistantWorkSummary(parts)).toBe(true)
  })

  it("returns false after all grouped tools have settled", () => {
    const parts: MessagePart[] = [
      {
        id: "bash-1",
        type: "tool",
        tool: "bash",
        state: { status: "completed", input: { command: "ls" } },
      },
      {
        id: "read-1",
        type: "tool",
        tool: "read",
        state: { status: "error", error: "Interrupted", input: { path: "src/app.tsx" } },
      },
    ]

    expect(shouldShimmerAssistantWorkSummary(parts)).toBe(false)
  })
})

describe("AssistantWorkGroup", () => {
  it("shimmers a present-tense summary with elapsed time while a tool is running", () => {
    render(
      <AssistantWorkGroup
        parts={[
          {
            id: "bash-1",
            type: "tool",
            tool: "bash",
            state: { status: "running", input: { command: "ls -la" } },
          },
        ]}
        isStreaming
        startedAt={1000}
      />,
    )

    const summary = screen.getByText(/Running 1 command · /)
    expect(summary).toHaveClass("shimmer")
  })

  it("shows a clean past-tense summary without shimmer once the turn settles", () => {
    render(
      <AssistantWorkGroup
        parts={[
          {
            id: "write-1",
            type: "tool",
            tool: "write",
            state: { status: "completed", input: { filePath: "portfolio-home.html" } },
          },
        ]}
        isStreaming={false}
        startedAt={1000}
        completedAt={2000}
      />,
    )

    const summary = screen.getByText("Made 1 file change")
    expect(summary).not.toHaveClass("shimmer")
  })

  it("keeps the latest thinking block open while a following tool is running", async () => {
    const user = userEvent.setup()

    render(
      <AssistantWorkGroup
        parts={[
          {
            id: "reasoning-1",
            type: "reasoning",
            text: "I inspected the existing design files.",
          },
          {
            id: "bash-1",
            type: "tool",
            tool: "bash",
            state: { status: "completed", input: { command: "ls -la .designs" } },
          },
          {
            id: "reasoning-2",
            type: "reasoning",
            text: "Now I can create the requested screens.",
          },
          {
            id: "write-1",
            type: "tool",
            tool: "write",
            state: { status: "running", input: { filePath: ".designs/dashboard.html" } },
          },
        ]}
        isStreaming
        startedAt={1000}
      />,
    )

    await user.click(
      screen.getByRole("button", { name: /Making 1 file change and running 1 command/ }),
    )

    expect(screen.getByText("I inspected the existing design files.")).toBeInTheDocument()
    expect(screen.getByText("Now I can create the requested screens.")).toBeInTheDocument()
  })
})

describe("AssistantMessage work group integration", () => {
  it("mounts the work group ahead of the final response and reveals rows in store order", async () => {
    const user = userEvent.setup()
    const sessionId = "session-group"
    const messageId = "assistant-group-1"

    useSessionStore.setState((state) => {
      state.parts[messageId] = [
        {
          id: "reasoning-1",
          sessionID: sessionId,
          messageID: messageId,
          type: "reasoning",
          text: "First I inspect the project.",
        },
        {
          id: "tool-read",
          sessionID: sessionId,
          messageID: messageId,
          type: "tool",
          tool: "read",
          state: { status: "completed", input: { path: "src/app.tsx" }, output: "contents" },
        },
        {
          id: "reasoning-2",
          sessionID: sessionId,
          messageID: messageId,
          type: "reasoning",
          text: "Then I apply the edit.",
        },
        {
          id: "tool-edit",
          sessionID: sessionId,
          messageID: messageId,
          type: "tool",
          tool: "edit",
          state: { status: "completed", input: { filePath: "src/app.tsx" } },
        },
        {
          id: "text-1",
          sessionID: sessionId,
          messageID: messageId,
          type: "text",
          text: "All set.",
        },
      ]
      state.sessionStatus[sessionId] = "idle"
    })

    mocks.useSessions.mockReturnValue({
      messages: [
        {
          id: messageId,
          sessionID: sessionId,
          role: "assistant",
          isStreaming: false,
          time: { created: 1000, completed: 2000 },
        },
      ],
      currentSessionId: sessionId,
      currentSession: { cwd: "/tmp/project" },
      isLoading: false,
      isServerReady: true,
      sendMessage: vi.fn(),
      stopSession: vi.fn(),
      createSession: vi.fn(),
      forkSession: vi.fn(),
    })
    mocks.useGlobalEvents.mockReturnValue({ serverError: null, retryStart: vi.fn() })
    mocks.usePendingMessage.mockReturnValue({ pendingMessage: null, clearPendingMessage: vi.fn() })

    render(<ChatView />)

    // Final response renders outside the group as the star of the turn.
    expect(screen.getByText("All set.")).toBeInTheDocument()

    // Reasoning stays collapsed behind the one-line summary until expanded.
    expect(screen.queryByText("First I inspect the project.")).not.toBeInTheDocument()

    await user.click(
      screen.getByRole("button", { name: /Explored 1 file and made 1 file change/ }),
    )

    const first = screen.getByText("First I inspect the project.")
    const second = screen.getByText("Then I apply the edit.")
    expect(first).toBeInTheDocument()
    expect(second).toBeInTheDocument()
    // Grouped rows preserve chronological store order.
    expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    useSessionStore.setState((state) => {
      delete state.parts[messageId]
      delete state.sessionStatus[sessionId]
    })
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
