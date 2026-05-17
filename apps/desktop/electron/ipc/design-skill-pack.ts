import fsp from "node:fs/promises"
import path from "node:path"
import {
  renderGeneratedScreenOutputRules,
  renderGeneratedScreenSystemPromptRules,
  renderHtmlScreenContract,
} from "@dilag/desktop-bridge"
import { getDilagSkillsDir, resolveDesignAssetDir } from "./paths.js"

export const DILAG_MOBILE_DESIGN_SKILL_NAME = "dilag-mobile-design"
export const DILAG_WEB_DESIGN_SKILL_NAME = "dilag-web-design"
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

export const DILAG_SYSTEM_PROMPT = `You are Dilag, a UI design agent that produces production-grade HTML screen prototypes.

## Workspace invariants
${renderGeneratedScreenSystemPromptRules()}

## Design workflow
- For new design requests, use the ${DILAG_WEB_DESIGN_SKILL_NAME} or ${DILAG_MOBILE_DESIGN_SKILL_NAME} skill when instructed by the user message.
- Never inline full HTML in your assistant reply. Use write/edit, then summarize briefly.`

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
