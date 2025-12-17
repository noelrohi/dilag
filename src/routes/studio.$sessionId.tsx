import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/studio/$sessionId")({
  // Component is loaded from studio.$sessionId.lazy.tsx
});
