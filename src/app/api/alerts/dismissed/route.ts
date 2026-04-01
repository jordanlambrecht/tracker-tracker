// src/app/api/alerts/dismissed/route.ts
//
// Functions: GET, POST, DELETE

import { eq, inArray } from "drizzle-orm"
import { NextResponse } from "next/server"
import { NON_DISMISSIBLE_ALERT_TYPES, pruneDismissedAlerts } from "@/lib/alert-pruning"
import { authenticate, parseJsonBody } from "@/lib/api-helpers"
import type { AlertType } from "@/lib/dashboard"
import { db } from "@/lib/db"
import { dismissedAlerts } from "@/lib/db/schema"

export async function GET() {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  await pruneDismissedAlerts()

  const remaining = await db.select({ alertKey: dismissedAlerts.alertKey }).from(dismissedAlerts)

  return NextResponse.json({ keys: remaining.map((r) => r.alertKey) })
}

export async function POST(request: Request) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const body = await parseJsonBody(request)
  if (body instanceof NextResponse) return body

  const { key, type } = body

  if (typeof key !== "string") {
    return NextResponse.json({ error: "key must be a non-empty string" }, { status: 400 })
  }
  const normalizedKey = key.trim()
  if (normalizedKey.length === 0) {
    return NextResponse.json({ error: "key must be a non-empty string" }, { status: 400 })
  }
  if (normalizedKey.length > 255) {
    return NextResponse.json({ error: "key must be 255 characters or fewer" }, { status: 400 })
  }

  if (typeof type !== "string") {
    return NextResponse.json({ error: "type must be a non-empty string" }, { status: 400 })
  }
  const normalizedType = type.trim()
  if (normalizedType.length === 0) {
    return NextResponse.json({ error: "type must be a non-empty string" }, { status: 400 })
  }
  if (normalizedType.length > 30) {
    return NextResponse.json({ error: "type must be 30 characters or fewer" }, { status: 400 })
  }

  if (NON_DISMISSIBLE_ALERT_TYPES.has(normalizedType as AlertType)) {
    return NextResponse.json({ error: "This alert type cannot be dismissed" }, { status: 400 })
  }

  await db
    .insert(dismissedAlerts)
    .values({ alertKey: normalizedKey, alertType: normalizedType })
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
