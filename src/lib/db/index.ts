// src/lib/db/index.ts
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema"

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required")
}

// Reuse the Postgres connection across HMR reloads in development
const g = globalThis as typeof globalThis & { __dbClient?: ReturnType<typeof postgres> }
const client = g.__dbClient ?? postgres(connectionString)
if (process.env.NODE_ENV !== "production") {
  g.__dbClient = client
}

export const db = drizzle(client, { schema })
