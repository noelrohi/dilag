import { createFileRoute } from "@tanstack/react-router";
import { SessionSidebar } from "@/components/blocks/session-sidebar";
import { ChatView } from "@/components/blocks/chat-view";
import { AuthSettings } from "@/components/blocks/auth-settings";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <>
      <SessionSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-4" />
          <h1 className="text-sm font-medium">dilag</h1>
          <div className="ml-auto">
            <AuthSettings />
          </div>
        </header>
        <ChatView />
      </SidebarInset>
    </>
  );
}
