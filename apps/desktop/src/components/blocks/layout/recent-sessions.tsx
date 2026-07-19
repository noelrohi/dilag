import type { SessionMeta } from "@/context/session-store"
import { Button } from "@dilag/ui/button"
import { Separator } from "@dilag/ui/separator"
import { IconStar as Star } from "@tabler/icons-react"
import { useNavigate } from "@tanstack/react-router"
import { Fragment, useMemo } from "react"

const RECENT_SESSION_LIMIT = 4

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
    <section className="mt-8" aria-label="Recent chats">
      <div>
        {recentSessions.map((session, index) => (
          <Fragment key={session.id}>
            {index > 0 && <Separator className="bg-border/60" />}
            <Button
              type="button"
              variant="ghost"
              className="group h-auto w-full justify-between gap-3 rounded-none px-3 py-3 text-left focus-visible:ring-2 focus-visible:ring-ring/30"
              onClick={() =>
                navigate({
                  to: "/project/$projectId/session/$sessionId",
                  params: { projectId, sessionId: session.id },
                })
              }
            >
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-normal text-muted-foreground">
                    {session.name}
                  </span>
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
              <span className="shrink-0 text-xs font-normal text-muted-foreground">
                {formatRelativeTime(session.updated_at ?? session.created_at)}
              </span>
            </Button>
          </Fragment>
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
