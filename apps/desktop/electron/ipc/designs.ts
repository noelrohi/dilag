import fs from "node:fs"
import fsp from "node:fs/promises"
import path from "node:path"
import {
  getCanonicalGeneratedScreenDirectory,
  getCanonicalGeneratedScreenPath,
  getGeneratedScreenDirectories,
  getGeneratedScreenFallbackKey,
  type DesignFile,
  type DesignMutationResult,
  type ImportDesignsResult,
  type GeneratedScreenDirectory,
  type Violation,
} from "@dilag/desktop-bridge"

const IMPORT_SIZE_LIMIT_BYTES = 1024 * 1024
const HTML_FILE_EXTENSIONS = new Set([".html", ".htm"])

function extractHtmlAttr(html: string, attr: string): string | null {
  return new RegExp(`${attr}=["']([^"']+)["']`).exec(html)?.[1] ?? null
}

function titleFromFilename(filename: string): string {
  return filename
    .replace(/\.html?$/, "")
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

function isHtmlFilename(filename: string): boolean {
  return HTML_FILE_EXTENSIONS.has(path.extname(filename).toLowerCase())
}

function sanitizeDesignBasename(filename: string): string {
  const normalized = filename.replace(/\\/g, "/").trim()
  if (!normalized) throw new Error("File name is empty")
  if (path.posix.isAbsolute(normalized) || path.win32.isAbsolute(filename)) {
    throw new Error("Absolute paths are not allowed")
  }

  const segments = normalized.split("/")
  if (segments.includes("..")) throw new Error("Parent directory segments are not allowed")

  const basename = path.posix.basename(normalized)
  if (!basename || basename === "." || basename === "..") throw new Error("File name is empty")
  if (!isHtmlFilename(basename)) throw new Error("Only HTML files can be imported")

  const extension = path.extname(basename)
  const stem = basename.slice(0, -extension.length)
  return extension.toLowerCase() === ".htm" ? `${stem}.html` : basename
}

function importBasenameFromPath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/")
  return path.posix.basename(normalized)
}

function isInsideDirectory(parentDir: string, childPath: string): boolean {
  const relative = path.relative(parentDir, childPath)
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fsp.access(filePath)
    return true
  } catch {
    return false
  }
}

export async function writeDesignHtml(args: {
  sessionCwd: string
  filename: string
  html: string
  reservedFilenames?: Set<string>
}): Promise<string> {
  const designDir = path.resolve(getCanonicalGeneratedScreenDirectory(args.sessionCwd))
  const basename = sanitizeDesignBasename(args.filename)
  const extension = path.extname(basename)
  const stem = basename.slice(0, -extension.length)
  const reservedFilenames = args.reservedFilenames ?? new Set<string>()

  await fsp.mkdir(designDir, { recursive: true })

  let candidate = basename
  let suffix = 2
  while (
    reservedFilenames.has(candidate) ||
    (await fileExists(getCanonicalGeneratedScreenPath(args.sessionCwd, candidate)))
  ) {
    candidate = `${stem}-${suffix}${extension}`
    suffix += 1
  }

  const targetPath = path.resolve(getCanonicalGeneratedScreenPath(args.sessionCwd, candidate))
  if (!isInsideDirectory(designDir, targetPath)) {
    throw new Error("Resolved import path escapes the designs directory")
  }

  await fsp.writeFile(targetPath, args.html, "utf8")
  reservedFilenames.add(candidate)
  return targetPath
}

export async function importDesigns(args: {
  sessionCwd: string
  filePaths: string[]
}): Promise<ImportDesignsResult> {
  const result: ImportDesignsResult = { imported: 0, rejected: [] }
  const reservedFilenames = new Set<string>()

  for (const filePath of args.filePaths) {
    const basename = importBasenameFromPath(filePath)
    if (!isHtmlFilename(basename)) {
      result.rejected.push({ path: filePath, reason: "Only .html and .htm files can be imported" })
      continue
    }

    let stat: fs.Stats
    try {
      stat = await fsp.stat(filePath)
    } catch (error) {
      result.rejected.push({
        path: filePath,
        reason:
          error instanceof Error ? `Unable to read file: ${error.message}` : "Unable to read file",
      })
      continue
    }

    if (!stat.isFile()) {
      result.rejected.push({ path: filePath, reason: "Path is not a file" })
      continue
    }

    if (stat.size > IMPORT_SIZE_LIMIT_BYTES) {
      result.rejected.push({ path: filePath, reason: "File exceeds the 1 MB import limit" })
      continue
    }

    try {
      const html = await fsp.readFile(filePath, "utf8")
      validateHtml(html)
      await writeDesignHtml({
        sessionCwd: args.sessionCwd,
        filename: basename,
        html,
        reservedFilenames,
      })
      result.imported += 1
    } catch (error) {
      result.rejected.push({
        path: filePath,
        reason: error instanceof Error ? error.message : "Unable to import file",
      })
    }
  }

  return result
}

async function loadDesignsFromDir(
  sessionCwd: string,
  directory: GeneratedScreenDirectory,
  seenScreenPaths: Set<string>,
  out: DesignFile[],
  currentDir = directory.path,
) {
  if (!fs.existsSync(currentDir)) return
  for (const entry of await fsp.readdir(currentDir, { withFileTypes: true })) {
    const filePath = path.join(currentDir, entry.name)
    if (entry.isDirectory()) {
      await loadDesignsFromDir(sessionCwd, directory, seenScreenPaths, out, filePath)
      continue
    }
    if (!entry.isFile() || !isHtmlFilename(entry.name)) continue

    const screenPath = getGeneratedScreenFallbackKey(filePath, sessionCwd)
    if (!screenPath || seenScreenPaths.has(screenPath)) continue

    const html = await fsp.readFile(filePath, "utf8")
    const stat = await fsp.stat(filePath)
    seenScreenPaths.add(screenPath)
    out.push({
      filename: entry.name,
      file_path: filePath,
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
  const seenScreenPaths = new Set<string>()
  for (const directory of getGeneratedScreenDirectories(sessionCwd)) {
    await loadDesignsFromDir(sessionCwd, directory, seenScreenPaths, designs)
  }
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

// Resolve an existing screen by sanitized basename: canonical .designs first,
// then legacy fallback directories (which may nest files in subdirectories),
// matching how the loader de-duplicates in loadDesignsForSession.
async function resolveExistingDesignPath(
  sessionCwd: string,
  filename: string,
): Promise<{ filePath: string; legacy: boolean } | null> {
  const canonical = getCanonicalGeneratedScreenPath(sessionCwd, filename)
  if (await fileExists(canonical)) return { filePath: canonical, legacy: false }

  const designs = await loadDesignsForSession(sessionCwd)
  const match = designs.find((design) => design.filename === filename)
  if (!match) return null
  return { filePath: match.file_path, legacy: true }
}

export async function writeDesign(args: {
  sessionCwd: string
  filename: string
  html: string
}): Promise<DesignMutationResult> {
  let basename: string
  try {
    basename = sanitizeDesignBasename(args.filename)
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "Invalid file name" }
  }

  const violations = validateHtml(args.html)
  if (violations.length > 0) {
    return { ok: false, reason: "Validation failed", violations }
  }

  const designDir = path.resolve(getCanonicalGeneratedScreenDirectory(args.sessionCwd))
  const targetPath = path.resolve(getCanonicalGeneratedScreenPath(args.sessionCwd, basename))
  if (!isInsideDirectory(designDir, targetPath)) {
    return { ok: false, reason: "Resolved path escapes the designs directory" }
  }

  await fsp.mkdir(designDir, { recursive: true })
  await fsp.writeFile(targetPath, args.html, "utf8") // overwrite in place — this is Save
  return { ok: true, filename: basename }
}

export async function renameDesign(args: {
  sessionCwd: string
  from: string
  to: string
}): Promise<DesignMutationResult> {
  let fromBasename: string
  let toBasename: string
  try {
    fromBasename = sanitizeDesignBasename(args.from)
    toBasename = sanitizeDesignBasename(args.to)
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "Invalid file name" }
  }

  const source = await resolveExistingDesignPath(args.sessionCwd, fromBasename)
  if (!source) return { ok: false, reason: "Screen not found" }

  const designDir = path.resolve(getCanonicalGeneratedScreenDirectory(args.sessionCwd))
  const targetPath = path.resolve(getCanonicalGeneratedScreenPath(args.sessionCwd, toBasename))
  if (!isInsideDirectory(designDir, targetPath)) {
    return { ok: false, reason: "Resolved path escapes the designs directory" }
  }
  if (await fileExists(targetPath)) {
    return { ok: false, reason: "A screen with that name already exists" }
  }

  await fsp.mkdir(designDir, { recursive: true })
  if (source.legacy) {
    await fsp.copyFile(source.filePath, targetPath)
    await fsp.unlink(source.filePath)
  } else {
    await fsp.rename(source.filePath, targetPath)
  }

  return { ok: true, filename: toBasename }
}

export async function duplicateDesign(args: {
  sessionCwd: string
  filename: string
}): Promise<DesignMutationResult> {
  let basename: string
  try {
    basename = sanitizeDesignBasename(args.filename)
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "Invalid file name" }
  }

  const source = await resolveExistingDesignPath(args.sessionCwd, basename)
  if (!source) return { ok: false, reason: "Screen not found" }

  const extension = path.extname(basename)
  const stem = basename.slice(0, -extension.length)

  const designDir = path.resolve(getCanonicalGeneratedScreenDirectory(args.sessionCwd))
  let candidate = `${stem} copy${extension}`
  let suffix = 2
  while (await fileExists(getCanonicalGeneratedScreenPath(args.sessionCwd, candidate))) {
    candidate = `${stem} copy ${suffix}${extension}`
    suffix += 1
  }

  const targetPath = path.resolve(getCanonicalGeneratedScreenPath(args.sessionCwd, candidate))
  if (!isInsideDirectory(designDir, targetPath)) {
    return { ok: false, reason: "Resolved path escapes the designs directory" }
  }

  await fsp.mkdir(designDir, { recursive: true })
  await fsp.copyFile(source.filePath, targetPath)

  return { ok: true, filename: candidate }
}
