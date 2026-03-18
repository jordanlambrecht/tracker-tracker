// src/lib/db/index.ts
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema"

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

const connectionString = buildConnectionString()

// Reuse the Postgres connection across HMR reloads in development
const g = globalThis as typeof globalThis & { __dbClient?: ReturnType<typeof postgres> }
const client =
  g.__dbClient ??
  postgres(connectionString, {
    max: 5,
    idle_timeout: 30,
    connect_timeout: 10,
  })
if (process.env.NODE_ENV !== "production") {
  g.__dbClient = client
}

export const db = drizzle(client, { schema })
