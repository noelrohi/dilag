import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { polar, checkout, portal, webhooks } from "@polar-sh/better-auth";
import { Polar } from "@polar-sh/sdk";

// Initialize Polar SDK
const polarClient = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
  server: process.env.POLAR_ENVIRONMENT === "sandbox" ? "sandbox" : "production",
});

export const auth = betterAuth({
  // Use environment variable for base URL
  baseURL: process.env.BETTER_AUTH_URL,
  
  // Email + password authentication
  emailAndPassword: {
    enabled: true,
  },

  // Database - using file-based for now, can switch to proper DB later
  database: {
    provider: "sqlite",
    url: "./data/auth.db",
  },

  plugins: [
    nextCookies(), // For server action cookie handling
    polar({
      client: polarClient,
      // Automatically create Polar customer on signup
      createCustomerOnSignUp: true,
      use: [
        // Enable checkout for purchases
        checkout({
          products: [
            {
              productId: process.env.POLAR_PRODUCT_ID!,
              slug: "pro",
            },
          ],
          successUrl: "/success?checkout_id={CHECKOUT_ID}",
          authenticatedUsersOnly: false,
        }),
        // Enable customer portal
        portal(),
        // Handle webhooks
        webhooks({
          secret: process.env.POLAR_WEBHOOK_SECRET!,
          onOrderPaid: async (payload) => {
            console.log("Order paid:", payload.data.id);
          },
          onSubscriptionActive: async (payload) => {
            console.log("Subscription active:", payload.data.id);
          },
        }),
      ],
    }),
  ],
});

export type Session = typeof auth.$Infer.Session;
