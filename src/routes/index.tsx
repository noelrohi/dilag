import { createFileRoute } from "@tanstack/react-router";
import { SessionSidebar } from "@/components/blocks/session-sidebar";
import { ChatView } from "@/components/blocks/chat-view";
import { AuthSettings } from "@/components/blocks/auth-settings";
import { DesignPreview } from "@/components/blocks/design-preview";
import { SidebarInset, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const { open } = useSidebar();

  return (
    <>
      <SessionSidebar />
      <SidebarInset className="h-dvh overflow-hidden">
        {/* Toolbar */}
        <header className="flex h-12 shrink-0 items-center justify-between px-3 border-b">
          {/* Left side - sidebar trigger when collapsed */}
          <div className="flex items-center gap-2">
            {!open && <SidebarTrigger />}
          </div>

          {/* Right side - settings */}
          <div>
            <AuthSettings />
          </div>
        </header>

        {/* Main content - split pane layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Chat panel - fixed width */}
          <div className="w-[360px] shrink-0 border-r overflow-hidden">
            <ChatView />
          </div>

          {/* Design preview panel - fills remaining space */}
          <div className="flex-1">
            <DesignPreview />
          </div>
        </div>
      </SidebarInset>
    </>
  );
}
