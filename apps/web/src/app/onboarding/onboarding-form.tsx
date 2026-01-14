"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Button } from "@dilag/ui";
import { DilagLogo } from "@/components/dilag-logo";
import { Check, Lightning, Crown } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

type PlanType = "monthly" | "lifetime";

const PLANS = {
  monthly: {
    slug: "pro-monthly",
    name: "Monthly",
    price: "$9.99",
    period: "/month",
    badge: "7-day free trial",
    badgeColor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
    description: "Cancel anytime",
    icon: Lightning,
    features: [
      "Unlimited designs",
      "All export formats",
      "Priority support",
    ],
  },
  lifetime: {
    slug: "pro-lifetime",
    name: "Lifetime",
    price: "$49",
    period: "one-time",
    badge: "Best value",
    badgeColor: "bg-primary text-primary-foreground",
    description: "Pay once, own forever",
    icon: Crown,
    features: [
      "Everything in Monthly",
      "Lifetime updates",
      "No recurring fees",
    ],
  },
} as const;

interface OnboardingFormProps {
  userName: string;
  isFromDesktop: boolean;
}

export function OnboardingForm({ userName, isFromDesktop }: OnboardingFormProps) {
  const [selectedPlan, setSelectedPlan] = useState<PlanType>("monthly");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleContinue = () => {
    setError("");

    startTransition(async () => {
      try {
        // Save onboarding data
        const response = await fetch("/api/onboarding", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: userName.trim() || "User",
            plan: selectedPlan,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          setError(data.message || "Failed to save");
          return;
        }

        // Redirect to Polar checkout
        const plan = PLANS[selectedPlan];
        const baseUrl = window.location.origin;
        await authClient.checkout({
          slug: plan.slug,
          ...(isFromDesktop && {
            successUrl: `${baseUrl}/success?from=desktop&checkout_id={CHECKOUT_ID}`,
          }),
        });
      } catch (err) {
        console.error("Onboarding error:", err);
        setError("An unexpected error occurred");
      }
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Background */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary/5 rounded-full blur-[120px]" />
      </div>

      {/* Header */}
      <header className="p-6">
        <Link href="/" className="inline-flex items-center gap-2">
          <DilagLogo className="w-8 h-8" />
          <span className="font-semibold">Dilag</span>
        </Link>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-2xl">
          {/* Heading */}
          <div className="text-center mb-10">
            <h1 className="text-3xl font-semibold tracking-tight mb-2">
              Choose your plan
            </h1>
            <p className="text-muted-foreground">
              {userName ? `Welcome, ${userName.split(" ")[0]}! ` : ""}
              Select a plan to get started.
            </p>
          </div>

          {/* Plan cards */}
          <div className="grid sm:grid-cols-2 gap-4 mb-8">
            {(Object.entries(PLANS) as [PlanType, typeof PLANS[PlanType]][]).map(
              ([key, plan]) => {
                const isSelected = selectedPlan === key;
                const Icon = plan.icon;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedPlan(key)}
                    className={cn(
                      "relative flex flex-col p-6 rounded-xl border-2 text-left transition-all",
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-muted-foreground/30"
                    )}
                  >
                    {/* Badge */}
                    <span
                      className={cn(
                        "absolute -top-3 left-4 z-10 px-2.5 py-0.5 rounded-full text-xs font-medium",
                        plan.badgeColor
                      )}
                    >
                      {plan.badge}
                    </span>

                    {/* Header */}
                    <div className="flex items-center gap-3 mb-4">
                      <div
                        className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center",
                          isSelected ? "bg-primary/10" : "bg-muted"
                        )}
                      >
                        <Icon
                          weight="duotone"
                          className={cn(
                            "w-5 h-5",
                            isSelected ? "text-primary" : "text-muted-foreground"
                          )}
                        />
                      </div>
                      <div>
                        <h3 className="font-semibold">{plan.name}</h3>
                        <p className="text-xs text-muted-foreground">
                          {plan.description}
                        </p>
                      </div>
                    </div>

                    {/* Price */}
                    <div className="mb-4">
                      <span className="text-3xl font-bold">{plan.price}</span>
                      <span className="text-muted-foreground text-sm ml-1">
                        {plan.period}
                      </span>
                    </div>

                    {/* Features */}
                    <ul className="space-y-2">
                      {plan.features.map((feature) => (
                        <li
                          key={feature}
                          className="flex items-center gap-2 text-sm text-muted-foreground"
                        >
                          <Check
                            weight="bold"
                            className={cn(
                              "w-4 h-4 shrink-0",
                              isSelected ? "text-primary" : "text-muted-foreground"
                            )}
                          />
                          {feature}
                        </li>
                      ))}
                    </ul>

                    {/* Selection indicator */}
                    <div
                      className={cn(
                        "absolute top-4 right-4 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                        isSelected
                          ? "border-primary bg-primary"
                          : "border-muted-foreground/30"
                      )}
                    >
                      {isSelected && (
                        <Check weight="bold" className="w-3 h-3 text-primary-foreground" />
                      )}
                    </div>
                  </button>
                );
              }
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-center">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* CTA */}
          <div className="flex flex-col items-center gap-4">
            <Button
              onClick={handleContinue}
              disabled={isPending}
              className="w-full sm:w-auto px-8 h-11"
            >
              {isPending
                ? "Loading..."
                : selectedPlan === "monthly"
                ? "Start 7-day free trial"
                : "Get lifetime access"}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              {selectedPlan === "monthly" ? (
                <>No charge until trial ends. Cancel anytime.</>
              ) : (
                <>One-time payment. Instant access.</>
              )}
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-6 text-center">
        <p className="text-xs text-muted-foreground">
          By continuing, you agree to our{" "}
          <Link href="/terms" className="underline hover:text-foreground">
            Terms of Service
          </Link>
        </p>
      </footer>
    </div>
  );
}
