import type { AgentImageContent, AgentThinkingLevel, Platform } from "@dilag/desktop-bridge"
import type { FileUIPart } from "ai"
import type { SessionStatus } from "@/context/session-store"
import { bridge } from "@/lib/bridge"
import { formatElementWithAncestry, minifyHtml } from "@/lib/html-utils"

export type PromptDeliveryMode = "immediate" | "steer" | "followUp"
export type PromptDeliveryStatus = "accepted" | "queued"

export interface PromptDeliveryOutcome {
  mode: PromptDeliveryMode
  status: PromptDeliveryStatus
}

export interface PromptDeliverySession {
  id: string
  cwd: string
  platform?: Platform
}

export interface PromptDeliveryModel {
  providerID: string
  modelID: string
}

export interface PromptDeliveryAgentBridge {
  prompt(args: {
    sessionID: string
    directory: string
    text: string
    images?: AgentImageContent[]
    model?: PromptDeliveryModel | null
    thinkingLevel?: AgentThinkingLevel
    streamingBehavior?: "steer" | "followUp"
  }): Promise<void>
}

export interface BuildDilagPromptPayloadArgs {
  content: string
  files?: FileUIPart[]
  platform?: Platform
  isFirstMessage: boolean
}

export interface DilagPromptPayload {
  text: string
  images: AgentImageContent[]
}

export interface PromptDeliveryArgs extends BuildDilagPromptPayloadArgs {
  session: PromptDeliverySession
  sessionStatus: SessionStatus
  hasRunningTools: boolean
  streamingBehavior?: "steer" | "followUp"
  model?: PromptDeliveryModel | null
  thinkingLevel?: AgentThinkingLevel
  agentBridge?: PromptDeliveryAgentBridge
}

type ElementSelectionInfo = {
  selector: string
  html: string
  tagName: string
  ancestorPath?: string[]
}

export function getPromptDeliveryMode(args: {
  sessionStatus: SessionStatus
  hasRunningTools: boolean
  streamingBehavior?: "steer" | "followUp"
}): PromptDeliveryMode {
  const isStreaming =
    args.sessionStatus === "running" || args.sessionStatus === "busy" || args.hasRunningTools
  if (!isStreaming) return "immediate"
  return args.streamingBehavior ?? "steer"
}

export function buildDilagPromptPayload({
  content,
  files,
  platform = "web",
  isFirstMessage,
}: BuildDilagPromptPayloadArgs): DilagPromptPayload {
  const skillHint = isFirstMessage ? `/skill:${platform}-design ` : ""
  let promptText = skillHint + content

  const screenContexts: string[] = []
  const screenNames: string[] = []
  const screenSummaries: string[] = []
  const fileNotes: string[] = []
  const images: AgentImageContent[] = []

  for (const file of files ?? []) {
    if (!file.url) continue

    if (file.mediaType === "text/html") {
      appendHtmlScreenContext(file, screenNames, screenSummaries, screenContexts)
      continue
    }

    if (file.mediaType?.startsWith("image/")) {
      const dataUrlMatch = file.url.match(/^data:([^;,]+);base64,(.+)$/)
      if (dataUrlMatch) {
        images.push({
          type: "image",
          mimeType: dataUrlMatch[1] || file.mediaType,
          data: dataUrlMatch[2],
        })
      } else if (file.filename) {
        fileNotes.push(`Attached image not inlined: ${file.filename}`)
      }
      continue
    }

    if (file.filename) {
      fileNotes.push(`Attached file not inlined: ${file.filename}`)
    }
  }

  if (screenNames.length > 0) {
    const inlineRefs = screenNames.map((name) => `@${name}`).join(" ")
    const contextBlock = screenContexts.join("\n\n")
    promptText = `${skillHint}${inlineRefs} ${content}\n\n${contextBlock}`
  }

  if (fileNotes.length > 0) {
    promptText += `\n\n${fileNotes.join("\n")}`
  }

  if (!isFirstMessage) {
    const skillName = `${platform}-design`
    const referencedTypes = screenSummaries.length > 0 ? screenSummaries.join(", ") : "none"
    promptText +=
      `\n\n<dilag_context target_screen_type="${platform}" active_skill="${skillName}">` +
      `Continue designing for ${platform} screens unless the user explicitly asks for another screen type. ` +
      `Active design skill: ${skillName}. ` +
      `Still apply: no animations, .designs/ output only, Iconify icons, preserve project palette and typography. ` +
      `Referenced screens: ${referencedTypes}.` +
      `</dilag_context>`
  }

  return { text: promptText, images }
}

export async function deliverDilagPrompt({
  session,
  sessionStatus,
  hasRunningTools,
  streamingBehavior,
  model,
  thinkingLevel,
  agentBridge = bridge.agent,
  ...payloadArgs
}: PromptDeliveryArgs): Promise<PromptDeliveryOutcome> {
  const payload = buildDilagPromptPayload({
    ...payloadArgs,
    platform: payloadArgs.platform ?? session.platform ?? "web",
  })
  const mode = getPromptDeliveryMode({ sessionStatus, hasRunningTools, streamingBehavior })

  await agentBridge.prompt({
    sessionID: session.id,
    directory: session.cwd,
    text: payload.text,
    images: payload.images,
    model,
    thinkingLevel,
    streamingBehavior: mode === "immediate" ? undefined : mode,
  })

  return {
    mode,
    status: mode === "immediate" ? "accepted" : "queued",
  }
}

export function queuedFollowUpPreview(prompt: string): string {
  const expandedSkillBlock = prompt.match(
    /^<skill name="[^"]+" location="[^"]+">\n[\s\S]*?\n<\/skill>(?:\n\n([\s\S]+))?$/,
  )
  const displayPrompt = expandedSkillBlock
    ? (expandedSkillBlock[1] ?? "")
    : prompt.replace(/^\/skill:(web|mobile)-design\s+/, "")
  const firstDisplayBlock = displayPrompt.split(/\n\s*\n/)[0]?.trim()
  return firstDisplayBlock || "(attached context)"
}

function appendHtmlScreenContext(
  file: FileUIPart,
  screenNames: string[],
  screenSummaries: string[],
  screenContexts: string[],
): void {
  const base64Match = file.url?.match(/^data:text\/html;base64,(.+)$/)
  if (!base64Match) return

  try {
    let htmlContent = decodeBase64Utf8(base64Match[1])
    const screenName = file.filename?.replace(/\.html$/i, "") || "Screen"
    const screenType = extractHtmlAttr(htmlContent, "data-screen-type") ?? "unknown"
    const elementInfo = extractElementSelection(htmlContent)

    if (elementInfo) {
      htmlContent = htmlContent.replace(elementInfo.marker, "").trim()
      const compactElement = formatElementWithAncestry(
        elementInfo.info.html,
        elementInfo.info.ancestorPath,
      )
      screenNames.push(screenName)
      screenSummaries.push(`${screenName} (${screenType}, ${elementInfo.info.tagName})`)
      screenContexts.push(
        `<edit_element screen="${screenName}" screen_type="${screenType}" selector="${elementInfo.info.selector}">\n` +
          `${compactElement}\n` +
          `</edit_element>`,
      )
      return
    }

    const minifiedHtml = minifyHtml(htmlContent)
    screenNames.push(screenName)
    screenSummaries.push(`${screenName} (${screenType})`)
    screenContexts.push(
      `<screen_context name="${screenName}" screen_type="${screenType}">${minifiedHtml}</screen_context>`,
    )
  } catch (error) {
    console.error("[prompt-delivery] Failed to decode HTML content:", error)
  }
}

function extractHtmlAttr(html: string, attr: string): string | null {
  return new RegExp(`${attr}=["']([^"']+)["']`, "i").exec(html)?.[1] ?? null
}

function extractElementSelection(
  htmlContent: string,
): { marker: string; info: ElementSelectionInfo } | null {
  const markerMatch = htmlContent.match(/<!-- dilag-element-selection: ({.*?}) -->/)
  if (!markerMatch) return null

  try {
    return {
      marker: markerMatch[0],
      info: JSON.parse(markerMatch[1]) as ElementSelectionInfo,
    }
  } catch (error) {
    console.error("[prompt-delivery] Failed to parse element selection marker:", error)
    return null
  }
}

function decodeBase64Utf8(value: string): string {
  const binary = atob(value)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}
