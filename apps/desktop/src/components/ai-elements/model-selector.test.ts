import { describe, expect, it } from "vitest"
import { getModelSelectorLogoProvider } from "./model-selector"

describe("getModelSelectorLogoProvider", () => {
  it("maps OpenAI Codex auth providers to the OpenAI logo", () => {
    expect(getModelSelectorLogoProvider("openai-codex")).toBe("openai")
    expect(getModelSelectorLogoProvider("openai-codex-responses")).toBe("openai")
  })

  it("keeps ordinary provider ids unchanged", () => {
    expect(getModelSelectorLogoProvider("google")).toBe("google")
    expect(getModelSelectorLogoProvider("anthropic")).toBe("anthropic")
  })
})
