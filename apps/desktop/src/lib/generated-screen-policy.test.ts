import { describe, expect, it } from "vitest"
import {
  GENERATED_SCREEN_CANONICAL_DIR,
  GENERATED_SCREEN_LEGACY_FALLBACK_DIRS,
  classifyGeneratedScreenFile,
  getGeneratedScreenDirectories,
  isGeneratedScreenFile,
  renderGeneratedScreenOutputRules,
} from "@dilag/desktop-bridge"

describe("generated screen policy", () => {
  it("classifies canonical .designs HTML files", () => {
    expect(
      classifyGeneratedScreenFile("/sessions/abc/.designs/home.html", "/sessions/abc"),
    ).toMatchObject({
      kind: "canonical",
      directory: ".designs",
      relativePath: ".designs/home.html",
      screenPath: "home.html",
    })
    expect(isGeneratedScreenFile(".designs/nested/home.html", "/sessions/abc")).toBe(true)
  })

  it("classifies legacy screens HTML files as fallback display files", () => {
    expect(
      classifyGeneratedScreenFile("/sessions/abc/screens/home.html", "/sessions/abc"),
    ).toMatchObject({
      kind: "legacy-fallback",
      directory: "screens",
      relativePath: "screens/home.html",
      screenPath: "home.html",
    })
    expect(isGeneratedScreenFile("screens/home.html", "/sessions/abc")).toBe(true)
  })

  it("ignores root HTML, non-HTML, and unrelated nested HTML files", () => {
    expect(isGeneratedScreenFile("/sessions/abc/home.html", "/sessions/abc")).toBe(false)
    expect(isGeneratedScreenFile("/sessions/abc/.designs/home.png", "/sessions/abc")).toBe(false)
    expect(isGeneratedScreenFile("/sessions/abc/src/home.html", "/sessions/abc")).toBe(false)
  })

  it("returns canonical search directories before legacy fallback directories", () => {
    expect(getGeneratedScreenDirectories("/sessions/abc")).toEqual([
      { kind: "canonical", name: GENERATED_SCREEN_CANONICAL_DIR, path: "/sessions/abc/.designs" },
      {
        kind: "legacy-fallback",
        name: GENERATED_SCREEN_LEGACY_FALLBACK_DIRS[0],
        path: "/sessions/abc/screens",
      },
    ])
  })

  it("renders contract output rules from the canonical and fallback policy", () => {
    const rules = renderGeneratedScreenOutputRules()

    expect(rules).toContain("`.designs/<kebab-name>.html`")
    expect(rules).toContain("`screens/` is deprecated fallback for display only")
    expect(rules).toContain("Never create new screens there")
  })
})
