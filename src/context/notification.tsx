import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { toast } from "sonner";
import { Howl } from "howler";
import { useSessionStore, type SessionStatus } from "@/context/session-store";
import { useSessionsList } from "@/hooks/use-session-data";
import completeSound from "@/assets/audio/staplebops-01.aac";
import errorSound from "@/assets/audio/nope-03.aac";

// Pre-load audio with Howler
const completionAudio = new Howl({ src: [completeSound], volume: 0.5 });
const errorAudio = new Howl({ src: [errorSound], volume: 0.5 });

interface NotificationContextValue {
  playComplete: () => void;
  playError: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotification must be used within NotificationProvider");
  }
  return context;
}

interface NotificationProviderProps {
  children: ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const { data: sessions = [] } = useSessionsList();
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;
  const previousStatusRef = useRef<Record<string, SessionStatus>>({});

  // Subscribe to session status changes
  useEffect(() => {
    // Initialize with current state
    const initialState = useSessionStore.getState();
    for (const [sessionId, status] of Object.entries(initialState.sessionStatus)) {
      if (!previousStatusRef.current[sessionId]) {
        previousStatusRef.current[sessionId] = status;
      }
    }

    const unsubscribe = useSessionStore.subscribe((state) => {
      const currentStatuses = state.sessionStatus;

      for (const [sessionId, status] of Object.entries(currentStatuses)) {
        const previousStatus = previousStatusRef.current[sessionId];

        if (previousStatus === "running" || previousStatus === "busy") {
          const session = sessionsRef.current.find((s) => s.id === sessionId);
          const sessionName = session?.name ?? "Session";

          if (status === "idle") {
            completionAudio.play();
            toast.success("Session Complete", {
              description: `${sessionName} has finished`,
            });
          } else if (status === "error") {
            errorAudio.play();
            toast.error("Session Error", {
              description: `${sessionName} encountered an error`,
            });
          }
        }

        previousStatusRef.current[sessionId] = status;
      }
    });

    return () => unsubscribe();
  }, []);

  const value: NotificationContextValue = {
    playComplete: () => completionAudio.play(),
    playError: () => errorAudio.play(),
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}
