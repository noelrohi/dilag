import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">Welcome to your web app</h1>
        <p className="text-muted-foreground">
          This is a placeholder. The AI will generate your screens here.
        </p>
      </div>
    </div>
  );
}
