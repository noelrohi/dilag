import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getLicenseKeysForUser } from "@/lib/polar";
import { DashboardContent } from "./dashboard-content";

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/sign-in");
  }

  // Fetch license keys
  const licenseKeys = await getLicenseKeysForUser(session.user.email);
  const licenseKey = licenseKeys[0] ?? null;

  return (
    <DashboardContent
      user={{
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
      }}
      licenseKey={licenseKey}
    />
  );
}
