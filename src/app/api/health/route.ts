// src/app/api/health/route.ts
//
// Functions: GET
//
// Lightweight health check for Docker HEALTHCHECK and load balancers.
// No authentication required — returns 200 if the server is up and
// can reach the database, 503 otherwise.

import { sql } from "drizzle-orm"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"

let cachedResult: { ok: boolean; at: number } | null = null
const CACHE_TTL = 10_000

export async function GET() {
  if (cachedResult && Date.now() - cachedResult.at < CACHE_TTL) {
    return cachedResult.ok
      ? NextResponse.json({ status: "ok", db: "connected" })
      : NextResponse.json({ status: "degraded", db: "unreachable" }, { status: 503 })
  }

  try {
    await db.execute(sql`SELECT 1`)
    cachedResult = { ok: true, at: Date.now() }
    return NextResponse.json({ status: "ok", db: "connected" })
  } catch {
    cachedResult = { ok: false, at: Date.now() }
    return NextResponse.json({ status: "degraded", db: "unreachable" }, { status: 503 })
  }
}
