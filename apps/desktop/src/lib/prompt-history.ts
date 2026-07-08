const KEY = (sessionId: string) => `dilag-prompt-history:${sessionId}`
const LIMIT = 50

export function loadPromptHistory(sessionId: string): string[] {
  try {
    const raw = localStorage.getItem(KEY(sessionId))
    if (!raw) return []

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed.filter((item): item is string => typeof item === "string" && item.length > 0)
  } catch {
    return []
  }
}

export function pushPromptHistory(sessionId: string, prompt: string): void {
  const normalizedPrompt = prompt.trim()
  if (!normalizedPrompt) return

  try {
    const current = loadPromptHistory(sessionId)
    const next =
      current.at(-1) === normalizedPrompt ? current : [...current, normalizedPrompt].slice(-LIMIT)

    localStorage.setItem(KEY(sessionId), JSON.stringify(next))
  } catch {
    // localStorage is best-effort UI state.
  }
}
