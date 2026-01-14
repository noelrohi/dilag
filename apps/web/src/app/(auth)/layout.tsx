import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { DilagLogo } from "@/components/dilag-logo";
import { auth } from "@/lib/auth";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Redirect authenticated users to dashboard
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session?.user) {
    redirect("/dashboard");
  }
  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] relative overflow-hidden bg-background">
        {/* Background effects */}
        <div className="absolute inset-0">
          {/* Gradient mesh */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-background to-accent/5" />
          
          {/* Floating orbs */}
          <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[100px] animate-float" />
          <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] bg-primary/8 rounded-full blur-[80px] animate-float-delayed" />
          
          {/* Grid pattern */}
          <div className="absolute inset-0 grid-pattern opacity-50" />
          
          {/* Grain texture */}
          <div className="absolute inset-0 grain" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full">
          {/* Back to home */}
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Link>

          {/* Central visual */}
          <div className="flex-1 flex items-center justify-center">
            <div className="relative animate-slide-up delay-200">
              {/* Large decorative logo */}
              <div className="relative">
                <DilagLogo className="w-48 h-48 xl:w-56 xl:h-56 opacity-90" />
                {/* Glow behind logo */}
                <div className="absolute inset-0 bg-primary/20 blur-3xl scale-150 animate-glow-pulse" />
              </div>
            </div>
          </div>

          {/* Tagline */}
          <div className="space-y-4 animate-slide-up delay-300">
            <h1 className="text-4xl xl:text-5xl font-bold tracking-tight leading-tight">
              Design apps
              <br />
              <span className="text-gradient">with natural language</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-md">
              Describe your idea and watch beautiful mobile and web UI designs come to life.
            </p>
          </div>
        </div>
      </div>

      {/* Right Panel - Auth Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-card/50">
        {children}
      </div>
    </div>
  );
}
