// drizzle.config.ts
import { defineConfig } from "drizzle-kit"

// In Docker, DATABASE_URL is set via environment. Locally, load from .env.
try { require("dotenv").config() } catch { /* dotenv is a devDependency */ }

function buildConnectionString(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  const password = process.env.POSTGRES_PASSWORD
  if (!password) {
    throw new Error("Set either DATABASE_URL or POSTGRES_PASSWORD")
  }
  const user = process.env.POSTGRES_USER ?? "postgres"
  const host = process.env.POSTGRES_HOST ?? "localhost"
  const port = process.env.POSTGRES_PORT ?? "5432"
  const name = process.env.POSTGRES_DB ?? "tracker_tracker"
  return `postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/${name}`
}

const databaseUrl = buildConnectionString()

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
})
