// e2e/db.ts
//
// Direct access to the e2e database for the two things the HTTP surface cannot
// do: wiping it between runs, and reading a column the API deliberately never
// returns. The name check is the only thing standing between this and the
// database with real trackers in it, so it is not configurable.
import postgres from "postgres"
import { E2E_DATABASE } from "../playwright.config"

export function e2eSql(): postgres.Sql {
  if (!E2E_DATABASE.endsWith("_e2e")) {
    throw new Error(`Refusing to touch "${E2E_DATABASE}": the e2e database name must end in _e2e`)
  }
  const password = process.env.POSTGRES_PASSWORD
  if (!password) throw new Error("POSTGRES_PASSWORD is not set; the suite reads .env")

  return postgres({
    host: process.env.POSTGRES_HOST ?? "localhost",
    port: Number(process.env.POSTGRES_PORT ?? "5432"),
    user: process.env.POSTGRES_USER ?? "postgres",
    password,
    database: E2E_DATABASE,
  })
}

/** Truncates every table in the e2e database. */
export async function resetDatabase(): Promise<void> {
  const sql = e2eSql()
  try {
    const tables = await sql<{ tablename: string }[]>`
      select tablename from pg_tables where schemaname = 'public'
    `
    if (tables.length > 0) {
      const list = tables.map((t) => `"${t.tablename}"`).join(", ")
      await sql.unsafe(`truncate table ${list} restart identity cascade`)
    }
  } finally {
    await sql.end()
  }
}

/** The stored ciphertext for a tracker's API token, which no route exposes. */
export async function storedApiToken(trackerId: number): Promise<string | null> {
  const sql = e2eSql()
  try {
    const rows = await sql<{ encrypted_api_token: string }[]>`
      select encrypted_api_token from trackers where id = ${trackerId}
    `
    return rows[0]?.encrypted_api_token ?? null
  } finally {
    await sql.end()
  }
}
