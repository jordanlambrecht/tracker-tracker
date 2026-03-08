// src/app/api/trackers/[id]/roles/route.ts
import { desc, eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate, parseJsonBody, parseTrackerId } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { trackerRoles } from "@/lib/db/schema"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const trackerId = await parseTrackerId(params)
  if (trackerId instanceof NextResponse) return trackerId

  const roles = await db
    .select()
    .from(trackerRoles)
    .where(eq(trackerRoles.trackerId, trackerId))
    .orderBy(desc(trackerRoles.achievedAt))

  return NextResponse.json(roles)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const trackerId = await parseTrackerId(params)
  if (trackerId instanceof NextResponse) return trackerId

  const body = await parseJsonBody(request)
  if (body instanceof NextResponse) return body

  const { roleName, achievedAt, notes } = body as {
    roleName?: string
    achievedAt?: string
    notes?: string
  }

  if (!roleName || typeof roleName !== "string") {
    return NextResponse.json({ error: "roleName is required" }, { status: 400 })
  }

  const [role] = await db
    .insert(trackerRoles)
    .values({
      trackerId,
      roleName: roleName.trim(),
      achievedAt: achievedAt ? new Date(achievedAt) : new Date(),
      notes: notes?.trim() || null,
    })
    .returning()

  return NextResponse.json(role, { status: 201 })
}
