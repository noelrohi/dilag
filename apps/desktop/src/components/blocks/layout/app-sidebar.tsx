import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { MagicStick, Settings, PlugCircle, Star, AddSquare, MenuDots, TrashBinMinimalistic, SortVertical, CheckCircle } from "@solar-icons/react";
import { Sidebar, SidebarContent, SidebarHeader, SidebarFooter, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarMenuAction, SidebarGroup, SidebarGroupLabel, SidebarGroupContent } from "@dilag/ui/sidebar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@dilag/ui/dropdown-menu";
import { AuthSettings } from "@/components/blocks/auth/auth-settings";
import { TrialBanner } from "@/components/blocks/auth/trial-banner";
import { useSessions } from "@/hooks/use-sessions";

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) return "now";
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w`;
  return `${Math.floor(diffDays / 30)}mo`;
}

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { sessions, deleteSession, toggleFavorite } = useSessions();

  // Filter state
  const [sortBy, setSortBy] = useState<"created" | "updated">("updated");
  const [showFilter, setShowFilter] = useState<"all" | "starred">("all");

  // Derive favorites and recent sessions based on filter state
  const { favorites, recent } = useMemo(() => {
    // Sort by selected field (updated_at falls back to created_at for older sessions)
    const getTimestamp = (s: typeof sessions[0]) => {
      if (sortBy === "updated") {
        return new Date(s.updated_at ?? s.created_at).getTime();
      }
      return new Date(s.created_at).getTime();
    };
    
    const sorted = [...sessions].sort((a, b) => getTimestamp(b) - getTimestamp(a));
    
    // When showing starred only, put all favorites in "recent" section (no separate favorites section)
    if (showFilter === "starred") {
      return { favorites: [], recent: sorted.filter((s) => s.favorite).slice(0, 100) };
    }
    
    // Default: favorites section + non-favorites in recent
    const favs = sorted.filter((s) => s.favorite);
    const nonFavs = sorted.filter((s) => !s.favorite).slice(0, 100);
    return { favorites: favs, recent: nonFavs };
  }, [sessions, sortBy, showFilter]);

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
                  isActive={location.pathname === "/skills"}
                  tooltip="Skills"
                >
                  <Link to="/skills">
                    <MagicStick size={16} />
                    <span>Skills</span>
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

        {/* Projects Section - hidden when collapsed */}
        {recent.length > 0 && (
          <SidebarGroup className="group-data-[collapsible=icon]:hidden min-h-0 flex-1">
            <SidebarGroupLabel className="text-xs text-muted-foreground px-2 flex items-center justify-between">
              <span>Projects</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-0.5 rounded hover:bg-sidebar-accent transition-colors">
                    <SortVertical size={14} className="text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="left" align="start" className="w-44">
                  <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                    Sort by
                  </DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => setSortBy("created")} className="flex items-center justify-between">
                    <span>Created</span>
                    {sortBy === "created" && <CheckCircle size={14} className="text-primary" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy("updated")} className="flex items-center justify-between">
                    <span>Updated</span>
                    {sortBy === "updated" && <CheckCircle size={14} className="text-primary" />}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                    Show
                  </DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => setShowFilter("all")} className="flex items-center justify-between">
                    <span>All</span>
                    {showFilter === "all" && <CheckCircle size={14} className="text-primary" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowFilter("starred")} className="flex items-center justify-between">
                    <span>Starred</span>
                    {showFilter === "starred" && <CheckCircle size={14} className="text-primary" />}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarGroupLabel>
            <SidebarGroupContent className="overflow-y-auto">
              <SidebarMenu>
                {recent.map((session) => (
                  <SidebarMenuItem key={session.id} className="group/item">
                    <SidebarMenuButton
                      onClick={() => handleOpenProject(session.id)}
                    >
                      <span className="truncate text-sm">{session.name}</span>
                    </SidebarMenuButton>
                    <span className="absolute right-2 top-1.5 text-xs text-muted-foreground group-hover/item:opacity-0 transition-opacity pointer-events-none">
                      {formatRelativeTime(sortBy === "updated" ? (session.updated_at ?? session.created_at) : session.created_at)}
                    </span>
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

      <SidebarFooter className="relative">
        {/* Blur gradient overlay for smooth scroll transition */}
        <div className="absolute -top-6 left-0 right-0 h-6 bg-gradient-to-t from-sidebar to-transparent pointer-events-none" />
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
