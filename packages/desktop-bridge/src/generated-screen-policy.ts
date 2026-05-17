export const GENERATED_SCREEN_CANONICAL_DIR = ".designs"
export const GENERATED_SCREEN_LEGACY_FALLBACK_DIRS = ["screens"] as const
export const GENERATED_SCREEN_EXTENSION = ".html"

export type GeneratedScreenDirectoryKind = "canonical" | "legacy-fallback"

export interface GeneratedScreenDirectory {
  kind: GeneratedScreenDirectoryKind
  name: string
  path: string
}

export interface GeneratedScreenFileMatch {
  kind: GeneratedScreenDirectoryKind
  directory: string
  relativePath: string
  screenPath: string
}

export function getCanonicalGeneratedScreenDirectory(projectCwd: string): string {
  return joinGeneratedScreenPath(projectCwd, GENERATED_SCREEN_CANONICAL_DIR)
}

export function getCanonicalGeneratedScreenPath(projectCwd: string, screenPath: string): string {
  return joinGeneratedScreenPath(
    getCanonicalGeneratedScreenDirectory(projectCwd),
    stripLeadingDotSlash(normalizeGeneratedScreenPath(screenPath)),
  )
}

export function getGeneratedScreenDirectories(projectCwd: string): GeneratedScreenDirectory[] {
  return [
    {
      kind: "canonical",
      name: GENERATED_SCREEN_CANONICAL_DIR,
      path: getCanonicalGeneratedScreenDirectory(projectCwd),
    },
    ...GENERATED_SCREEN_LEGACY_FALLBACK_DIRS.map((name) => ({
      kind: "legacy-fallback" as const,
      name,
      path: joinGeneratedScreenPath(projectCwd, name),
    })),
  ]
}

export function getGeneratedScreenSearchDirectories(projectCwd: string): string[] {
  return getGeneratedScreenDirectories(projectCwd).map((directory) => directory.path)
}

export function classifyGeneratedScreenFile(
  filePath: string,
  projectCwd?: string,
): GeneratedScreenFileMatch | null {
  const relativePath = toProjectRelativePath(filePath, projectCwd)
  const lowerRelativePath = relativePath.toLowerCase()
  if (!lowerRelativePath.endsWith(GENERATED_SCREEN_EXTENSION)) return null

  const [directory, ...screenPathParts] = relativePath.split("/")
  const screenPath = screenPathParts.join("/")
  if (!directory || !screenPath) return null

  if (directory === GENERATED_SCREEN_CANONICAL_DIR) {
    return { kind: "canonical", directory, relativePath, screenPath }
  }

  if ((GENERATED_SCREEN_LEGACY_FALLBACK_DIRS as readonly string[]).includes(directory)) {
    return { kind: "legacy-fallback", directory, relativePath, screenPath }
  }

  return null
}

export function isGeneratedScreenFile(filePath: string, projectCwd?: string): boolean {
  return classifyGeneratedScreenFile(filePath, projectCwd) !== null
}

export function getGeneratedScreenFallbackKey(
  filePath: string,
  projectCwd?: string,
): string | null {
  return classifyGeneratedScreenFile(filePath, projectCwd)?.screenPath ?? null
}

export function renderGeneratedScreenOutputRules(): string {
  const legacyDirs = GENERATED_SCREEN_LEGACY_FALLBACK_DIRS.map((directory) => `\`${directory}/\``)
  const legacyDirList = legacyDirs.join(", ")
  return [
    `- Path: \`${GENERATED_SCREEN_CANONICAL_DIR}/<kebab-name>.html\` relative to the current working directory.`,
    `- Write generated screens to \`${GENERATED_SCREEN_CANONICAL_DIR}/\` only; create or update files there for all new work.`,
    `- ${legacyDirList} ${legacyDirs.length === 1 ? "is" : "are"} deprecated fallback for display only. Never create new screens there.`,
    `- If an existing screen is only in ${legacyDirList}, treat it as legacy and write the updated version under \`${GENERATED_SCREEN_CANONICAL_DIR}/\`.`,
    "- Do not write generated screens to the project root, `src/`, `public/`, the user home directory, or any absolute path outside the current working directory.",
  ].join("\n")
}

export function renderHtmlScreenContract(template: string): string {
  return template.replaceAll(
    "{{GENERATED_SCREEN_OUTPUT_RULES}}",
    renderGeneratedScreenOutputRules(),
  )
}

export function renderGeneratedScreenSystemPromptRules(): string {
  const legacyDirs = GENERATED_SCREEN_LEGACY_FALLBACK_DIRS.map((directory) => `${directory}/`).join(
    ", ",
  )
  return [
    "- The current working directory is the active Dilag project directory. Treat it as the only workspace.",
    "- Create and edit design files inside this directory only. Do not write to the user home directory, parent directories, or absolute paths outside the current working directory.",
    `- Write every generated screen to ${GENERATED_SCREEN_CANONICAL_DIR}/<kebab-name>.html. Do not use ${legacyDirs}, the project root, or any other folder for generated screens.`,
    `- ${legacyDirs} ${GENERATED_SCREEN_LEGACY_FALLBACK_DIRS.length === 1 ? "is" : "are"} deprecated fallback only. If you see old files there, treat them as legacy and write updated/new screens under ${GENERATED_SCREEN_CANONICAL_DIR}/.`,
    `- The write tool creates parent directories automatically; do not run mkdir just to create ${GENERATED_SCREEN_CANONICAL_DIR}/.`,
    `- Before editing an existing screen, inspect the project files and prefer ${GENERATED_SCREEN_CANONICAL_DIR}/*.html.`,
  ].join("\n")
}

function toProjectRelativePath(filePath: string, projectCwd?: string): string {
  const normalizedFile = stripLeadingDotSlash(normalizeGeneratedScreenPath(filePath))
  if (!projectCwd) return normalizedFile

  const normalizedCwd = normalizeGeneratedScreenPath(projectCwd)
  if (!normalizedCwd) return normalizedFile
  if (normalizedFile === normalizedCwd) return ""
  if (normalizedCwd === "/" && normalizedFile.startsWith("/")) {
    return stripLeadingDotSlash(normalizedFile.slice(1))
  }
  if (normalizedFile.startsWith(`${normalizedCwd}/`)) {
    return stripLeadingDotSlash(normalizedFile.slice(normalizedCwd.length + 1))
  }

  return normalizedFile
}

function joinGeneratedScreenPath(basePath: string, childPath: string): string {
  const normalizedBase = normalizeGeneratedScreenPath(basePath)
  if (!normalizedBase || normalizedBase === "/") return `${normalizedBase}${childPath}`
  return `${normalizedBase}/${childPath}`
}

function normalizeGeneratedScreenPath(value: string): string {
  const normalized = value.replace(/\\/g, "/")
  if (normalized === "/") return normalized
  return normalized.replace(/\/+$/, "")
}

function stripLeadingDotSlash(value: string): string {
  let next = value
  while (next.startsWith("./")) next = next.slice(2)
  return next
}
