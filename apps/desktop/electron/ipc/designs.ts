import fs from "node:fs"
import fsp from "node:fs/promises"
import path from "node:path"
import type { DesignFile, Violation } from "@dilag/desktop-bridge"

function extractHtmlAttr(html: string, attr: string): string | null {
  return new RegExp(`${attr}=["']([^"']+)["']`).exec(html)?.[1] ?? null
}

function titleFromFilename(filename: string): string {
  return filename
    .replace(/\.html$/, "")
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

export function validateHtml(html: string): Violation[] {
  const violations: Violation[] = []
  if (/@keyframes\b/.test(html)) violations.push({ rule: "keyframes", snippet: "@keyframes" })
  const opacity = /opacity\s*:\s*0\s*(?:[;"}]|$)/.exec(html)
  if (opacity) violations.push({ rule: "initial_opacity_zero", snippet: opacity[0] })
  const animation = /animation\s*:/.exec(html)
  if (animation) violations.push({ rule: "animation_css", snippet: animation[0] })
  const animate = /class\s*=\s*"[^"]*\banimate-([a-zA-Z_][\w-]*)/.exec(html)
  if (animate && animate[1] !== "none") {
    violations.push({ rule: "decorative_animation", snippet: `animate-${animate[1]}` })
  }
  const allowlist = new Set([
    "images.unsplash.com",
    "fonts.googleapis.com",
    "fonts.gstatic.com",
    "cdn.jsdelivr.net",
    "code.iconify.design",
    "unpkg.com",
  ])
  const url = /(?:href|src)\s*=\s*"https?:\/\/([^"/?#]+)"/.exec(html)
  if (url && !allowlist.has(url[1].toLowerCase())) {
    violations.push({ rule: "real_url", snippet: url[0] })
  }
  const emoji = [...html].filter((char) => {
    const cp = char.codePointAt(0) ?? 0
    return (
      (cp >= 0x1f300 && cp <= 0x1faff) ||
      (cp >= 0x2600 && cp <= 0x26ff) ||
      (cp >= 0x2700 && cp <= 0x27bf)
    )
  })
  if (emoji.length > 0)
    violations.push({ rule: "emoji_as_icon", snippet: emoji.slice(0, 4).join("") })
  return violations
}

async function loadDesignsFromDir(dir: string, seen: Set<string>, out: DesignFile[]) {
  if (!fs.existsSync(dir)) return
  for (const entry of await fsp.readdir(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".html") || seen.has(entry.name)) continue
    const filePath = path.join(dir, entry.name)
    const html = await fsp.readFile(filePath, "utf8")
    const stat = await fsp.stat(filePath)
    seen.add(entry.name)
    out.push({
      filename: entry.name,
      title: extractHtmlAttr(html, "data-title") ?? titleFromFilename(entry.name),
      screen_type: extractHtmlAttr(html, "data-screen-type") ?? "web",
      html,
      modified_at: Math.floor(stat.mtimeMs / 1000),
      violations: validateHtml(html),
    })
  }
}

export async function loadDesignsForSession(sessionCwd: string): Promise<DesignFile[]> {
  const designs: DesignFile[] = []
  const seen = new Set<string>()
  await loadDesignsFromDir(sessionCwd, seen, designs)
  await loadDesignsFromDir(path.join(sessionCwd, "screens"), seen, designs)
  return designs.sort((a, b) => a.modified_at - b.modified_at)
}

export async function copyHtmlFiles(sourceDir: string, destDir: string): Promise<number> {
  await fsp.mkdir(destDir, { recursive: true })
  if (!fs.existsSync(sourceDir)) return 0
  let copied = 0
  for (const entry of await fsp.readdir(sourceDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".html")) continue
    await fsp.copyFile(path.join(sourceDir, entry.name), path.join(destDir, entry.name))
    copied++
  }
  return copied
}
