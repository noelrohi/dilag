export type ScreenPlatform = "mobile" | "web"

export interface ScreenPosition {
  id: string
  x: number
  y: number
}

export interface ScreenLayoutDesign {
  filename: string
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

function getDefaultScreenPosition(
  id: string,
  index: number,
  platform: ScreenPlatform,
): ScreenPosition {
  const layout = SCREEN_LAYOUTS[platform]
  const col = index % layout.columns
  const row = Math.floor(index / layout.columns)

  return {
    id,
    x: layout.start.x + col * (layout.screen.width + layout.gap),
    y: layout.start.y + row * (layout.screen.height + layout.gap),
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

    return getDefaultScreenPosition(design.filename, index, platform)
  })
}

export function findMissingScreenPositions(args: ScreenPositionsArgs): ScreenPosition[] {
  const persistedIds = new Set(args.persistedPositions.map((position) => position.id))

  return reconcileScreenPositions(args).filter((position) => !persistedIds.has(position.id))
}

export function getGhostScreenPosition({
  screenPositions,
  platform,
}: {
  screenPositions: readonly ScreenPosition[]
  platform: ScreenPlatform
}): { x: number; y: number } {
  const layout = SCREEN_LAYOUTS[platform]
  const count = screenPositions.length
  const col = count % layout.columns
  const row = Math.floor(count / layout.columns)
  const startX =
    screenPositions.length > 0
      ? Math.min(...screenPositions.map((position) => position.x))
      : layout.start.x
  const startY =
    screenPositions.length > 0
      ? Math.min(...screenPositions.map((position) => position.y))
      : layout.start.y

  return {
    x: startX + col * (layout.screen.width + layout.gap),
    y: startY + row * (layout.screen.height + layout.gap),
  }
}
