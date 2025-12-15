import { useMemo, useState, useCallback } from "react";
import {
  Plus,
  Trash2,
  Search,
  Sparkles,
  Clock,
  Calendar,
  Archive,
} from "lucide-react";
import { useSessions } from "@/hooks/use-sessions";
import { useSessionStore } from "@/context/session-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

type SessionMeta = {
  id: string;
  name: string;
  created_at: string;
  cwd: string;
};

function SessionStatusDot({ sessionId }: { sessionId: string }) {
  const selector = useCallback(
    (state: { sessionStatus: Record<string, string> }) =>
      state.sessionStatus[sessionId] ?? "unknown",
    [sessionId]
  );
  const status = useSessionStore(selector);

  return (
    <div
      className={cn(
        "size-1.5 rounded-full transition-all duration-300 shrink-0",
        status === "running" && "bg-[var(--status-running)] status-running",
        status === "idle" && "bg-[var(--status-idle)]",
        status === "error" && "bg-[var(--status-error)]",
        status === "unknown" && "bg-muted-foreground/30"
      )}
    />
  );
}

function groupSessionsByTime(sessions: SessionMeta[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  const groups: {
    today: SessionMeta[];
    yesterday: SessionMeta[];
    lastWeek: SessionMeta[];
    older: SessionMeta[];
  } = {
    today: [],
    yesterday: [],
    lastWeek: [],
    older: [],
  };

  // Sort sessions by date descending
  const sorted = [...sessions].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  sorted.forEach((session) => {
    const date = new Date(session.created_at);
    if (date >= today) {
      groups.today.push(session);
    } else if (date >= yesterday) {
      groups.yesterday.push(session);
    } else if (date >= lastWeek) {
      groups.lastWeek.push(session);
    } else {
      groups.older.push(session);
    }
  });

  return groups;
}

function SessionGroup({
  label,
  icon: Icon,
  sessions,
  currentSessionId,
  onSelect,
  onDelete,
}: {
  label: string;
  icon: React.ElementType;
  sessions: SessionMeta[];
  currentSessionId: string | null;
  onSelect: (id: string) => void;
  onDelete: (e: React.MouseEvent, id: string) => void;
}) {
  if (sessions.length === 0) return null;

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground/60">
        <Icon className="size-3" />
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {sessions.map((session) => (
            <SidebarMenuItem key={session.id}>
              <SidebarMenuButton
                isActive={currentSessionId === session.id}
                onClick={() => onSelect(session.id)}
                className={cn(
                  "group pr-8 py-3 transition-all duration-200",
                  currentSessionId === session.id &&
                    "bg-sidebar-accent/80 border-l-2 border-primary"
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <SessionStatusDot sessionId={session.id} />
                  <div className="flex flex-col items-start gap-0.5 overflow-hidden">
                    <span className="truncate text-sm font-medium">
                      {session.name}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground/50">
                      {formatTime(session.created_at)}
                    </span>
                  </div>
                </div>
              </SidebarMenuButton>
              <SidebarMenuAction
                onClick={(e) => onDelete(e, session.id)}
                showOnHover
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive transition-colors" />
                <span className="sr-only">Delete session</span>
              </SidebarMenuAction>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function formatTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (date >= today) {
    return date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function SessionSidebar() {
  const {
    sessions,
    currentSessionId,
    isLoading,
    createSession,
    selectSession,
    deleteSession,
  } = useSessions();

  const [searchQuery, setSearchQuery] = useState("");

  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const query = searchQuery.toLowerCase();
    return sessions.filter((s) => s.name.toLowerCase().includes(query));
  }, [sessions, searchQuery]);

  const groupedSessions = useMemo(
    () => groupSessionsByTime(filteredSessions),
    [filteredSessions]
  );

  const handleCreateSession = async () => {
    await createSession();
  };

  const handleDeleteSession = async (
    e: React.MouseEvent,
    sessionId: string
  ) => {
    e.stopPropagation();
    await deleteSession(sessionId);
  };

  return (
    <Sidebar className="border-r border-sidebar-border/50">
      <SidebarHeader className="p-4 space-y-4">
        {/* New Session Button */}
        <Button
          onClick={handleCreateSession}
          disabled={isLoading}
          className={cn(
            "w-full justify-start gap-2.5 h-10 rounded-xl",
            "bg-primary/10 hover:bg-primary/20 text-primary border-0",
            "transition-all duration-200"
          )}
          variant="outline"
        >
          <Plus className="size-4" />
          <span className="font-medium">New Session</span>
        </Button>

        {/* Search */}
        {sessions.length > 3 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search sessions..."
              className={cn(
                "pl-9 h-9 bg-sidebar-accent/30 border-0 rounded-lg",
                "placeholder:text-muted-foreground/40 text-sm",
                "focus-visible:ring-1 focus-visible:ring-primary/30"
              )}
            />
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="px-2">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="size-12 rounded-xl bg-sidebar-accent/50 flex items-center justify-center mb-4">
              <Sparkles className="size-5 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              No sessions yet
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Create one to get started
            </p>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="size-12 rounded-xl bg-sidebar-accent/50 flex items-center justify-center mb-4">
              <Search className="size-5 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              No results found
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Try a different search
            </p>
          </div>
        ) : (
          <>
            <SessionGroup
              label="Today"
              icon={Clock}
              sessions={groupedSessions.today}
              currentSessionId={currentSessionId}
              onSelect={selectSession}
              onDelete={handleDeleteSession}
            />
            <SessionGroup
              label="Yesterday"
              icon={Calendar}
              sessions={groupedSessions.yesterday}
              currentSessionId={currentSessionId}
              onSelect={selectSession}
              onDelete={handleDeleteSession}
            />
            <SessionGroup
              label="This Week"
              icon={Calendar}
              sessions={groupedSessions.lastWeek}
              currentSessionId={currentSessionId}
              onSelect={selectSession}
              onDelete={handleDeleteSession}
            />
            <SessionGroup
              label="Older"
              icon={Archive}
              sessions={groupedSessions.older}
              currentSessionId={currentSessionId}
              onSelect={selectSession}
              onDelete={handleDeleteSession}
            />
          </>
        )}
      </SidebarContent>

      {/* Footer with stats */}
      {sessions.length > 0 && (
        <div className="p-4 border-t border-sidebar-border/50">
          <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground/40 uppercase tracking-wider">
            <span>{sessions.length} sessions</span>
            <span>
              {sessions.filter((s) => {
                const date = new Date(s.created_at);
                const today = new Date();
                return (
                  date.getDate() === today.getDate() &&
                  date.getMonth() === today.getMonth() &&
                  date.getFullYear() === today.getFullYear()
                );
              }).length}{" "}
              today
            </span>
          </div>
        </div>
      )}
    </Sidebar>
  );
}
