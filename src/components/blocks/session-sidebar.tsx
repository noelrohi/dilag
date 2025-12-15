import { MessageSquarePlus, Trash2, MessageSquare } from "lucide-react";
import { useSessions } from "@/hooks/use-sessions";
import { Button } from "@/components/ui/button";
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

export function SessionSidebar() {
  const {
    sessions,
    currentSessionId,
    isLoading,
    createSession,
    selectSession,
    deleteSession,
  } = useSessions();

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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Sidebar>
      <SidebarHeader>
        <Button
          onClick={handleCreateSession}
          disabled={isLoading}
          className="w-full justify-start gap-2"
          variant="outline"
        >
          <MessageSquarePlus className="size-4" />
          New Session
        </Button>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Sessions</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {sessions.length === 0 ? (
                <p className="px-2 py-4 text-sm text-muted-foreground text-center">
                  No sessions yet. Create one to get started.
                </p>
              ) : (
                sessions.map((session) => (
                  <SidebarMenuItem key={session.id}>
                    <SidebarMenuButton
                      isActive={currentSessionId === session.id}
                      onClick={() => selectSession(session.id)}
                      className="pr-8"
                    >
                      <MessageSquare className="size-4" />
                      <div className="flex flex-col items-start gap-0.5 overflow-hidden">
                        <span className="truncate">{session.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(session.created_at)}
                        </span>
                      </div>
                    </SidebarMenuButton>
                    <SidebarMenuAction
                      onClick={(e) => handleDeleteSession(e, session.id)}
                      showOnHover
                    >
                      <Trash2 className="size-4" />
                      <span className="sr-only">Delete session</span>
                    </SidebarMenuAction>
                  </SidebarMenuItem>
                ))
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
