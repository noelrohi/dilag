export type ScreenPlatform = "mobile" | "web"

export interface ScreenPosition {
  id: string
  x: number
  y: number
}

export interface ScreenLayoutDesign {
  filename: string
  screen_type?: string | null
}

export interface ScreenLayout {
  screen: {
    width: number
    height: number
  }
  gap: number
  columns: number
  start: {
    x: number
    y: number
  }
}

interface ScreenPositionsArgs {
  designs: readonly ScreenLayoutDesign[]
  persistedPositions: readonly ScreenPosition[]
  platform: ScreenPlatform
}

const START = { x: 100, y: 40 }
const GAP = 60

const SCREEN_LAYOUTS: Record<ScreenPlatform, ScreenLayout> = {
  mobile: {
    screen: { width: 280, height: 584 },
    gap: GAP,
    columns: 4,
    start: START,
  },
  web: {
    screen: { width: 640, height: 400 },
    gap: GAP,
    columns: 2,
    start: START,
  },
}

export function getScreenLayout(platform: ScreenPlatform): ScreenLayout {
  const layout = SCREEN_LAYOUTS[platform]

  return {
    screen: { ...layout.screen },
    gap: layout.gap,
    columns: layout.columns,
    start: { ...layout.start },
  }
}

function normalizeScreenPlatform(value: string | null | undefined, fallback: ScreenPlatform) {
  return value === "mobile" || value === "web" ? value : fallback
}

function getDefaultScreenPositions(
  designs: readonly ScreenLayoutDesign[],
  index: number,
  fallbackPlatform: ScreenPlatform,
): ScreenPosition {
  const platforms = designs.map((design) =>
    normalizeScreenPlatform(design.screen_type, fallbackPlatform),
  )
  const hasWeb = platforms.includes("web")
  const columns = hasWeb ? SCREEN_LAYOUTS.web.columns : SCREEN_LAYOUTS.mobile.columns
  const baseLayout = SCREEN_LAYOUTS[hasWeb ? "web" : "mobile"]
  const cellWidth = Math.max(...platforms.map((item) => SCREEN_LAYOUTS[item].screen.width))

  const col = index % columns
  const row = Math.floor(index / columns)
  let y = baseLayout.start.y
  for (let rowIndex = 0; rowIndex < row; rowIndex += 1) {
    const rowPlatforms = platforms.slice(rowIndex * columns, rowIndex * columns + columns)
    const rowHeight = Math.max(...rowPlatforms.map((item) => SCREEN_LAYOUTS[item].screen.height))
    y += rowHeight + baseLayout.gap
  }

  return {
    id: designs[index].filename,
    x: baseLayout.start.x + col * (cellWidth + baseLayout.gap),
    y,
  }
}

export function reconcileScreenPositions({
  designs,
  persistedPositions,
  platform,
}: ScreenPositionsArgs): ScreenPosition[] {
  const persistedPositionById = new Map(
    persistedPositions.map((position) => [position.id, position]),
  )

  return designs.map((design, index) => {
    const persistedPosition = persistedPositionById.get(design.filename)

    if (persistedPosition) {
      return {
        id: persistedPosition.id,
        x: persistedPosition.x,
        y: persistedPosition.y,
      }
    }

    return getDefaultScreenPositions(designs, index, platform)
  })
}

export function findMissingScreenPositions(args: ScreenPositionsArgs): ScreenPosition[] {
  const persistedIds = new Set(args.persistedPositions.map((position) => position.id))

  return reconcileScreenPositions(args).filter((position) => !persistedIds.has(position.id))
}
