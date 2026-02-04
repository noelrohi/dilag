import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { Folder, Settings, PlugCircle, Star, AddSquare, MenuDots, TrashBinMinimalistic } from "@solar-icons/react";
import { Sidebar, SidebarContent, SidebarHeader, SidebarFooter, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarMenuAction, SidebarGroup, SidebarGroupLabel, SidebarGroupContent } from "@dilag/ui/sidebar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@dilag/ui/dropdown-menu";
import { AuthSettings } from "@/components/blocks/auth/auth-settings";
import { TrialBanner } from "@/components/blocks/auth/trial-banner";
import { useSessions } from "@/hooks/use-sessions";

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { sessions, deleteSession, toggleFavorite } = useSessions();

  // Derive favorites and recent sessions
  const { favorites, recent } = useMemo(() => {
    const sorted = [...sessions].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const favs = sorted.filter((s) => s.favorite);
    const nonFavs = sorted.filter((s) => !s.favorite).slice(0, 5);
    return { favorites: favs, recent: nonFavs };
  }, [sessions]);

  const handleOpenProject = (sessionId: string) => {
    navigate({ to: "/studio/$sessionId", params: { sessionId } });
  };

  const handleNewDesign = () => {
    navigate({ to: "/" });
  };

  const handleToggleFavorite = (sessionId: string) => {
    toggleFavorite(sessionId);
  };

  const handleDelete = (sessionId: string) => {
    deleteSession(sessionId);
  };

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader data-tauri-drag-region className="h-[42px] pb-1 border-b border-sidebar-border" />

      <SidebarContent>
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={handleNewDesign}
                  tooltip="New design"
                >
                  <AddSquare size={16} />
                  <span>New design</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location.pathname === "/projects"}
                  tooltip="Projects"
                >
                  <Link to="/projects">
                    <Folder size={16} />
                    <span>Projects</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Favorites Section - hidden when collapsed */}
        {favorites.length > 0 && (
          <SidebarGroup className="group-data-[collapsible=icon]:hidden">
            <SidebarGroupLabel className="text-xs text-muted-foreground px-2">
              Favorites
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {favorites.map((session) => (
                  <SidebarMenuItem key={session.id} className="group/item">
                    <SidebarMenuButton
                      onClick={() => handleOpenProject(session.id)}
                    >
                      <span className="truncate text-sm">{session.name}</span>
                    </SidebarMenuButton>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <SidebarMenuAction
                          className="opacity-0 group-hover/item:opacity-100 transition-opacity"
                          showOnHover
                        >
                          <MenuDots size={16} />
                        </SidebarMenuAction>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="right" align="start" className="w-40">
                        <DropdownMenuItem onClick={() => handleToggleFavorite(session.id)}>
                          <Star size={16} className="mr-2" />
                          Unfavorite
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(session.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <TrashBinMinimalistic size={16} className="mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Recent Section - hidden when collapsed */}
        {recent.length > 0 && (
          <SidebarGroup className="group-data-[collapsible=icon]:hidden">
            <SidebarGroupLabel className="text-xs text-muted-foreground px-2">
              Recent
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {recent.map((session) => (
                  <SidebarMenuItem key={session.id} className="group/item">
                    <SidebarMenuButton
                      onClick={() => handleOpenProject(session.id)}
                    >
                      <span className="truncate text-sm">{session.name}</span>
                    </SidebarMenuButton>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <SidebarMenuAction
                          className="opacity-0 group-hover/item:opacity-100 transition-opacity"
                          showOnHover
                        >
                          <MenuDots size={16} />
                        </SidebarMenuAction>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="right" align="start" className="w-40">
                        <DropdownMenuItem onClick={() => handleToggleFavorite(session.id)}>
                          <Star size={16} className="mr-2" />
                          Favorite
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(session.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <TrashBinMinimalistic size={16} className="mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <div className="group-data-[collapsible=icon]:hidden">
          <TrialBanner />
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <AuthSettings
              trigger={
                <SidebarMenuButton tooltip="Connect Provider">
                  <PlugCircle size={16} />
                  <span>Connect Provider</span>
                </SidebarMenuButton>
              }
            />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={location.pathname === "/settings"}
              tooltip="Settings"
            >
              <Link to="/settings">
                <Settings size={16} />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
