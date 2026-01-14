"use client";

import Link from "next/link";
import { Button } from "@dilag/ui";
import { Badge } from "@dilag/ui";
import { SiteHeader } from "@/components/site-header";
import { useSession, authClient } from "@/lib/auth-client";
import { Check, Sparkle, Lightning, Clock } from "@phosphor-icons/react";

export default function PricingPage() {
  const { data: session } = useSession();

  const handleMonthlyCheckout = async () => {
    if (!session) {
      // Redirect to sign up for non-authenticated users
      window.location.href = "/sign-up";
      return;
    }
    await authClient.checkout({ slug: "pro-monthly" });
  };

  const handleLifetimeCheckout = async () => {
    if (!session) {
      // Redirect to sign up for non-authenticated users
      window.location.href = "/sign-up";
      return;
    }
    await authClient.checkout({ slug: "pro-lifetime" });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-background" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute inset-0 grain" />
      </div>

      <SiteHeader user={session?.user} />

      <main className="max-w-4xl mx-auto px-6 pt-28 pb-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight mb-4">Simple pricing</h1>
          <p className="text-lg text-muted-foreground max-w-md mx-auto">
            Start with a free trial, then choose the plan that works for you.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
          {/* Pro Monthly */}
          <div className="relative flex flex-col p-8 rounded-2xl border-2 border-primary bg-primary/5">
            <Badge className="absolute -top-3 left-6 gap-1">
              <Sparkle weight="fill" className="w-3 h-3" />
              Recommended
            </Badge>

            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-1">Pro Monthly</h2>
              <p className="text-sm text-muted-foreground">
                Full access with 7-day free trial
              </p>
            </div>

            <div className="mb-2">
              <span className="text-5xl font-bold">$9</span>
              <span className="text-muted-foreground ml-2">/month</span>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-emerald-500 mb-8">
              <Clock weight="bold" className="w-4 h-4" />
              <span>7-day free trial included</span>
            </div>

            <ul className="space-y-3 mb-8 flex-1">
              {[
                "7-day free trial",
                "Unlimited design generations",
                "All export formats",
                "Priority support",
                "Cancel anytime",
              ].map((feature) => (
                <li key={feature} className="flex items-center gap-3 text-sm">
                  <Check weight="bold" className="w-4 h-4 text-primary shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <Button className="w-full gap-2" onClick={handleMonthlyCheckout}>
              <Sparkle weight="fill" className="w-4 h-4" />
              Start Free Trial
            </Button>
          </div>

          {/* Pro Lifetime */}
          <div className="flex flex-col p-8 rounded-2xl border border-border bg-card/50">
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-1">Pro Lifetime</h2>
              <p className="text-sm text-muted-foreground">
                One-time purchase, own forever
              </p>
            </div>

            <div className="mb-2">
              <span className="text-5xl font-bold">$29</span>
              <span className="text-muted-foreground ml-2">one-time</span>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
              <Lightning weight="bold" className="w-4 h-4" />
              <span>Pay once, use forever</span>
            </div>

            <ul className="space-y-3 mb-8 flex-1">
              {[
                "Lifetime access",
                "Unlimited design generations",
                "All export formats",
                "Priority support",
                "All future updates",
              ].map((feature) => (
                <li key={feature} className="flex items-center gap-3 text-sm">
                  <Check weight="bold" className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">{feature}</span>
                </li>
              ))}
            </ul>

            <Button variant="outline" className="w-full gap-2" onClick={handleLifetimeCheckout}>
              <Lightning weight="fill" className="w-4 h-4" />
              Buy Lifetime License
            </Button>
          </div>
        </div>

        {/* FAQ link */}
        <div className="text-center mt-12">
          <p className="text-sm text-muted-foreground">
            Have questions?{" "}
            <Link 
              href="/faq" 
              className="text-primary hover:text-primary/80 font-medium transition-colors"
            >
              Check our FAQ
            </Link>
          </p>
        </div>

        {/* Footer note */}
        <p className="text-center text-sm text-muted-foreground mt-4">
          Secure payment via Polar. Cancel anytime during trial.
        </p>
      </main>
    </div>
  );
}
