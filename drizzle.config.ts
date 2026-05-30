import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Load local env vars so `drizzle-kit` commands can read DATABASE_URL.
config({ path: ".env.local" });

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
