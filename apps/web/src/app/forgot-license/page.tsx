import { SiteHeader } from "@/components/site-header";
import { Button } from "@dilag/ui/button";
import Link from "next/link";
import { Key, ArrowRight } from "lucide-react";

export default function ForgotLicensePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-background" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute inset-0 grain" />
      </div>

      <SiteHeader />

      <main className="min-h-[calc(100vh-96px)] px-6 py-16 flex items-center justify-center">
        <div className="max-w-xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-6">
            <Key className="w-8 h-8 text-primary" />
          </div>

          <h1 className="text-3xl font-bold tracking-tight mb-4">
            Forgot your license key?
          </h1>

          <p className="text-lg text-muted-foreground mb-8">
            Sign in to your dashboard to view and manage your license key.
          </p>

          <Button size="lg" className="gap-2" asChild>
            <Link href="/dashboard">
              Go to Dashboard
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>

          <p className="text-sm text-muted-foreground mt-8">
            Don't have an account?{" "}
            <Link href="/sign-up" className="text-primary hover:underline">
              Sign up
            </Link>{" "}
            to get started.
          </p>
        </div>
      </main>
    </div>
  );
}
