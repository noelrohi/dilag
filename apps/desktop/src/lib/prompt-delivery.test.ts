import { describe, expect, it, vi } from "vitest"
import {
  buildDilagPromptPayload,
  deliverDilagPrompt,
  getPromptDeliveryMode,
  queuedFollowUpPreview,
} from "./prompt-delivery"

function htmlFile(filename: string, html: string) {
  return {
    type: "file" as const,
    filename,
    mediaType: "text/html",
    url: `data:text/html;base64,${btoa(html)}`,
  }
}

describe("prompt delivery", () => {
  it("builds first-message skill hints for the session platform", () => {
    const payload = buildDilagPromptPayload({
      content: "Design a login screen",
      platform: "mobile",
      isFirstMessage: true,
    })

    expect(payload.text).toBe("/skill:dilag-mobile-design Design a login screen")
    expect(payload.images).toEqual([])
  })

  it("appends screen contexts while keeping the display preview to the visible prompt", () => {
    const payload = buildDilagPromptPayload({
      content: "Make the hero calmer",
      platform: "web",
      isFirstMessage: true,
      files: [htmlFile("Home.html", "<html><body><main>Hero</main></body></html>")],
    })

    expect(payload.text).toContain("/skill:dilag-web-design @Home Make the hero calmer")
    expect(payload.text).toContain('<screen_context name="Home">')
    expect(payload.text).toContain("</screen_context>")
    expect(queuedFollowUpPreview(payload.text)).toBe("@Home Make the hero calmer")
  })

  it("previews expanded skill-block prompts by showing only the user message", () => {
    const queuedPrompt =
      '<skill name="dilag-web-design" location="/skills/web/SKILL.md">\nSkill instructions\n</skill>\n\n@Home Polish copy\n\n<screen_context name="Home">...</screen_context>'

    expect(queuedFollowUpPreview(queuedPrompt)).toBe("@Home Polish copy")
  })

  it("uses follow-up delivery only while the session is busy", () => {
    expect(getPromptDeliveryMode({ sessionStatus: "idle", hasRunningTools: false })).toBe(
      "immediate",
    )
    expect(getPromptDeliveryMode({ sessionStatus: "unknown", hasRunningTools: true })).toBe(
      "followUp",
    )
    expect(getPromptDeliveryMode({ sessionStatus: "running", hasRunningTools: false })).toBe(
      "followUp",
    )
  })

  it("passes Pi streamingBehavior only for queued follow-ups", async () => {
    const prompt = vi.fn().mockResolvedValue(undefined)

    await expect(
      deliverDilagPrompt({
        agentBridge: { prompt },
        session: { id: "session-1", cwd: "/project", platform: "web" },
        content: "Queue this",
        isFirstMessage: false,
        sessionStatus: "running",
        hasRunningTools: false,
        model: null,
      }),
    ).resolves.toEqual({ mode: "followUp", status: "queued" })

    expect(prompt).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionID: "session-1",
        directory: "/project",
        text: "Queue this",
        streamingBehavior: "followUp",
      }),
    )

    prompt.mockClear()

    await expect(
      deliverDilagPrompt({
        agentBridge: { prompt },
        session: { id: "session-1", cwd: "/project", platform: "web" },
        content: "Send now",
        isFirstMessage: false,
        sessionStatus: "idle",
        hasRunningTools: false,
        model: null,
      }),
    ).resolves.toEqual({ mode: "immediate", status: "accepted" })

    expect(prompt).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "Send now",
        streamingBehavior: undefined,
      }),
    )
  })
})
