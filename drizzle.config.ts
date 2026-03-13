// drizzle.config.ts
import { defineConfig } from "drizzle-kit"

// In Docker, DATABASE_URL is set via environment. Locally, load from .env.local.
try { require("dotenv").config({ path: ".env.local" }) } catch { /* dotenv is a devDependency */ }

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is required")
}

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
})
