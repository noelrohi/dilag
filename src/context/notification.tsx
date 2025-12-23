import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { toast } from "sonner";
import { Howl } from "howler";
import { useAllSessionStatuses, type SessionStatus } from "@/context/session-store";
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

  // Use reactive selector hook instead of getState()
  const sessionStatuses = useAllSessionStatuses();
  const previousStatusRef = useRef<Record<string, SessionStatus>>({});

  // React to session status changes
  useEffect(() => {
    // Initialize previousStatus for all sessions on first run
    if (Object.keys(previousStatusRef.current).length === 0) {
      previousStatusRef.current = { ...sessionStatuses };
      return;
    }

    for (const [sessionId, status] of Object.entries(sessionStatuses)) {
      const previousStatus = previousStatusRef.current[sessionId];

      // Only trigger notifications when transitioning from running/busy to idle/error
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

      // Update previous status after processing
      previousStatusRef.current[sessionId] = status;
    }
  }, [sessionStatuses]);

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
