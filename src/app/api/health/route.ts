// src/app/api/health/route.ts
//
// Functions: GET
//
// Lightweight health check for Docker HEALTHCHECK and load balancers.
// No authentication required — returns 200 if the server is up and
// can reach the database, 503 otherwise.

import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { sql } from "drizzle-orm"

export async function GET() {
  try {
    await db.execute(sql`SELECT 1`)
    return NextResponse.json({ status: "ok" })
  } catch {
    return NextResponse.json({ status: "error" }, { status: 503 })
  }
}
