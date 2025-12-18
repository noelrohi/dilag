import { createContext, useContext, useEffect, useCallback, type ReactNode } from "react";
import { listen } from "@tauri-apps/api/event";
import { useNavigate } from "@tanstack/react-router";
import { useSessions } from "@/hooks/use-sessions";
import { useUpdater } from "@/hooks/use-updater";

type MenuEventHandler = {
  toggleSidebar: () => void;
  toggleChat: () => void;
};

const MenuEventsContext = createContext<MenuEventHandler | null>(null);

// Custom hook to expose menu event handlers for components that need to respond to menu events
export function useMenuEvents() {
  const context = useContext(MenuEventsContext);
  if (!context) {
    throw new Error("useMenuEvents must be used within a MenuEventsProvider");
  }
  return context;
}

// Store for chat toggle callback (set by StudioPage)
let chatToggleCallback: (() => void) | null = null;

export function registerChatToggle(callback: () => void) {
  chatToggleCallback = callback;
}

export function unregisterChatToggle() {
  chatToggleCallback = null;
}

// Store for sidebar toggle callback (set by pages with sidebar)
let sidebarToggleCallback: (() => void) | null = null;

export function registerSidebarToggle(callback: () => void) {
  sidebarToggleCallback = callback;
}

export function unregisterSidebarToggle() {
  sidebarToggleCallback = null;
}

export function MenuEventsProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { createSession } = useSessions();
  const { checkForUpdates } = useUpdater();

  const toggleSidebar = useCallback(() => {
    if (sidebarToggleCallback) {
      sidebarToggleCallback();
    }
  }, []);

  const toggleChat = useCallback(() => {
    if (chatToggleCallback) {
      chatToggleCallback();
    }
  }, []);

  useEffect(() => {
    const unlisten = listen<string>("menu-event", (event) => {
      const eventId = event.payload;

      switch (eventId) {
        case "settings":
          navigate({ to: "/settings" });
          break;
        case "new-session":
          createSession().then((sessionId) => {
            if (sessionId) {
              navigate({ to: "/studio/$sessionId", params: { sessionId } });
            }
          });
          break;
        case "toggle-sidebar":
          toggleSidebar();
          break;
        case "toggle-chat":
          toggleChat();
          break;
        case "check-updates":
          checkForUpdates();
          break;
        default:
          console.log("Unknown menu event:", eventId);
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [navigate, createSession, toggleSidebar, toggleChat, checkForUpdates]);

  const value = {
    toggleSidebar,
    toggleChat,
  };

  return (
    <MenuEventsContext.Provider value={value}>
      {children}
    </MenuEventsContext.Provider>
  );
}
