import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { polar, checkout, portal, webhooks } from "@polar-sh/better-auth";
import { Polar } from "@polar-sh/sdk";
import { db } from "@/db";
import * as schema from "@/db/schema";

// Initialize Polar SDK
const polarClient = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
  server: process.env.POLAR_ENVIRONMENT === "sandbox" ? "sandbox" : "production",
});

export const auth = betterAuth({
  // Use environment variable for base URL
  baseURL: process.env.BETTER_AUTH_URL,

  // Social providers
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },

  // Email + password authentication
  emailAndPassword: {
    enabled: true,
  },

  // Session configuration with cookie caching for performance
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes cache
    },
  },

  // Database - Drizzle with PostgreSQL
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),

  plugins: [
    polar({
      client: polarClient,
      // Automatically create Polar customer on signup
      createCustomerOnSignUp: true,
      use: [
        // Enable checkout for purchases
        checkout({
          products: [
            {
              productId: process.env.NEXT_PUBLIC_POLAR_PRODUCT_ID!,
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
    nextCookies(), // Must be last plugin for server action cookie handling
  ],
});

export type Session = typeof auth.$Infer.Session;
