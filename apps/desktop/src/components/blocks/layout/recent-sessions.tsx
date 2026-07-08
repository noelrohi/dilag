import { cn } from "@/lib/utils"
import type { SessionMeta } from "@/context/session-store"
import { IconStar as Star } from "@tabler/icons-react"
import { useNavigate } from "@tanstack/react-router"
import { useMemo } from "react"

const RECENT_SESSION_LIMIT = 5

export function RecentSessions({
  sessions,
  projectId,
}: {
  sessions: SessionMeta[]
  projectId: string
}) {
  const navigate = useNavigate()
  const recentSessions = useMemo(
    () =>
      sessions
        .filter((session) => session.projectId === projectId)
        .sort((a, b) => getSessionTime(b) - getSessionTime(a))
        .slice(0, RECENT_SESSION_LIMIT),
    [projectId, sessions],
  )

  if (recentSessions.length === 0) return null

  return (
    <section className="mt-8 space-y-3" aria-label="Recent chats">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-medium text-foreground">Recent chats</h2>
      </div>

      <div className="space-y-2">
        {recentSessions.map((session) => (
          <button
            key={session.id}
            type="button"
            className={cn(
              "group flex w-full items-center justify-between gap-3 rounded-2xl border border-border/70 bg-muted/20 p-4 text-left",
              "transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
            )}
            onClick={() =>
              navigate({
                to: "/project/$projectId/session/$sessionId",
                params: { projectId, sessionId: session.id },
              })
            }
          >
            <span className="min-w-0 flex-1">
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-medium text-foreground">{session.name}</span>
                {session.favorite && (
                  <Star
                    size={14}
                    fill="currentColor"
                    className="shrink-0 text-amber-500"
                    aria-label={`${session.name} is favorited`}
                  />
                )}
              </span>
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatRelativeTime(session.updated_at ?? session.created_at)}
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

function getSessionTime(session: SessionMeta) {
  return new Date(session.updated_at ?? session.created_at).getTime()
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return ""

  const diffMs = Date.now() - date.getTime()
  if (diffMs < 0) return "now"

  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return `${Math.floor(diffDays / 30)}mo ago`
}
