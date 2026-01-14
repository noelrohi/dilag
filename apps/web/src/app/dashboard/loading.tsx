import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@dilag/ui";

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-background">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-background" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/5 rounded-full blur-[120px]" />
      </div>

      {/* Header skeleton */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-2xl mx-auto px-6 pt-28 pb-16">
        {/* Profile section skeleton */}
        <div className="flex items-center gap-4 p-4 rounded-lg border border-border mb-10">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>

        <Separator className="mb-8" />

        {/* License section skeleton */}
        <section className="mb-12">
          <Skeleton className="h-3 w-16 mb-4" />
          <div className="p-4 rounded-lg border border-border">
            <div className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-40" />
              </div>
            </div>
          </div>
        </section>

        <Separator className="mb-8" />

        {/* Quick actions skeleton */}
        <section>
          <Skeleton className="h-3 w-24 mb-4" />
          <div className="p-4 rounded-lg border border-border">
            <div className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
