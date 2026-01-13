import { NextRequest, NextResponse } from "next/server";
import { polar, TRIAL_DAYS } from "@/lib/polar";
import type {
  TrialRegisterRequest,
  TrialRegisterResponse,
  TrialCheckRequest,
  TrialCheckResponse,
} from "@dilag/shared";

const ORG_ID = process.env.POLAR_ORG_ID!;

/**
 * POST /api/trial - Register or check a device trial
 * 
 * Body: { device_id: string }
 * 
 * Flow:
 * 1. Check if customer with external_id=device_id exists
 * 2. If exists, return existing trial info
 * 3. If not, create customer with trial_start_utc in metadata
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as TrialRegisterRequest;
    const { device_id } = body;

    if (!device_id) {
      return NextResponse.json(
        { allowed: false, message: "device_id is required" },
        { status: 400 }
      );
    }

    // Check if customer already exists with this device_id
    const existingCustomers = await polar.customers.list({
      organizationId: ORG_ID,
      query: device_id, // Search by external_id
    });

    const existingCustomer = existingCustomers.result.items.find(
      (c) => c.externalId === device_id
    );

    if (existingCustomer) {
      // Customer exists - check trial status
      const trialStartUtc = existingCustomer.metadata?.trial_start_utc as number | undefined;
      
      if (!trialStartUtc) {
        // Customer exists but no trial - shouldn't happen, but handle it
        return NextResponse.json<TrialRegisterResponse>({
          allowed: false,
          message: "Trial already used on this device",
        });
      }

      const now = Math.floor(Date.now() / 1000);
      const trialEndUtc = trialStartUtc + TRIAL_DAYS * 24 * 60 * 60;
      const daysRemaining = Math.max(0, Math.ceil((trialEndUtc - now) / (24 * 60 * 60)));
      const expired = now >= trialEndUtc;

      return NextResponse.json<TrialRegisterResponse>({
        allowed: !expired,
        trial_start_utc: trialStartUtc,
        message: expired 
          ? "Trial has expired" 
          : `Trial active, ${daysRemaining} days remaining`,
      });
    }

    // New device - create customer and start trial
    const trialStartUtc = Math.floor(Date.now() / 1000);

    await polar.customers.create({
      organizationId: ORG_ID,
      externalId: device_id,
      email: `trial-${device_id.substring(0, 8)}@dilag.noelrohi.com`,
      name: `Trial Device ${device_id.substring(0, 8)}`,
      metadata: {
        trial_start_utc: trialStartUtc,
        device_id: device_id,
      },
    });

    return NextResponse.json<TrialRegisterResponse>({
      allowed: true,
      trial_start_utc: trialStartUtc,
      message: `Trial started, ${TRIAL_DAYS} days remaining`,
    });
  } catch (error) {
    console.error("Trial registration error:", error);
    return NextResponse.json(
      { allowed: false, message: "Failed to register trial" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/trial?device_id=xxx - Check trial status
 */
export async function GET(request: NextRequest) {
  try {
    const deviceId = request.nextUrl.searchParams.get("device_id");

    if (!deviceId) {
      return NextResponse.json(
        { has_trial: false, message: "device_id is required" },
        { status: 400 }
      );
    }

    const existingCustomers = await polar.customers.list({
      organizationId: ORG_ID,
      query: deviceId,
    });

    const existingCustomer = existingCustomers.result.items.find(
      (c) => c.externalId === deviceId
    );

    if (!existingCustomer) {
      return NextResponse.json<TrialCheckResponse>({
        has_trial: false,
      });
    }

    const trialStartUtc = existingCustomer.metadata?.trial_start_utc as number | undefined;

    if (!trialStartUtc) {
      return NextResponse.json<TrialCheckResponse>({
        has_trial: false,
      });
    }

    const now = Math.floor(Date.now() / 1000);
    const trialEndUtc = trialStartUtc + TRIAL_DAYS * 24 * 60 * 60;
    const daysRemaining = Math.max(0, Math.ceil((trialEndUtc - now) / (24 * 60 * 60)));
    const expired = now >= trialEndUtc;

    return NextResponse.json<TrialCheckResponse>({
      has_trial: true,
      trial_start_utc: trialStartUtc,
      days_remaining: daysRemaining,
      expired,
    });
  } catch (error) {
    console.error("Trial check error:", error);
    return NextResponse.json(
      { has_trial: false, message: "Failed to check trial" },
      { status: 500 }
    );
  }
}
