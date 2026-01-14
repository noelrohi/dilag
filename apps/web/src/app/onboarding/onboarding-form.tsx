"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import {
  Button,
  Input,
  Field,
  FieldLabel,
  FieldGroup,
  FieldError,
  FieldDescription,
} from "@dilag/ui";
import { DilagLogo } from "@/components/dilag-logo";
import { ArrowRight, CaretDown } from "@phosphor-icons/react";

const REFERRAL_OPTIONS = [
  { value: "", label: "Select an option (optional)" },
  { value: "twitter", label: "Twitter/X" },
  { value: "youtube", label: "YouTube" },
  { value: "google", label: "Google Search" },
  { value: "github", label: "GitHub" },
  { value: "friend", label: "Friend or colleague" },
  { value: "reddit", label: "Reddit" },
  { value: "hackernews", label: "Hacker News" },
  { value: "producthunt", label: "Product Hunt" },
  { value: "other", label: "Other" },
];

interface OnboardingFormProps {
  userName: string;
  isFromDesktop: boolean;
}

export function OnboardingForm({ userName, isFromDesktop }: OnboardingFormProps) {
  const [name, setName] = useState("");
  const [referralSource, setReferralSource] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const displayName = name || userName;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!displayName.trim()) {
      setError("Please enter your name");
      return;
    }

    startTransition(async () => {
      try {
        // Save onboarding data
        const response = await fetch("/api/onboarding", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: displayName.trim(),
            referralSource: referralSource || undefined,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.message || "Failed to save");
          return;
        }

        // Redirect to Polar checkout
        const baseUrl = window.location.origin;
        await authClient.checkout({
          slug: "pro-monthly",
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
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] relative overflow-hidden bg-background">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-background to-accent/5" />
          <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[100px] animate-float" />
          <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] bg-primary/8 rounded-full blur-[80px] animate-float-delayed" />
          <div className="absolute inset-0 grid-pattern opacity-50" />
          <div className="absolute inset-0 grain" />
        </div>

        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full">
          <Link href="/" className="inline-flex items-center gap-2">
            <DilagLogo className="w-8 h-8" />
            <span className="text-lg font-semibold">Dilag</span>
          </Link>

          <div className="flex-1 flex items-center justify-center">
            <div className="relative animate-slide-up delay-200">
              <div className="relative">
                <DilagLogo className="w-48 h-48 xl:w-56 xl:h-56 opacity-90" />
                <div className="absolute inset-0 bg-primary/20 blur-3xl scale-150 animate-glow-pulse" />
              </div>
            </div>
          </div>

          <div className="space-y-4 animate-slide-up delay-300">
            <h1 className="text-4xl xl:text-5xl font-bold tracking-tight leading-tight">
              Almost there!
              <br />
              <span className="text-gradient">Just a few details</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-md">
              Help us personalize your experience and get started with your free trial.
            </p>
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-card/50">
        <div className="w-full max-w-sm space-y-8 animate-slide-in-right">
          <div className="lg:hidden flex justify-center">
            <Link href="/" className="inline-flex items-center gap-3">
              <DilagLogo className="w-10 h-10" />
            </Link>
          </div>

          <div className="text-center lg:text-left">
            <h2 className="text-2xl font-semibold tracking-tight">Complete your profile</h2>
            <p className="mt-2 text-muted-foreground">
              Start your 7-day free trial
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <FieldGroup className="gap-5">
              {error && <FieldError>{error}</FieldError>}

              <Field>
                <FieldLabel htmlFor="name">Full name</FieldLabel>
                <Input
                  id="name"
                  type="text"
                  value={displayName}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Your name"
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="referral">Where did you hear about us?</FieldLabel>
                <div className="relative">
                  <select
                    id="referral"
                    value={referralSource}
                    onChange={(e) => setReferralSource(e.target.value)}
                    className="w-full h-10 px-3 pr-10 rounded-md border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 appearance-none cursor-pointer"
                  >
                    {REFERRAL_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <CaretDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
                <FieldDescription>Optional</FieldDescription>
              </Field>

              <Button
                type="submit"
                disabled={isPending}
                className="w-full h-11 gap-2"
              >
                {isPending ? (
                  "Starting trial..."
                ) : (
                  <>
                    Start free trial
                    <ArrowRight weight="bold" className="w-4 h-4" />
                  </>
                )}
              </Button>
            </FieldGroup>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            By continuing, you agree to our{" "}
            <Link
              href="/terms"
              className="text-primary hover:text-primary/80 font-medium transition-colors"
            >
              Terms of Service
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
