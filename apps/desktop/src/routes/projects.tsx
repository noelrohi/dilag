import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useSessions } from "@/hooks/use-sessions";
import { cn } from "@/lib/utils";
import { Search, MoreHorizontal, Trash2, Globe } from "lucide-react";
import { Star } from "@phosphor-icons/react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@dilag/ui/dropdown-menu";

export const Route = createFileRoute("/projects")({
  component: ProjectsPage,
});

function ProjectsPage() {
  const navigate = useNavigate();
  const { sessions, deleteSession, toggleFavorite } = useSessions();
  const [searchQuery, setSearchQuery] = useState("");

  const handleOpenProject = (sessionId: string) => {
    navigate({ to: "/studio/$sessionId", params: { sessionId } });
  };

  const handleDeleteProject = async (sessionId: string) => {
    await deleteSession(sessionId);
  };

  const filteredSessions = useMemo(() => {
    let filtered = sessions;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = sessions.filter(session =>
        session.name?.toLowerCase().includes(query) ||
        session.id.toLowerCase().includes(query)
      );
    }

    return [...filtered].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [sessions, searchQuery]);

  const groupedSessions = useMemo(() => {
    const groups: { label: string; sessions: typeof sessions }[] = [];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const todaySessions: typeof sessions = [];
    const yesterdaySessions: typeof sessions = [];
    const lastWeekSessions: typeof sessions = [];
    const olderSessions: typeof sessions = [];

    for (const session of filteredSessions) {
      const date = new Date(session.created_at);
      if (date >= today) {
        todaySessions.push(session);
      } else if (date >= yesterday) {
        yesterdaySessions.push(session);
      } else if (date >= lastWeek) {
        lastWeekSessions.push(session);
      } else {
        olderSessions.push(session);
      }
    }

    if (todaySessions.length > 0) groups.push({ label: "Today", sessions: todaySessions });
    if (yesterdaySessions.length > 0) groups.push({ label: "Yesterday", sessions: yesterdaySessions });
    if (lastWeekSessions.length > 0) groups.push({ label: "This Week", sessions: lastWeekSessions });
    if (olderSessions.length > 0) groups.push({ label: "Older", sessions: olderSessions });

    return groups;
  }, [filteredSessions]);

  return (
    <div className="h-dvh flex flex-col bg-background">
      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between px-2 mb-6">
            <div>
              <h1 className="text-xl font-semibold text-foreground">Projects</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {sessions.length} {sessions.length === 1 ? "project" : "projects"}
              </p>
            </div>

            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/50" />
              <input
                type="text"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(
                  "w-full h-9 pl-9 pr-3 rounded-lg text-sm",
                  "bg-muted/50 border-none",
                  "placeholder:text-muted-foreground/50",
                  "focus:outline-none focus:ring-2 focus:ring-ring/20",
                  "transition-all"
                )}
              />
            </div>
          </div>

          {filteredSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="size-12 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <Globe className="size-5 text-muted-foreground/50" />
              </div>
              <p className="text-muted-foreground text-sm">
                {searchQuery ? "No matching projects" : "No projects yet"}
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {groupedSessions.map((group) => (
                <section key={group.label}>
                  <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-2 mb-3">
                    {group.label}
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {group.sessions.map((session) => (
                      <ProjectCard
                        key={session.id}
                        session={session}
                        onOpen={() => handleOpenProject(session.id)}
                        onDelete={() => handleDeleteProject(session.id)}
                        onToggleFavorite={() => toggleFavorite(session.id)}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

interface SessionMeta {
  id: string;
  name: string;
  created_at: string;
  cwd: string;
  favorite?: boolean;
}

function ProjectCard({
  session,
  onOpen,
  onDelete,
  onToggleFavorite,
}: {
  session: SessionMeta;
  onOpen: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
}) {
  const isFavorite = session.favorite ?? false;

  return (
    <div
      className={cn(
        "group relative rounded-2xl overflow-hidden",
        "bg-card border border-border/50",
        "hover:border-border/80 hover:shadow-xl hover:shadow-black/5",
        "dark:hover:shadow-black/20",
        "transition-all duration-300 cursor-pointer"
      )}
      onClick={onOpen}
    >
      {/* Favorite indicator */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite();
        }}
        className={cn(
          "absolute top-3 right-3 z-10 p-1.5 rounded-lg",
          "transition-all duration-200",
          isFavorite
            ? "text-amber-500 hover:text-amber-400"
            : "text-muted-foreground/30 hover:text-muted-foreground opacity-0 group-hover:opacity-100"
        )}
      >
        <Star weight={isFavorite ? "fill" : "regular"} className="size-5" />
      </button>

      <div className="relative h-32 bg-gradient-to-br from-primary/5 via-muted/30 to-accent/5 overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          <Globe className="size-10 text-muted-foreground/20" />
        </div>
      </div>

      <div className="px-4 py-3 border-t border-border/30">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-medium text-foreground truncate">
              {session.name || "Untitled"}
            </h3>
            <span className="text-[11px] text-muted-foreground">
              {formatDate(session.created_at)}
            </span>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  "p-1.5 rounded-lg -mr-1.5 -mt-0.5",
                  "text-muted-foreground/40 hover:text-foreground hover:bg-muted",
                  "opacity-0 group-hover:opacity-100",
                  "transition-all duration-200"
                )}
              >
                <MoreHorizontal className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite();
                }}
              >
                <Star weight={isFavorite ? "fill" : "regular"} className={cn("size-4 mr-2", isFavorite && "text-amber-500")} />
                {isFavorite ? "Unfavorite" : "Favorite"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="text-destructive focus:text-destructive focus:bg-destructive/10"
              >
                <Trash2 className="size-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
