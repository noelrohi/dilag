import fs from "node:fs"
import fsp from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import type { SkillInfo, SkillInstallResult, SkillPreviewResult } from "@dilag/desktop-bridge"
import { getOpencodeConfigDir } from "./paths.js"
import { runCommand } from "./processes.js"

function stripAnsi(input: string): string {
  return input.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "").replace(/[●◇◆\r]/g, "")
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

async function syncCanonicalSkills() {
  const canonicalDir = path.join(os.homedir(), ".agents", "skills")
  const targetDir = path.join(getOpencodeConfigDir(), "skill")
  if (!fs.existsSync(canonicalDir)) return
  await fsp.mkdir(targetDir, { recursive: true })
  for (const entry of await fsp.readdir(canonicalDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const source = path.join(canonicalDir, entry.name)
    const dest = path.join(targetDir, entry.name)
    if (!fs.existsSync(dest)) await fsp.symlink(source, dest, "dir")
  }
}

export async function listInstalledSkills(): Promise<SkillInfo[]> {
  const configDir = getOpencodeConfigDir()
  const skills: SkillInfo[] = []
  const seen = new Set<string>()
  for (const dirName of ["skill", "skills"]) {
    const skillDir = path.join(configDir, dirName)
    const entries = await fsp.readdir(skillDir, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue
      if (seen.has(entry.name)) continue
      seen.add(entry.name)
      skills.push({
        name: entry.name,
        path: path.join(skillDir, entry.name),
        is_symlink: entry.isSymbolicLink(),
      })
    }
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
    "-a",
    "opencode",
  ]
  const output = await runCommand("npx", installArgs)
  if (output.code !== 0)
    return { success: false, installed: [], error: output.stderr || "Installation failed" }
  await syncCanonicalSkills()
  const configDir = getOpencodeConfigDir()
  const installed = skillNames.filter((name) =>
    ["skill", "skills"].some((dir) => fs.existsSync(path.join(configDir, dir, name))),
  )
  return { success: true, installed, error: null }
}

export async function removeSkill(skillName: string): Promise<void> {
  for (const dirName of ["skill", "skills"]) {
    await fsp.rm(path.join(getOpencodeConfigDir(), dirName, skillName), {
      recursive: true,
      force: true,
    })
  }
}
