// src/lib/db/index.ts
//
// The Drizzle handle, created LAZILY on first use.
//
// ── Why lazy, and why it matters ───────────────────────────────────────────
// This module used to build the connection string at module scope, so merely
// IMPORTING it threw when no database was configured. `next build` imports every
// route module to collect page data, and 102 files import this one, so a build
// with no DATABASE_URL died on whichever route Next happened to reach first —
// with a stack pointing at that arbitrary route rather than at the real cause.
// The Dockerfile worked around it by setting a throwaway DATABASE_URL purely so
// the build could evaluate modules; that workaround is no longer required.
//
// Deferring to first use also puts the failure where it belongs. A missing
// DATABASE_URL is a RUNTIME configuration error: it now surfaces inside the
// request that needed the database, where the route's own try/catch turns it
// into a logged 500, instead of taking down a build that never intended to
// connect to anything.
//
// ── Why a Proxy rather than a getDb() function ─────────────────────────────
// `db` is imported by 102 modules as a value. Exporting a function instead would
// mean touching every one of them, and every future caller would have to
// remember which form this module uses. The Proxy keeps the import site
// identical — `db.select(...)` still reads as a plain object — while moving the
// work to the first property access.
//
// Only the `get` trap is implemented, deliberately. Nothing in the codebase
// spreads, enumerates or `in`-checks `db` (verified), and the `ownKeys` /
// `getOwnPropertyDescriptor` traps carry invariant rules that throw at runtime
// when a reported key is missing from the target. An unimplemented trap falls
// through to the empty target, which is inert; a subtly wrong one is a crash.

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

function createDb() {
  const connectionString = buildConnectionString()

  // Reuse the Postgres connection across HMR reloads in development. The pool
  // lives on globalThis rather than in module scope precisely because module
  // scope is what HMR throws away — without this, every reload would open
  // another pool and leak the old one.
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

  return drizzle(client, { schema })
}

type Db = ReturnType<typeof createDb>

/**
 * Memoised per module instance. The POOL is shared across HMR reloads via
 * globalThis above; this only avoids re-wrapping it on every property access.
 */
let cached: Db | null = null

function getDb(): Db {
  if (!cached) cached = createDb()
  return cached
}

export const db = new Proxy({} as Db, {
  get(_target, prop) {
    const real = getDb()
    const value = Reflect.get(real, prop)
    // Methods must stay bound to the real instance: `const { select } = db`
    // and `db.select(...)` both have to work, and Drizzle's methods use `this`.
    return typeof value === "function" ? value.bind(real) : value
  },
})
