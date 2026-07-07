import fs from "node:fs"
import fsp from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import type { SkillInfo, SkillInstallResult, SkillPreviewResult } from "@dilag/desktop-bridge"
import { runCommand } from "./processes.js"

function stripAnsi(input: string): string {
  return input
    // eslint-disable-next-line no-control-regex -- intentional: strip ANSI escape sequences
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "")
    .replace(/[●◇◆\r]/g, "")
}

function parseSkillList(rawOutput: string): SkillPreviewResult["skills"] {
  const skills: SkillPreviewResult["skills"] = []
  let inSkillsSection = false
  let currentName: string | null = null
  let currentDesc = ""
  for (const line of stripAnsi(rawOutput).split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed.includes("Available Skills")) {
      inSkillsSection = true
      continue
    }
    if (!inSkillsSection) continue
    if (trimmed.startsWith("Use --skill") || trimmed.startsWith("└")) break
    const content = trimmed.replace(/^[│|]\s*/, "").trim()
    if (!content) continue
    if (content.length < 80 && /^[\w-]+$/.test(content)) {
      if (currentName) skills.push({ name: currentName, description: currentDesc.trim() })
      currentName = content
      currentDesc = ""
    } else if (currentName) {
      currentDesc += `${currentDesc ? " " : ""}${content}`
    }
  }
  if (currentName) skills.push({ name: currentName, description: currentDesc.trim() })
  return skills
}

function validateSkillSource(source: string) {
  if (!source || source.startsWith("-") || !/^[\w/.\-:@]+$/.test(source)) {
    throw new Error(`Invalid skill source: ${source}`)
  }
}

function getGlobalAgentSkillsDir(): string {
  return path.join(os.homedir(), ".agents", "skills")
}

export async function listInstalledSkills(): Promise<SkillInfo[]> {
  const skillDir = getGlobalAgentSkillsDir()
  const skills: SkillInfo[] = []
  const entries = await fsp.readdir(skillDir, { withFileTypes: true }).catch(() => [])
  for (const entry of entries) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue
    skills.push({
      name: entry.name,
      path: path.join(skillDir, entry.name),
      is_symlink: entry.isSymbolicLink(),
    })
  }
  return skills.sort((a, b) => a.name.localeCompare(b.name))
}

export async function previewSkills(source: string): Promise<SkillPreviewResult> {
  validateSkillSource(source)
  const output = await runCommand("npx", ["-y", "skills", "add", source, "-l"])
  if (output.code === 0)
    return { success: true, skills: parseSkillList(output.stdout), error: null }
  return {
    success: false,
    skills: [],
    error: output.stderr || output.stdout || "Failed to fetch skills",
  }
}

export async function installSkills(
  source: string,
  skillNames: string[],
): Promise<SkillInstallResult> {
  validateSkillSource(source)
  for (const name of skillNames)
    if (!/^[\w-]+$/.test(name)) throw new Error(`Invalid skill name: ${name}`)
  const installArgs = [
    "-y",
    "skills",
    "add",
    source,
    ...skillNames.flatMap((name) => ["-s", name]),
    "-g",
    "-y",
  ]
  const output = await runCommand("npx", installArgs)
  if (output.code !== 0)
    return { success: false, installed: [], error: output.stderr || "Installation failed" }
  const skillDir = getGlobalAgentSkillsDir()
  const installed = skillNames.filter((name) => fs.existsSync(path.join(skillDir, name)))
  return { success: true, installed, error: null }
}

export async function removeSkill(skillName: string): Promise<void> {
  await fsp.rm(path.join(getGlobalAgentSkillsDir(), skillName), {
    recursive: true,
    force: true,
  })
}
