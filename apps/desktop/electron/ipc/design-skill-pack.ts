import fs from "node:fs"
import fsp from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import {
  renderGeneratedScreenOutputRules,
  renderGeneratedScreenSystemPromptRules,
  renderHtmlScreenContract,
} from "@dilag/desktop-bridge"
import { getDilagSkillsDir, resolveDesignAssetDir } from "./paths.js"

export const DILAG_MOBILE_DESIGN_SKILL_NAME = "mobile-design"
export const DILAG_WEB_DESIGN_SKILL_NAME = "web-design"
export const DILAG_DESIGN_SKILL_NAMES = {
  mobile: DILAG_MOBILE_DESIGN_SKILL_NAME,
  web: DILAG_WEB_DESIGN_SKILL_NAME,
} as const

export type DilagDesignSkillKind = keyof typeof DILAG_DESIGN_SKILL_NAMES

export interface DilagDesignSkillAssets {
  commonTemplate: string
  htmlScreenContractTemplate: string
  mobileTemplate: string
  webTemplate: string
}

export interface DilagDesignSkillEnvironment {
  DILAG_BRAND_TOKENS?: string
  DILAG_DOMAIN_HINT?: string
  DILAG_REFERENCE_URLS?: string
}

const ENVIRONMENT_FALLBACK = "(none specified - use your judgment based on the user's request)"

export function renderDilagEnvironmentBlock(cwd: string): string {
  const isGitRepo = fs.existsSync(path.join(cwd, ".git"))
  return [
    "<env>",
    `  Working directory: ${cwd}`,
    `  Is directory a git repo: ${isGitRepo ? "yes" : "no"}`,
    `  Platform: ${os.platform()}`,
    `  Today's date: ${new Date().toDateString()}`,
    "</env>",
  ].join("\n")
}

export function renderDilagSystemPrompt(cwd: string): string {
  return `You are Dilag, a UI design agent that produces production-grade HTML screen prototypes.

## Environment
${renderDilagEnvironmentBlock(cwd)}
Treat the working directory above as the only workspace for this project.

## Workspace invariants
${renderGeneratedScreenSystemPromptRules()}

## Design constraints (always apply, even on follow-ups)
- No decorative animations, @keyframes, or Tailwind animate-* utilities.
- No inline HTML in assistant replies — use write/edit, then summarize briefly.
- Preserve palette, typography, and tone across screens in the same project.
- When editing, read existing .designs/*.html first; prefer edit over creating duplicate files.
- If the request is ambiguous (platform, screen count, brand direction), use the question tool.

## Tools
- Use read and glob to inspect existing .designs/*.html before editing.
- Use write for new screens and edit for updates.
- Use question when you need a material choice from the user.

## Design workflow
- The first user message of a design session includes a /skill:${DILAG_WEB_DESIGN_SKILL_NAME} or /skill:${DILAG_MOBILE_DESIGN_SKILL_NAME} prefix — follow that skill fully.
- On follow-ups without a skill prefix, still obey the design constraints above and any <dilag_context> blocks in the user message.`
}

export async function syncDilagDesignSkills(): Promise<void> {
  const assetDir = resolveDesignAssetDir()
  const skillsDir = getDilagSkillsDir()
  const assets = await readDilagDesignSkillAssets(assetDir)

  await Promise.all(
    Object.values(DILAG_DESIGN_SKILL_NAMES).map((skillName) =>
      fsp.mkdir(path.join(skillsDir, skillName), { recursive: true }),
    ),
  )

  await Promise.all(
    (Object.keys(DILAG_DESIGN_SKILL_NAMES) as DilagDesignSkillKind[]).map((kind) =>
      fsp.writeFile(
        path.join(skillsDir, DILAG_DESIGN_SKILL_NAMES[kind], "SKILL.md"),
        renderDesignSkill(kind, assets),
      ),
    ),
  )
}

export function renderDesignSkill(
  kind: DilagDesignSkillKind,
  assets: DilagDesignSkillAssets,
  environment: DilagDesignSkillEnvironment = readDilagDesignSkillEnvironment(),
): string {
  const template = kind === "mobile" ? assets.mobileTemplate : assets.webTemplate
  const common = renderDesignSkillCommon(assets, environment)
  return rewriteSkillName(template, DILAG_DESIGN_SKILL_NAMES[kind])
    .replace("{{COMMON}}", common)
    .replace("{{BRAND_TOKENS}}", environmentText(environment.DILAG_BRAND_TOKENS))
    .replace("{{DOMAIN_HINT}}", environmentText(environment.DILAG_DOMAIN_HINT))
    .replace("{{REFERENCE_URLS}}", environmentText(environment.DILAG_REFERENCE_URLS))
}

async function readDilagDesignSkillAssets(assetDir: string): Promise<DilagDesignSkillAssets> {
  const [commonTemplate, htmlScreenContractTemplate, mobileTemplate, webTemplate] =
    await Promise.all([
      fsp.readFile(path.join(assetDir, "designer-common.md"), "utf8"),
      fsp.readFile(path.join(assetDir, "html-screen-contract.md"), "utf8"),
      fsp.readFile(path.join(assetDir, "mobile-designer-prompt.md"), "utf8"),
      fsp.readFile(path.join(assetDir, "web-designer-prompt.md"), "utf8"),
    ])

  return {
    commonTemplate,
    htmlScreenContractTemplate,
    mobileTemplate,
    webTemplate,
  }
}

function renderDesignSkillCommon(
  assets: DilagDesignSkillAssets,
  environment: DilagDesignSkillEnvironment,
): string {
  const htmlScreenContract = renderHtmlScreenContract(assets.htmlScreenContractTemplate)
  return assets.commonTemplate
    .replace("{{HTML_SCREEN_CONTRACT}}", htmlScreenContract)
    .replaceAll("{{GENERATED_SCREEN_OUTPUT_RULES}}", renderGeneratedScreenOutputRules())
    .replace("{{BRAND_TOKENS}}", environmentText(environment.DILAG_BRAND_TOKENS))
    .replace("{{DOMAIN_HINT}}", environmentText(environment.DILAG_DOMAIN_HINT))
    .replace("{{REFERENCE_URLS}}", environmentText(environment.DILAG_REFERENCE_URLS))
}

function rewriteSkillName(template: string, skillName: string): string {
  return template.replace(/^name:\s*[^\n]+$/m, `name: ${skillName}`)
}

function readDilagDesignSkillEnvironment(): DilagDesignSkillEnvironment {
  return {
    DILAG_BRAND_TOKENS: process.env.DILAG_BRAND_TOKENS,
    DILAG_DOMAIN_HINT: process.env.DILAG_DOMAIN_HINT,
    DILAG_REFERENCE_URLS: process.env.DILAG_REFERENCE_URLS,
  }
}

function environmentText(value: string | undefined): string {
  return value?.trim() || ENVIRONMENT_FALLBACK
}
