type ParsedVersion = {
  core: number[]
  prerelease: string[]
}

function parseAppVersion(version: string): ParsedVersion | null {
  const trimmed = version.trim().replace(/^v/i, "")
  if (!trimmed) return null

  const withoutBuild = trimmed.split("+")[0]
  const [corePart, prereleasePart] = withoutBuild.split("-", 2)
  const core = corePart.split(".").map((segment) => {
    if (!/^\d+$/.test(segment)) return Number.NaN
    return Number(segment)
  })

  if (core.length === 0 || core.some((segment) => !Number.isFinite(segment))) {
    return null
  }

  return {
    core,
    prerelease: prereleasePart ? prereleasePart.split(".") : [],
  }
}

function comparePrerelease(left: string[], right: string[]): number {
  if (left.length === 0 && right.length === 0) return 0
  if (left.length === 0) return 1
  if (right.length === 0) return -1

  const length = Math.max(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    const leftPart = left[index]
    const rightPart = right[index]

    if (leftPart === undefined) return -1
    if (rightPart === undefined) return 1
    if (leftPart === rightPart) continue

    const leftIsNumber = /^\d+$/.test(leftPart)
    const rightIsNumber = /^\d+$/.test(rightPart)

    if (leftIsNumber && rightIsNumber) {
      return Number(leftPart) > Number(rightPart) ? 1 : -1
    }
    if (leftIsNumber) return -1
    if (rightIsNumber) return 1

    return leftPart.localeCompare(rightPart)
  }

  return 0
}

export function compareAppVersions(leftVersion: string, rightVersion: string): number {
  const left = parseAppVersion(leftVersion)
  const right = parseAppVersion(rightVersion)

  if (!left || !right) {
    return leftVersion.trim().localeCompare(rightVersion.trim())
  }

  const length = Math.max(left.core.length, right.core.length)
  for (let index = 0; index < length; index += 1) {
    const leftPart = left.core[index] ?? 0
    const rightPart = right.core[index] ?? 0
    if (leftPart === rightPart) continue
    return leftPart > rightPart ? 1 : -1
  }

  return comparePrerelease(left.prerelease, right.prerelease)
}

export function isNewerAppVersion(candidateVersion: string, currentVersion: string): boolean {
  return compareAppVersions(candidateVersion, currentVersion) > 0
}
