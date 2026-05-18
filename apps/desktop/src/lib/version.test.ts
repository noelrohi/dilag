import { describe, expect, it } from "vitest"
import { compareAppVersions, isNewerAppVersion } from "./version"

describe("app version comparison", () => {
  it("does not treat the same version as newer", () => {
    expect(isNewerAppVersion("0.6.1", "0.6.1")).toBe(false)
    expect(isNewerAppVersion("v0.6.1", "0.6.1")).toBe(false)
  })

  it("detects patch, minor, and major updates", () => {
    expect(isNewerAppVersion("0.6.2", "0.6.1")).toBe(true)
    expect(isNewerAppVersion("0.7.0", "0.6.9")).toBe(true)
    expect(isNewerAppVersion("1.0.0", "0.99.99")).toBe(true)
  })

  it("does not treat older versions as updates", () => {
    expect(isNewerAppVersion("0.6.0", "0.6.1")).toBe(false)
    expect(isNewerAppVersion("0.5.9", "0.6.1")).toBe(false)
  })

  it("orders prereleases below stable releases", () => {
    expect(compareAppVersions("0.6.1", "0.6.1-beta.1")).toBe(1)
    expect(compareAppVersions("0.6.1-beta.2", "0.6.1-beta.1")).toBe(1)
    expect(isNewerAppVersion("0.6.1-beta.1", "0.6.1")).toBe(false)
  })
})
