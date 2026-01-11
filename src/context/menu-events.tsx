import { createContext, useContext, useEffect, useCallback, useRef, type ReactNode } from "react";
import { listen } from "@tauri-apps/api/event";
import { useNavigate } from "@tanstack/react-router";
import { useUpdaterContext } from "@/context/updater-context";

interface MenuEventHandler {
  toggleSidebar: () => void;
  toggleChat: () => void;
  registerChatToggle: (callback: () => void) => () => void;
  registerSidebarToggle: (callback: () => void) => () => void;
}

const MenuEventsContext = createContext<MenuEventHandler | null>(null);

// Custom hook to expose menu event handlers for components that need to respond to menu events
export function useMenuEvents() {
  const context = useContext(MenuEventsContext);
  if (!context) {
    throw new Error("useMenuEvents must be used within a MenuEventsProvider");
  }
  return context;
}

export function MenuEventsProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { checkForUpdates } = useUpdaterContext();

  // Store callbacks in refs inside the provider (not module-level globals)
  const chatToggleRef = useRef<(() => void) | null>(null);
  const sidebarToggleRef = useRef<(() => void) | null>(null);

  const toggleSidebar = useCallback(() => {
    sidebarToggleRef.current?.();
  }, []);

  const toggleChat = useCallback(() => {
    chatToggleRef.current?.();
  }, []);

  // Registration functions return cleanup functions
  const registerChatToggle = useCallback((callback: () => void): (() => void) => {
    chatToggleRef.current = callback;
    return () => {
      if (chatToggleRef.current === callback) {
        chatToggleRef.current = null;
      }
    };
  }, []);

  const registerSidebarToggle = useCallback((callback: () => void): (() => void) => {
    sidebarToggleRef.current = callback;
    return () => {
      if (sidebarToggleRef.current === callback) {
        sidebarToggleRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const unlisten = listen<string>("menu-event", (event) => {
      const eventId = event.payload;

      switch (eventId) {
        case "settings":
          navigate({ to: "/settings" });
          break;
        case "new-session":
          navigate({ to: "/" });
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
  }, [navigate, toggleSidebar, toggleChat, checkForUpdates]);

  const value: MenuEventHandler = {
    toggleSidebar,
    toggleChat,
    registerChatToggle,
    registerSidebarToggle,
  };

  return (
    <MenuEventsContext.Provider value={value}>
      {children}
    </MenuEventsContext.Provider>
  );
}
