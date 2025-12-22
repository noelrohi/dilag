import { Link, useLocation } from "@tanstack/react-router";
import { House, FolderSimple, Gear, Plug, CaretLeft, CaretRight } from "@phosphor-icons/react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupContent,
  useSidebar,
} from "@/components/ui/sidebar";
import { DilagLogo } from "@/components/ui/dilag-logo";
import { AuthSettings } from "@/components/blocks/auth-settings";
import { TrialBanner } from "@/components/blocks/trial-banner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const navItems = [
  { to: "/", icon: House, label: "Home" },
  { to: "/projects", icon: FolderSimple, label: "Projects" },
] as const;

export function AppSidebar() {
  const location = useLocation();
  const { toggleSidebar, state } = useSidebar();

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
            {state === "expanded" ? (
              <CaretLeft className="size-3" />
            ) : (
              <CaretRight className="size-3" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">
          {state === "expanded" ? "Collapse" : "Expand"}
        </TooltipContent>
      </Tooltip>

      <SidebarHeader className="h-[38px] flex flex-row items-center gap-2 px-3">
        <DilagLogo className="size-5" />
        <span className="font-semibold text-sm group-data-[collapsible=icon]:hidden">
          Dilag
        </span>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive =
                  item.to === "/"
                    ? location.pathname === "/"
                    : location.pathname.startsWith(item.to);

                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                      <Link to={item.to}>
                        <item.icon className="size-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
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
