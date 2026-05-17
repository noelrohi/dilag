import { describe, expect, it } from "vitest"
import { getDesignExportDimensions, resolveDesignPlatform } from "./design-viewport"

describe("design viewport", () => {
  it("resolves a design's screen type before falling back to the session platform", () => {
    expect(resolveDesignPlatform({ screen_type: "mobile" }, "web")).toBe("mobile")
    expect(resolveDesignPlatform({ screen_type: "web" }, "mobile")).toBe("web")
    expect(resolveDesignPlatform({ screen_type: "" }, "mobile")).toBe("mobile")
  })

  it("uses per-screen export dimensions for mixed projects", () => {
    expect(
      getDesignExportDimensions(
        {
          screen_type: "mobile",
          html: '<html data-screen-type="mobile"><body style="width: 393px; height: 852px;"></body></html>',
        },
        "web",
      ),
    ).toEqual({ width: 393, height: 852 })

    expect(
      getDesignExportDimensions(
        { screen_type: "web", html: '<html data-screen-type="web"><body></body></html>' },
        "mobile",
      ),
    ).toEqual({ width: 1280, height: 800 })
  })
})
