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

/**
 * Get license keys for a user by email (server-side only)
 */
export async function getLicenseKeysForUser(email: string): Promise<LicenseKey[]> {
  try {
    // Find Polar customer by email
    const customers = await polar.customers.list({
      query: email,
    });

    const customer = customers.result.items.find((c) => c.email === email);

    if (!customer) {
      return [];
    }

    // Get all license keys and filter by customer
    const licenseKeys = await polar.licenseKeys.list({
      limit: 100,
    });

    return licenseKeys.result.items
      .filter((lk) => lk.customerId === customer.id)
      .map((lk) => ({
        id: lk.id,
        key: lk.key,
        displayKey: lk.displayKey,
        status: lk.status,
      }));
  } catch (error) {
    console.error("Failed to fetch license keys:", error);
    return [];
  }
}
