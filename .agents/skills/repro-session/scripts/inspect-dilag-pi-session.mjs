#!/usr/bin/env node
import fs from "node:fs"
import fsp from "node:fs/promises"
import os from "node:os"
import path from "node:path"

const args = process.argv.slice(2)
const sessionId = args.find((arg) => !arg.startsWith("-"))
const asJson = args.includes("--json")
const limitArg = args.find((arg) => arg.startsWith("--limit="))
const recentLimit = Number(limitArg?.split("=")[1] ?? 8)

if (!sessionId) {
  console.error("Usage: inspect-dilag-pi-session.mjs <session-id> [--json] [--limit=8]")
  process.exit(2)
}

const dilagDir = path.join(os.homedir(), ".dilag")
const piSessionsDir = path.join(dilagDir, "pi", "sessions")

function safeText(value, max = 280) {
  if (!value) return ""
  const text = String(value).replace(/\s+/g, " ").trim()
  return text.length > max ? `${text.slice(0, max - 1)}...` : text
}

function contentText(content) {
  if (!content) return ""
  if (typeof content === "string") return content
  if (!Array.isArray(content)) return ""
  return content
    .filter((part) => part?.type === "text")
    .map((part) => part.text)
    .join("\n")
}

function toolCalls(message) {
  const content = message?.content
  if (!Array.isArray(content)) return []
  return content
    .filter((part) => part?.type === "toolCall")
    .map((part) => ({
      id: part.id,
      name: part.name,
      arguments: part.arguments ?? {},
    }))
}

async function walkJsonlFiles(dir) {
  const files = []
  if (!fs.existsSync(dir)) return files
  const entries = await fsp.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...(await walkJsonlFiles(fullPath)))
    else if (entry.isFile() && entry.name.endsWith(".jsonl")) files.push(fullPath)
  }
  return files
}

async function parseSessionFile(file) {
  const raw = await fsp.readFile(file, "utf8")
  const entries = raw
    .split(/\n/)
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line)
      } catch (error) {
        return { type: "parse_error", line: index + 1, error: String(error), raw: line }
      }
    })
  return entries
}

function summarize(file, entries) {
  const header = entries.find((entry) => entry.type === "session") ?? {}
  const messages = entries.filter((entry) => entry.type === "message" && entry.message)
  const modelChanges = entries.filter((entry) => entry.type === "model_change")
  const thinkingChanges = entries.filter((entry) => entry.type === "thinking_level_change")
  const roleCounts = {}
  const calls = []
  const results = new Map()

  for (const entry of messages) {
    const role = entry.message.role
    roleCounts[role] = (roleCounts[role] ?? 0) + 1
    if (role === "assistant") {
      for (const call of toolCalls(entry.message)) {
        calls.push({
          ...call,
          messageEntryId: entry.id,
          timestamp: entry.timestamp,
        })
      }
    }
    if (role === "toolResult" && entry.message.toolCallId) {
      results.set(entry.message.toolCallId, {
        id: entry.id,
        timestamp: entry.timestamp,
        toolName: entry.message.toolName,
        isError: Boolean(entry.message.isError),
        text: contentText(entry.message.content),
      })
    }
  }

  const unresolvedTools = calls.filter((call) => !results.has(call.id))
  const latestUser = [...messages].reverse().find((entry) => entry.message.role === "user")
  const latestAssistant = [...messages].reverse().find((entry) => entry.message.role === "assistant")
  const recentTools = calls.slice(-recentLimit).map((call) => {
    const result = results.get(call.id)
    return {
      id: call.id,
      name: call.name,
      timestamp: call.timestamp,
      status: result ? (result.isError ? "error" : "completed") : "unresolved",
      resultPreview: result ? safeText(result.text, 180) : "",
    }
  })

  return {
    file,
    sessionId: header.id,
    cwd: header.cwd,
    createdAt: header.timestamp,
    latestAt: entries.at(-1)?.timestamp ?? null,
    latestModel: modelChanges.at(-1)
      ? `${modelChanges.at(-1).provider}/${modelChanges.at(-1).modelId}`
      : null,
    latestThinkingLevel: thinkingChanges.at(-1)?.thinkingLevel ?? null,
    entries: entries.length,
    messages: messages.length,
    roleCounts,
    latestUser: latestUser
      ? { id: latestUser.id, timestamp: latestUser.timestamp, text: safeText(contentText(latestUser.message.content)) }
      : null,
    latestAssistant: latestAssistant
      ? {
          id: latestAssistant.id,
          timestamp: latestAssistant.timestamp,
          text: safeText(contentText(latestAssistant.message.content)),
          toolCalls: toolCalls(latestAssistant.message).map((call) => call.name),
        }
      : null,
    recentTools,
    unresolvedTools: unresolvedTools.map((call) => ({
      id: call.id,
      name: call.name,
      timestamp: call.timestamp,
      messageEntryId: call.messageEntryId,
    })),
    unresolvedQuestions: unresolvedTools
      .filter((call) => call.name === "question")
      .map((call) => ({
        id: call.id,
        timestamp: call.timestamp,
        messageEntryId: call.messageEntryId,
        arguments: call.arguments,
      })),
  }
}

async function listDesignFiles(cwd) {
  if (!cwd) return []
  const designsDir = path.join(cwd, ".designs")
  if (!fs.existsSync(designsDir)) return []
  const out = []
  async function walk(dir) {
    const entries = await fsp.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) await walk(fullPath)
      else if (entry.isFile() && entry.name.endsWith(".html")) out.push(path.relative(cwd, fullPath))
    }
  }
  await walk(designsDir)
  return out.sort()
}

const files = await walkJsonlFiles(piSessionsDir)
const matches = []

for (const file of files) {
  if (!file.includes(sessionId)) {
    const firstLine = fs.readFileSync(file, "utf8").split(/\n/, 1)[0]
    if (!firstLine.includes(sessionId)) continue
  }
  const entries = await parseSessionFile(file)
  const summary = summarize(file, entries)
  if (summary.sessionId?.includes(sessionId) || file.includes(sessionId)) {
    summary.designFiles = await listDesignFiles(summary.cwd)
    matches.push(summary)
  }
}

if (asJson) {
  console.log(JSON.stringify({ sessionId, matches }, null, 2))
} else if (matches.length === 0) {
  console.log(`No Pi session found for ${sessionId}`)
  console.log(`Searched: ${piSessionsDir}`)
  console.log("Check for a partial ID, different project cwd, or legacy ~/.dilag/sessions data.")
  process.exit(1)
} else {
  for (const [index, match] of matches.entries()) {
    if (matches.length > 1) console.log(`\n# Match ${index + 1}`)
    console.log(`Session: ${match.sessionId}`)
    console.log(`File: ${match.file}`)
    console.log(`CWD: ${match.cwd}`)
    console.log(`Created: ${match.createdAt}`)
    console.log(`Latest entry: ${match.latestAt}`)
    console.log(`Model: ${match.latestModel ?? "(unknown)"}`)
    console.log(`Thinking: ${match.latestThinkingLevel ?? "(unknown)"}`)
    console.log(`Entries/messages: ${match.entries}/${match.messages}`)
    console.log(`Roles: ${JSON.stringify(match.roleCounts)}`)
    if (match.latestUser) console.log(`Latest user: ${match.latestUser.text}`)
    if (match.latestAssistant) {
      console.log(`Latest assistant: ${match.latestAssistant.text || "(tool-only assistant message)"}`)
      if (match.latestAssistant.toolCalls.length > 0) {
        console.log(`Latest assistant tools: ${match.latestAssistant.toolCalls.join(", ")}`)
      }
    }
    console.log(`Design files: ${match.designFiles.length > 0 ? match.designFiles.join(", ") : "(none)"}`)
    console.log("Recent tools:")
    for (const tool of match.recentTools) {
      console.log(`- ${tool.name} ${tool.status} ${tool.timestamp} ${tool.resultPreview}`)
    }
    if (match.unresolvedTools.length > 0) {
      console.log("Unresolved tool calls:")
      for (const tool of match.unresolvedTools) {
        console.log(`- ${tool.name} ${tool.id} at ${tool.timestamp}`)
      }
    }
    if (match.unresolvedQuestions.length > 0) {
      console.log("Possible pending/lost questions:")
      for (const question of match.unresolvedQuestions) {
        console.log(`- ${question.id} at ${question.timestamp}`)
      }
    }
  }
}
