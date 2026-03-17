// src/app/api/alerts/dismissed/route.ts
//
// Functions: GET, POST, DELETE

import { and, eq, inArray, lt } from "drizzle-orm"
import { NextResponse } from "next/server"
import {
  ALERT_EXPIRY_MS,
  EXPIRING_ALERT_TYPES,
  NON_DISMISSIBLE_ALERT_TYPES,
} from "@/lib/alert-pruning"
import { authenticate, parseJsonBody } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { dismissedAlerts } from "@/lib/db/schema"

export async function GET() {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const cutoff = new Date(Date.now() - ALERT_EXPIRY_MS)

  // Lazily prune expired rows for expiring types
  const expiredRows = await db
    .select({ alertKey: dismissedAlerts.alertKey })
    .from(dismissedAlerts)
    .where(
      and(
        inArray(dismissedAlerts.alertType, EXPIRING_ALERT_TYPES),
        lt(dismissedAlerts.dismissedAt, cutoff)
      )
    )

  if (expiredRows.length > 0) {
    const expiredKeys = expiredRows.map((r) => r.alertKey)
    await db.delete(dismissedAlerts).where(inArray(dismissedAlerts.alertKey, expiredKeys))
  }

  const remaining = await db.select({ alertKey: dismissedAlerts.alertKey }).from(dismissedAlerts)

  return NextResponse.json({ keys: remaining.map((r) => r.alertKey) })
}

export async function POST(request: Request) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const body = await parseJsonBody(request)
  if (body instanceof NextResponse) return body

  const { key, type } = body

  if (typeof key !== "string" || key.trim().length === 0) {
    return NextResponse.json({ error: "key must be a non-empty string" }, { status: 400 })
  }
  if (key.length > 255) {
    return NextResponse.json({ error: "key must be 255 characters or fewer" }, { status: 400 })
  }

  if (typeof type !== "string" || type.trim().length === 0) {
    return NextResponse.json({ error: "type must be a non-empty string" }, { status: 400 })
  }
  if (type.length > 30) {
    return NextResponse.json({ error: "type must be 30 characters or fewer" }, { status: 400 })
  }

  if (NON_DISMISSIBLE_ALERT_TYPES.has(type)) {
    return NextResponse.json({ error: "This alert type cannot be dismissed" }, { status: 400 })
  }

  await db
    .insert(dismissedAlerts)
    .values({ alertKey: key.trim(), alertType: type.trim() })
    .onConflictDoNothing()

  return NextResponse.json({ success: true })
}

export async function DELETE(request: Request) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  const key = searchParams.get("key")

  if (key !== null) {
    await db.delete(dismissedAlerts).where(eq(dismissedAlerts.alertKey, key))
  } else {
    await db.delete(dismissedAlerts)
  }

  return NextResponse.json({ success: true })
}
