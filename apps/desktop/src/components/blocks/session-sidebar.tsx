import { useMemo, useState } from "react";
import {
  Plus,
  Trash2,
  Search,
  Sparkles,
  Clock,
  Calendar,
  Archive,
  PanelLeft,
  Settings,
  Wifi,
  WifiOff,
  Loader2,
  GitFork,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useSessions } from "@/hooks/use-sessions";
import { useConnectionStatus, type ConnectionStatus } from "@/context/global-events";
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
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type SessionMeta = {
  id: string;
  name: string;
  created_at: string;
  cwd: string;
  parentID?: string; // Reference to parent session if forked
};

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

function ConnectionStatusIndicator() {
  const { connectionStatus, reconnectAttempt } = useConnectionStatus();

  const statusConfig: Record<ConnectionStatus, { color: string; icon: React.ReactNode; label: string }> = {
    connected: {
      color: "bg-green-500",
      icon: <Wifi className="size-3" />,
      label: "Connected",
    },
    connecting: {
      color: "bg-yellow-500",
      icon: <Loader2 className="size-3 animate-spin" />,
      label: "Connecting...",
    },
    reconnecting: {
      color: "bg-yellow-500",
      icon: <Loader2 className="size-3 animate-spin" />,
      label: reconnectAttempt > 1 ? `Reconnecting (attempt ${reconnectAttempt})` : "Reconnecting...",
    },
    disconnected: {
      color: "bg-red-500",
      icon: <WifiOff className="size-3" />,
      label: "Disconnected",
    },
  };

  const config = statusConfig[connectionStatus];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1.5 px-1.5 py-1 rounded text-muted-foreground/60 hover:text-muted-foreground transition-colors cursor-default">
          <div className={cn("size-1.5 rounded-full", config.color)} />
          <span className="text-[10px] font-mono uppercase tracking-wider">
            {connectionStatus === "connected" ? "" : connectionStatus}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        <div className="flex items-center gap-2">
          {config.icon}
          <span>{config.label}</span>
        </div>
      </TooltipContent>
    </Tooltip>
  );
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
                  "group pr-8 transition-all duration-200 rounded-none",
                  currentSessionId === session.id &&
                    "bg-sidebar-accent/80 border-l-2 border-primary"
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {session.parentID && (
                    <GitFork className="size-3 text-muted-foreground shrink-0" />
                  )}
                  <span className="truncate text-sm font-medium">
                    {session.name}
                  </span>
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

  const { toggleSidebar } = useSidebar();

  return (
    <Sidebar className="border-r border-sidebar-border/50">
      <SidebarHeader className="p-3 space-y-3">
        {/* Toolbar row */}
        <div className="flex items-center justify-between">
          <Button
            onClick={handleCreateSession}
            disabled={isLoading}
            variant="ghost"
            size="sm"
            className="gap-2 text-primary hover:text-primary hover:bg-primary/10"
          >
            <Plus className="size-4" />
            <span className="font-medium">New</span>
          </Button>

          <Button
            onClick={toggleSidebar}
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-foreground"
          >
            <PanelLeft className="size-4" />
            <span className="sr-only">Toggle sidebar</span>
          </Button>
        </div>

        {/* Search */}
        {sessions.length > 3 && (
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className={cn(
                "pl-8 h-8 bg-sidebar-accent/50 border-0 rounded-md",
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

      {/* Footer with settings and stats */}
      <div className="p-3 border-t border-sidebar-border/50 space-y-2">
        <div className="flex items-center justify-between">
          <Link to="/settings">
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-foreground"
            >
              <Settings className="size-4" />
              <span className="sr-only">Settings</span>
            </Button>
          </Link>
          {sessions.length > 0 && (
            <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground/40 uppercase tracking-wider">
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
          )}
        </div>
        <div className="flex items-center justify-end">
          <ConnectionStatusIndicator />
        </div>
      </div>
    </Sidebar>
  );
}
