import { useCallback } from "react";
import {
  usePendingPermissions,
  useCurrentSessionId,
  useSessionStore,
  type PermissionRequest,
} from "@/context/session-store";
import { useSDK } from "@/context/global-events";
import {
  PermissionPrompt,
  type PermissionReply,
} from "@/components/ai-elements/permission-prompt";
import { cn } from "@/lib/utils";
import { useSessionsList } from "@/hooks/use-session-data";

// Timeout for permission reply requests (30 seconds)
const PERMISSION_REPLY_TIMEOUT = 30000;

interface PermissionListProps {
  sessionId?: string;
  className?: string;
}

export function PermissionList({ sessionId, className }: PermissionListProps) {
  const currentSessionId = useCurrentSessionId();
  const effectiveSessionId = sessionId ?? currentSessionId;
  const pendingPermissions = usePendingPermissions(effectiveSessionId);
  const sdk = useSDK();
  const { data: sessions = [] } = useSessionsList();

  // Get the session's directory (cwd) for API calls
  const getSessionDirectory = useCallback(
    (sessionID: string): string | undefined => {
      const session = sessions.find((s) => s.id === sessionID);
      return session?.cwd;
    },
    [sessions]
  );

  const handleReply = useCallback(
    async (
      request: PermissionRequest,
      reply: PermissionReply,
      message?: string
    ) => {
      const directory = getSessionDirectory(request.sessionID);
      try {
        // Create a timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error("Permission reply timeout")),
            PERMISSION_REPLY_TIMEOUT
          );
        });

        // Race between the actual reply and timeout
        await Promise.race([
          sdk.permission.reply({
            requestID: request.id,
            directory,
            reply,
            message,
          }),
          timeoutPromise,
        ]);

        // Success! Remove permission immediately instead of waiting for event
        // This prevents the UI from being stuck if the permission.replied event is lost
        if (effectiveSessionId) {
          useSessionStore.getState().removePendingPermission(effectiveSessionId, request.id);
          console.log("[PermissionList] Permission reply successful, removed from store");
        }
      } catch (err) {
        console.error("[PermissionList] Failed to reply to permission:", err);
        // Permission likely doesn't exist in backend anymore (stale state)
        // Or the request timed out
        // Remove it from the store to clean up the UI
        if (effectiveSessionId) {
          useSessionStore.getState().removePendingPermission(effectiveSessionId, request.id);
          // Also abort any running tools since the permission was lost
          useSessionStore.getState().abortRunningTools(effectiveSessionId);
        }
      }
    },
    [sdk, effectiveSessionId, getSessionDirectory]
  );

  if (!effectiveSessionId || pendingPermissions.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-2", className)}>
      {pendingPermissions.map((request) => (
        <PermissionPrompt
          key={request.id}
          request={request}
          onReply={(reply, message) => handleReply(request, reply, message)}
        />
      ))}
    </div>
  );
}
