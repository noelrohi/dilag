import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Load .env.local for Next.js projects
config({ path: ".env.local" });

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // Multi-project schema: only manage design_app_* tables
  tablesFilter: ["design_app_*"],
});
