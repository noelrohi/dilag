import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { user } from "@/db/schema";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";

interface OnboardingRequest {
  name: string;
  referralSource?: string;
}

/**
 * POST /api/onboarding - Complete user onboarding
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = (await request.json()) as OnboardingRequest;
    const { name, referralSource } = body;

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, message: "Name is required" },
        { status: 400 }
      );
    }

    // Update user with onboarding data
    await db
      .update(user)
      .set({
        name: name.trim(),
        referralSource: referralSource || null,
        onboardingCompleted: true,
        updatedAt: new Date(),
      })
      .where(eq(user.id, session.user.id));

    return NextResponse.json({
      success: true,
      message: "Onboarding completed",
    });
  } catch (error) {
    console.error("Onboarding error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to complete onboarding" },
      { status: 500 }
    );
  }
}
