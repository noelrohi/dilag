import { createFileRoute, useParams } from "@tanstack/react-router"
import { StudioPageContent } from "./studio.$sessionId"

export const Route = createFileRoute("/project/$projectId/session/$sessionId")({
  component: ProjectSessionPage,
})

function ProjectSessionPage() {
  const { projectId, sessionId } = useParams({ from: "/project/$projectId/session/$sessionId" })
  return <StudioPageContent projectId={projectId} sessionId={sessionId} />
}
