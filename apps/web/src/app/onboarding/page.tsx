import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getLicenseKeysForUser } from "@/lib/polar";
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

  // Check if user already has a license key
  const licenseKeys = await getLicenseKeysForUser(session.user.email);
  if (licenseKeys.length > 0) {
    redirect(isFromDesktop ? "/success?from=desktop" : "/success");
  }

  return (
    <OnboardingForm
      userName={session.user.name ?? ""}
      isFromDesktop={isFromDesktop}
    />
  );
}
