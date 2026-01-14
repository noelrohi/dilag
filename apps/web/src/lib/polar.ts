import { Polar } from "@polar-sh/sdk";

export const polar = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
  server: process.env.POLAR_ENVIRONMENT === "sandbox" ? "sandbox" : "production",
});

export const TRIAL_DAYS = 7;

export interface LicenseKey {
  id: string;
  key: string;
  displayKey: string;
  status: string;
}

interface CustomerState {
  activeSubscriptions: Array<{ id: string; status: string }>;
  grantedBenefits: Array<{
    id: string;
    benefitId: string;
    benefitType: string;
    properties: Record<string, unknown>;
  }>;
}

/**
 * Get Polar customer by email
 */
async function getCustomerByEmail(email: string) {
  const customers = await polar.customers.list({
    query: email,
  });
  return customers.result.items.find((c) => c.email === email) ?? null;
}

/**
 * Get customer state with subscriptions and benefits (single API call)
 */
async function getCustomerState(customerId: string): Promise<CustomerState | null> {
  try {
    const state = await polar.customers.getState({ id: customerId });
    return state as unknown as CustomerState;
  } catch {
    return null;
  }
}

/**
 * Get full customer state by email (combines customer lookup + state)
 */
export async function getCustomerStateByEmail(email: string): Promise<CustomerState | null> {
  const customer = await getCustomerByEmail(email);
  if (!customer) return null;
  return getCustomerState(customer.id);
}

/**
 * Check if user has completed onboarding (has active subscription or granted benefits)
 */
export async function hasCompletedOnboarding(email: string): Promise<boolean> {
  try {
    const state = await getCustomerStateByEmail(email);
    if (!state) return false;

    // Has active subscriptions (including trials)
    if (state.activeSubscriptions?.length > 0) {
      return true;
    }

    // Has granted benefits (lifetime purchases grant benefits)
    if (state.grantedBenefits?.length > 0) {
      return true;
    }

    return false;
  } catch (error) {
    console.error("Failed to check onboarding status:", error);
    return false;
  }
}

/**
 * Get license keys for a user by email using benefit IDs from granted benefits
 */
export async function getLicenseKeysForUser(email: string): Promise<LicenseKey[]> {
  try {
    const state = await getCustomerStateByEmail(email);
    if (!state) return [];

    // Get license key benefit IDs from granted benefits
    const licenseKeyBenefitIds = state.grantedBenefits
      ?.filter((b) => b.benefitType === "license_keys")
      .map((b) => b.benefitId) ?? [];

    if (licenseKeyBenefitIds.length === 0) return [];

    // Fetch actual license keys using benefit IDs
    const allKeys: LicenseKey[] = [];
    for (const benefitId of licenseKeyBenefitIds) {
      const keys = await polar.licenseKeys.list({ benefitId });
      // Filter by customer email since benefit might have keys for multiple customers
      const customerKeys = keys.result.items
        .filter((lk) => lk.customer?.email === email)
        .map((lk) => ({
          id: lk.id,
          key: lk.key,
          displayKey: lk.displayKey,
          status: lk.status,
        }));
      allKeys.push(...customerKeys);
    }

    return allKeys;
  } catch (error) {
    console.error("Failed to fetch license keys:", error);
    return [];
  }
}
