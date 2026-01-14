import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getLicenseKeysForUser, type LicenseKey } from "@/lib/polar";
import { headers } from "next/headers";

export interface LicenseKeyResponse {
  keys: LicenseKey[];
}

/**
 * GET /api/license-keys - Get license keys for authenticated user
 */
export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const keys = await getLicenseKeysForUser(session.user.email);
    return NextResponse.json<LicenseKeyResponse>({ keys });
  } catch (error) {
    console.error("Failed to fetch license keys:", error);
    return NextResponse.json(
      { error: "Failed to fetch license keys" },
      { status: 500 }
    );
  }
}
