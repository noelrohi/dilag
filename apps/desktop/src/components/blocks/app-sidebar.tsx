import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { FolderSimple, Gear, Plug, CaretLeft, CaretRight, Star, Plus, DotsThree, Trash } from "@phosphor-icons/react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DilagLogo } from "@/components/ui/dilag-logo";
import { AuthSettings } from "@/components/blocks/auth-settings";
import { TrialBanner } from "@/components/blocks/trial-banner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSessions } from "@/hooks/use-sessions";

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toggleSidebar, state } = useSidebar();
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

  const isExpanded = state === "expanded";

  return (
    <Sidebar collapsible="icon" className="border-r relative">
      {/* Edge toggle button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={toggleSidebar}
            className="absolute top-1/2 -right-3 -translate-y-1/2 z-10
              size-6 rounded-full bg-sidebar border border-sidebar-border
              flex items-center justify-center shadow-sm"
          >
            {isExpanded ? (
              <CaretLeft className="size-3" />
            ) : (
              <CaretRight className="size-3" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">
          {isExpanded ? "Collapse" : "Expand"}
        </TooltipContent>
      </Tooltip>

      <SidebarHeader className="h-[38px] flex flex-row items-center gap-2 px-3">
        <DilagLogo className="size-5" />
        <span className="font-semibold text-sm group-data-[collapsible=icon]:hidden">
          Dilag
        </span>
      </SidebarHeader>

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
                  <Plus className="size-4" weight="bold" />
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
                    <FolderSimple className="size-4" />
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
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Star weight="fill" className="size-3.5 text-amber-500 shrink-0" />
                      <span className="truncate text-sm">{session.name}</span>
                    </SidebarMenuButton>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <SidebarMenuAction
                          className="opacity-0 group-hover/item:opacity-100 transition-opacity"
                          showOnHover
                        >
                          <DotsThree weight="bold" className="size-4" />
                        </SidebarMenuAction>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="right" align="start" className="w-40">
                        <DropdownMenuItem onClick={() => handleToggleFavorite(session.id)}>
                          <Star className="size-4 mr-2" />
                          Unfavorite
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(session.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash className="size-4 mr-2" />
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
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <span className="truncate text-sm">{session.name}</span>
                    </SidebarMenuButton>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <SidebarMenuAction
                          className="opacity-0 group-hover/item:opacity-100 transition-opacity"
                          showOnHover
                        >
                          <DotsThree weight="bold" className="size-4" />
                        </SidebarMenuAction>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="right" align="start" className="w-40">
                        <DropdownMenuItem onClick={() => handleToggleFavorite(session.id)}>
                          <Star className="size-4 mr-2" />
                          Favorite
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(session.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash className="size-4 mr-2" />
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
                  <Plug className="size-4" />
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
                <Gear className="size-4" />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
