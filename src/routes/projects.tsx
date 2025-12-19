import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSessions } from "@/hooks/use-sessions";
import type { DesignFile } from "@/hooks/use-designs";
import { cn } from "@/lib/utils";
import { Search, MoreHorizontal, Trash2, Smartphone } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Thumbnail constants for stacked preview
const THUMB_RENDER_W = 375;
const THUMB_RENDER_H = 812;
const THUMB_DISPLAY_H = 140;
const THUMB_SCALE = THUMB_DISPLAY_H / THUMB_RENDER_H;
const THUMB_DISPLAY_W = THUMB_RENDER_W * THUMB_SCALE;

export const Route = createFileRoute("/projects")({
  component: ProjectsPage,
});

function ProjectsPage() {
  const navigate = useNavigate();
  const { sessions, deleteSession } = useSessions();
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
          {/* Header */}
          <div className="flex items-center justify-between px-2 mb-6">
            <div>
              <h1 className="text-xl font-semibold text-foreground">Projects</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {sessions.length} {sessions.length === 1 ? "project" : "projects"}
              </p>
            </div>

            {/* Search */}
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

          {/* Projects */}
          {filteredSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="size-12 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <Smartphone className="size-5 text-muted-foreground/50" />
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
}

function ProjectCard({
  session,
  onOpen,
  onDelete,
}: {
  session: SessionMeta;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const [designs, setDesigns] = useState<DesignFile[]>([]);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (!session.cwd) return;
    invoke<DesignFile[]>("load_session_designs", { sessionCwd: session.cwd })
      .then(setDesigns)
      .catch(() => setDesigns([]));
  }, [session.cwd]);

  // Get up to 3 screens for preview
  const previewScreens = designs.slice(0, 3);
  const screenCount = designs.length;
  const extraCount = Math.max(0, screenCount - 3);

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
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Stacked Screen Previews */}
      <div className="relative h-44 bg-gradient-to-b from-muted/40 to-muted/10 overflow-hidden">
        {previewScreens.length > 0 ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <StackedScreens screens={previewScreens} isHovered={isHovered} />
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <EmptyScreensPlaceholder />
          </div>
        )}

        {/* Extra count badge */}
        {extraCount > 0 && (
          <div className={cn(
            "absolute bottom-2 right-2 px-2 py-0.5 rounded-full",
            "bg-foreground/90 text-background",
            "text-[10px] font-semibold tabular-nums",
            "shadow-lg"
          )}>
            +{extraCount}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="px-4 py-3 border-t border-border/30">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-medium text-foreground truncate">
              {session.name || "Untitled"}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[11px] text-muted-foreground">
                {formatDate(session.created_at)}
              </span>
              {screenCount > 0 && (
                <>
                  <span className="text-muted-foreground/30">·</span>
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {screenCount} {screenCount === 1 ? "screen" : "screens"}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Menu */}
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

function StackedScreens({
  screens,
  isHovered
}: {
  screens: DesignFile[];
  isHovered: boolean;
}) {
  // Calculate positioning for stacked effect
  const getScreenStyle = (index: number, total: number): React.CSSProperties => {
    const baseOffset = 22;
    const hoverSpread = 32;

    if (total === 1) {
      return {
        transform: 'translateX(0) rotate(0deg)',
        zIndex: 1,
      };
    }

    if (total === 2) {
      const positions = isHovered ? [-hoverSpread, hoverSpread] : [-baseOffset / 2, baseOffset / 2];
      const rotations = isHovered ? [-5, 5] : [-3, 3];
      return {
        transform: `translateX(${positions[index]}px) rotate(${rotations[index]}deg)`,
        zIndex: index + 1,
      };
    }

    // 3 screens
    const positions = isHovered
      ? [-hoverSpread * 1.4, 0, hoverSpread * 1.4]
      : [-baseOffset, 0, baseOffset];
    const rotations = isHovered ? [-8, 0, 8] : [-5, 0, 5];

    return {
      transform: `translateX(${positions[index]}px) rotate(${rotations[index]}deg)`,
      zIndex: index === 1 ? 3 : index + 1,
    };
  };

  return (
    <div className="relative flex items-center justify-center" style={{ height: THUMB_DISPLAY_H + 24 }}>
      {screens.map((screen, index) => (
        <div
          key={index}
          className={cn(
            "absolute rounded-xl overflow-hidden",
            "bg-white dark:bg-zinc-900",
            "ring-1 ring-black/[0.08] dark:ring-white/10",
            "transition-all duration-300 ease-out"
          )}
          style={{
            width: THUMB_DISPLAY_W,
            height: THUMB_DISPLAY_H,
            boxShadow: '0 4px 20px -2px rgba(0,0,0,0.15), 0 2px 8px -2px rgba(0,0,0,0.1)',
            ...getScreenStyle(index, screens.length),
          }}
        >
          <ScreenPreview html={screen.html} />
        </div>
      ))}
    </div>
  );
}

function EmptyScreensPlaceholder() {
  return (
    <div className="flex items-center justify-center">
      <div className="relative" style={{ height: THUMB_DISPLAY_H }}>
        {[0, 1, 2].map((i) => {
          const offsets = [-20, 0, 20];
          const rotations = [-6, 0, 6];
          return (
            <div
              key={i}
              className={cn(
                "absolute rounded-xl border-2 border-dashed border-muted-foreground/15",
                "bg-muted/20",
                "flex items-center justify-center"
              )}
              style={{
                width: THUMB_DISPLAY_W * 0.85,
                height: THUMB_DISPLAY_H * 0.9,
                left: '50%',
                top: '50%',
                transform: `translate(-50%, -50%) translateX(${offsets[i]}px) rotate(${rotations[i]}deg)`,
                zIndex: i === 1 ? 3 : i + 1,
              }}
            >
              {i === 1 && (
                <Smartphone className="size-5 text-muted-foreground/25" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ScreenPreview({ html }: { html: string }) {
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

  return (
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
