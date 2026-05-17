import fsp from "node:fs/promises"
import path from "node:path"
import { describe, expect, it } from "vitest"
import {
  DILAG_MOBILE_DESIGN_SKILL_NAME,
  DILAG_WEB_DESIGN_SKILL_NAME,
  renderDesignSkill,
  type DilagDesignSkillAssets,
} from "../../electron/ipc/design-skill-pack"

async function loadAssets(): Promise<DilagDesignSkillAssets> {
  const assetDir = path.resolve(process.cwd(), "resources", "design-assets")
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

describe("design skill pack", () => {
  it("renders the mobile skill with the HTML screen contract and Dilag skill name", async () => {
    const skill = renderDesignSkill("mobile", await loadAssets(), {})

    expect(skill).toContain(`name: ${DILAG_MOBILE_DESIGN_SKILL_NAME}`)
    expect(skill).toContain("## HTML Screen Contract")
    expect(skill).toContain("`.designs/<kebab-name>.html`")
    expect(skill).toContain("`screens/` is deprecated fallback for display only")
    expect(skill).toContain('data-screen-type="mobile"')
    expect(skill).not.toContain("{{GENERATED_SCREEN_OUTPUT_RULES}}")
    expect(skill).not.toContain("{{HTML_SCREEN_CONTRACT}}")
  })

  it("renders the web skill with the HTML screen contract and Dilag skill name", async () => {
    const skill = renderDesignSkill("web", await loadAssets(), {})

    expect(skill).toContain(`name: ${DILAG_WEB_DESIGN_SKILL_NAME}`)
    expect(skill).toContain("## HTML Screen Contract")
    expect(skill).toContain("`.designs/<kebab-name>.html`")
    expect(skill).toContain('data-screen-type="web"')
  })

  it("uses environment fallback text when optional hints are absent", async () => {
    const skill = renderDesignSkill("web", await loadAssets(), {
      DILAG_BRAND_TOKENS: " ",
      DILAG_DOMAIN_HINT: undefined,
      DILAG_REFERENCE_URLS: "",
    })

    expect(
      skill.match(/\(none specified - use your judgment based on the user's request\)/g),
    ).toHaveLength(3)
  })
})
