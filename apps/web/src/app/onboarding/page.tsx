import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { hasCompletedOnboarding } from "@/lib/polar";
import { OnboardingForm } from "./onboarding-form";

interface PageProps {
  searchParams: Promise<{ from?: string }>;
}

export default async function OnboardingPage({ searchParams }: PageProps) {
  const { from } = await searchParams;
  const isFromDesktop = from === "desktop";

  // Get session
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // Not authenticated - redirect to sign-up
  if (!session?.user) {
    redirect(isFromDesktop ? "/sign-up?from=desktop" : "/sign-up");
  }

  // Check if user already completed onboarding (has subscription/order in Polar)
  const isOnboarded = await hasCompletedOnboarding(session.user.email);
  
  if (isOnboarded) {
    // Desktop users go to success (triggers deep link with license key)
    if (isFromDesktop) {
      redirect("/success?from=desktop");
    }
    // Web users go to dashboard
    redirect("/dashboard");
  }

  return (
    <OnboardingForm
      userName={session.user.name ?? ""}
      isFromDesktop={isFromDesktop}
    />
  );
}
