import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getLicenseKeysForUser } from "@/lib/polar";
import { SuccessContent } from "./success-content";

interface PageProps {
  searchParams: Promise<{ from?: string }>;
}

export default async function SuccessPage({ searchParams }: PageProps) {
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

  // Fetch license keys
  const licenseKeys = await getLicenseKeysForUser(session.user.email);
  const licenseKey = licenseKeys[0] ?? null;

  return (
    <SuccessContent
      user={{
        name: session.user.name ?? "",
        email: session.user.email,
        image: session.user.image,
      }}
      licenseKey={licenseKey}
      isFromDesktop={isFromDesktop}
    />
  );
}
