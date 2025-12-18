import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSessions } from "@/hooks/use-sessions";
import type { DesignFile } from "@/hooks/use-designs";
import { cn } from "@/lib/utils";
import { X, Search, Calendar, SortDesc } from "lucide-react";

// Mini thumbnail constants
const THUMB_RENDER_W = 393;
const THUMB_RENDER_H = 852;
const THUMB_DISPLAY_H = 72;
const THUMB_SCALE = THUMB_DISPLAY_H / THUMB_RENDER_H;

export const Route = createLazyFileRoute("/projects")({
  component: ProjectsPage,
});

function ProjectsPage() {
  const navigate = useNavigate();
  const { sessions, deleteSession } = useSessions();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "name">("recent");

  const handleOpenProject = (sessionId: string) => {
    navigate({ to: "/studio/$sessionId", params: { sessionId } });
  };

  const handleDeleteProject = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    await deleteSession(sessionId);
  };

  const filteredAndSortedSessions = useMemo(() => {
    let filtered = sessions;
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = sessions.filter(session => 
        session.name?.toLowerCase().includes(query) || 
        session.id.toLowerCase().includes(query)
      );
    }

    // Sort
    return [...filtered].sort((a, b) => {
      if (sortBy === "recent") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      return (a.name || "Untitled").localeCompare(b.name || "Untitled");
    });
  }, [sessions, searchQuery, sortBy]);

  // Group sessions by time period
  const groupedSessions = useMemo(() => {
    const groups: { label: string; sessions: typeof sessions }[] = [];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const lastMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const todaySessions: typeof sessions = [];
    const yesterdaySessions: typeof sessions = [];
    const lastWeekSessions: typeof sessions = [];
    const lastMonthSessions: typeof sessions = [];
    const olderSessions: typeof sessions = [];

    for (const session of filteredAndSortedSessions) {
      const date = new Date(session.created_at);
      if (date >= today) {
        todaySessions.push(session);
      } else if (date >= yesterday) {
        yesterdaySessions.push(session);
      } else if (date >= lastWeek) {
        lastWeekSessions.push(session);
      } else if (date >= lastMonth) {
        lastMonthSessions.push(session);
      } else {
        olderSessions.push(session);
      }
    }

    if (todaySessions.length > 0) groups.push({ label: "Today", sessions: todaySessions });
    if (yesterdaySessions.length > 0) groups.push({ label: "Yesterday", sessions: yesterdaySessions });
    if (lastWeekSessions.length > 0) groups.push({ label: "Last 7 days", sessions: lastWeekSessions });
    if (lastMonthSessions.length > 0) groups.push({ label: "Last 30 days", sessions: lastMonthSessions });
    if (olderSessions.length > 0) groups.push({ label: "Older", sessions: olderSessions });

    return groups;
  }, [filteredAndSortedSessions]);

  return (
    <div className="h-dvh flex flex-col bg-background relative overflow-hidden">
      {/* Ambient background gradient */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40 dark:opacity-20"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 50% -20%, oklch(0.7 0.1 255 / 15%), transparent),
            radial-gradient(ellipse 60% 40% at 100% 100%, oklch(0.7 0.08 200 / 10%), transparent)
          `,
        }}
      />

      {/* Subtle noise texture overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.015] dark:opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Content */}
      <main className="relative flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-foreground mb-2">
              All projects
            </h1>
            <p className="text-[14px] text-muted-foreground">
              {sessions.length} {sessions.length === 1 ? "project" : "projects"} total
            </p>
          </div>

          {/* Filters bar */}
          <div className="flex items-center gap-3 mb-6">
            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/50" />
              <input
                type="text"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(
                  "w-full h-9 pl-9 pr-3 rounded-lg text-[13px]",
                  "bg-card/60 border border-border/50",
                  "placeholder:text-muted-foreground/40",
                  "focus:outline-none focus:border-border focus:ring-1 focus:ring-border/50",
                  "transition-all duration-200"
                )}
              />
            </div>

            {/* Sort toggle */}
            <div className="flex items-center gap-1 p-0.5 rounded-lg bg-muted/30 border border-border/30">
              <button
                onClick={() => setSortBy("recent")}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all",
                  sortBy === "recent"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Calendar className="size-3" />
                Recent
              </button>
              <button
                onClick={() => setSortBy("name")}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all",
                  sortBy === "name"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <SortDesc className="size-3" />
                Name
              </button>
            </div>
          </div>

          {/* Projects grid - grouped by time */}
          {filteredAndSortedSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <p className="text-muted-foreground text-[14px]">
                {searchQuery ? "No projects match your search" : "No projects yet"}
              </p>
            </div>
          ) : sortBy === "recent" ? (
            <div className="space-y-8">
              {groupedSessions.map((group, groupIndex) => (
                <div
                  key={group.label}
                  className="animate-in fade-in slide-in-from-bottom-2 duration-300"
                  style={{ animationDelay: `${groupIndex * 50}ms`, animationFillMode: 'backwards' }}
                >
                  <h3 className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground/60 mb-3">
                    {group.label}
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {group.sessions.map((session, i) => (
                      <ProjectCard
                        key={session.id}
                        session={session}
                        onOpen={() => handleOpenProject(session.id)}
                        onDelete={(e) => handleDeleteProject(e, session.id)}
                        delay={i * 30}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredAndSortedSessions.map((session, i) => (
                <ProjectCard
                  key={session.id}
                  session={session}
                  onOpen={() => handleOpenProject(session.id)}
                  onDelete={(e) => handleDeleteProject(e, session.id)}
                  delay={i * 20}
                />
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
}

function ProjectCard({
  session,
  onOpen,
  onDelete,
  delay = 0,
}: {
  session: SessionMeta;
  onOpen: () => void;
  onDelete: (e: React.MouseEvent) => void;
  delay?: number;
}) {
  const [designs, setDesigns] = useState<DesignFile[]>([]);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (!session.cwd) return;
    invoke<DesignFile[]>("load_session_designs", { sessionCwd: session.cwd })
      .then(setDesigns)
      .catch(() => setDesigns([]));
  }, [session.cwd]);

  const previewDesigns = designs;

  return (
    <button
      onClick={onOpen}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "group relative text-left p-3 rounded-xl transition-all duration-300 ease-out",
        "bg-card/50 border border-border/50",
        "hover:bg-card hover:border-border hover:shadow-lg hover:shadow-black/[0.03]",
        "dark:hover:shadow-black/20",
        "animate-in fade-in slide-in-from-bottom-2 duration-300"
      )}
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'backwards' }}
    >
      {/* Screen previews */}
      <div className="flex gap-1 mb-3 h-[72px] overflow-x-auto overflow-y-hidden rounded-lg bg-muted/30 scrollbar-none p-1.5">
        {previewDesigns.length > 0 ? (
          previewDesigns.map((design, i) => (
            <ScreenThumbnail key={i} html={design.html} isHovered={isHovered} index={i} />
          ))
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-[10px] text-muted-foreground/50 font-medium">
              No screens yet
            </span>
          </div>
        )}
      </div>

      {/* Title and meta */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-foreground truncate leading-tight">
            {session.name || "Untitled"}
          </p>
          <p className="text-[11px] text-muted-foreground/70 mt-0.5">
            {formatDate(session.created_at)}
          </p>
        </div>
        <button
          onClick={onDelete}
          className={cn(
            "p-1.5 rounded-md transition-all duration-200 shrink-0",
            "opacity-0 group-hover:opacity-100",
            "hover:bg-destructive/10 hover:text-destructive"
          )}
        >
          <X className="size-3" />
        </button>
      </div>
    </button>
  );
}

function ScreenThumbnail({
  html,
  isHovered,
  index
}: {
  html: string;
  isHovered: boolean;
  index: number;
}) {
  const srcDoc = useMemo(() => {
    if (!html) return null;

    const sizingCSS = `
      <style>
        html, body {
          width: ${THUMB_RENDER_W}px !important;
          height: ${THUMB_RENDER_H}px !important;
          overflow: hidden !important;
          margin: 0 !important;
          padding: 0 !important;
        }
      </style>
    `;

    if (html.includes("<!DOCTYPE") || html.includes("<html")) {
      if (html.includes("</head>")) {
        return html.replace("</head>", `${sizingCSS}</head>`);
      }
      return sizingCSS + html;
    }

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  ${sizingCSS}
</head>
<body>
${html}
</body>
</html>`;
  }, [html]);

  if (!srcDoc) return null;

  const displayW = THUMB_RENDER_W * THUMB_SCALE;

  return (
    <div
      className={cn(
        "shrink-0 overflow-hidden rounded-md bg-card shadow-sm",
        "ring-1 ring-border/30 transition-all duration-300 ease-out"
      )}
      style={{
        width: displayW,
        height: THUMB_DISPLAY_H,
        transform: isHovered ? `translateY(-${index * 1}px)` : 'none',
        transitionDelay: `${index * 30}ms`
      }}
    >
      <iframe
        srcDoc={srcDoc}
        className="border-0 origin-top-left pointer-events-none"
        style={{
          width: THUMB_RENDER_W,
          height: THUMB_RENDER_H,
          transform: `scale(${THUMB_SCALE})`,
        }}
        sandbox="allow-scripts allow-same-origin"
        tabIndex={-1}
      />
    </div>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
