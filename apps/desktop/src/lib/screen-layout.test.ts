import { describe, expect, it } from "vitest"
import {
  findMissingScreenPositions,
  getGhostScreenPosition,
  getScreenLayout,
  reconcileScreenPositions,
  type ScreenPosition,
} from "./screen-layout"

const designs = (filenames: string[]) => filenames.map((filename) => ({ filename }))

describe("screen layout", () => {
  it("preserves existing persisted positions", () => {
    const persistedPositions: ScreenPosition[] = [
      { id: "home.html", x: 12, y: 34 },
      { id: "settings.html", x: 56, y: 78 },
    ]

    expect(
      reconcileScreenPositions({
        designs: designs(["home.html", "settings.html"]),
        persistedPositions,
        platform: "web",
      }),
    ).toEqual(persistedPositions)
  })

  it("derives missing positions deterministically from design order", () => {
    expect(
      findMissingScreenPositions({
        designs: designs(["home.html", "settings.html", "profile.html"]),
        persistedPositions: [{ id: "settings.html", x: 5000, y: 6000 }],
        platform: "web",
      }),
    ).toEqual([
      { id: "home.html", x: 100, y: 40 },
      { id: "profile.html", x: 100, y: 500 },
    ])
  })

  it("does not return render positions for removed designs", () => {
    expect(
      reconcileScreenPositions({
        designs: designs(["home.html"]),
        persistedPositions: [
          { id: "home.html", x: 12, y: 34 },
          { id: "removed.html", x: 56, y: 78 },
        ],
        platform: "web",
      }),
    ).toEqual([{ id: "home.html", x: 12, y: 34 }])
  })

  it("places the ghost after the current screens", () => {
    const screenPositions = reconcileScreenPositions({
      designs: designs(["home.html", "settings.html", "profile.html"]),
      persistedPositions: [],
      platform: "web",
    })

    expect(getGhostScreenPosition({ screenPositions, platform: "web" })).toEqual({
      x: 800,
      y: 500,
    })
  })

  it("uses different mobile and web dimensions and columns", () => {
    expect(getScreenLayout("mobile")).toMatchObject({
      screen: { width: 280, height: 584 },
      columns: 4,
      gap: 60,
    })
    expect(getScreenLayout("web")).toMatchObject({
      screen: { width: 640, height: 400 },
      columns: 2,
      gap: 60,
    })
  })
})
