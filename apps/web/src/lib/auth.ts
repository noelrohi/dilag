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
              // Pro Monthly - $9.99/month with 7-day free trial
              productId: process.env.NEXT_PUBLIC_POLAR_MONTHLY_PRODUCT_ID!,
              slug: "pro-monthly",
            },
            {
              // Pro Lifetime - $49 one-time purchase
              productId: process.env.NEXT_PUBLIC_POLAR_LIFETIME_PRODUCT_ID!,
              slug: "pro-lifetime",
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
            const order = payload.data;
            console.log("Order paid:", order.id, "Product:", order.productId);
            
            // If lifetime purchase, cancel any active subscriptions
            const lifetimeProductId = process.env.NEXT_PUBLIC_POLAR_LIFETIME_PRODUCT_ID;
            if (order.productId === lifetimeProductId && order.customerId) {
              console.log("Lifetime purchase detected, checking for active subscriptions...");
              
              try {
                const subscriptions = await polarClient.subscriptions.list({
                  customerId: order.customerId,
                  active: true,
                });
                
                for (const sub of subscriptions.result.items) {
                  console.log("Revoking subscription:", sub.id);
                  await polarClient.subscriptions.revoke({ id: sub.id });
                }
                
                if (subscriptions.result.items.length > 0) {
                  console.log(`Canceled ${subscriptions.result.items.length} subscription(s)`);
                }
              } catch (error) {
                console.error("Failed to cancel subscriptions:", error);
              }
            }
          },
        }),
      ],
    }),
    nextCookies(), // Must be last plugin for server action cookie handling
  ],
});

export type Session = typeof auth.$Infer.Session;
