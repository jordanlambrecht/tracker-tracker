// src/app/api/trackers/[id]/roles/route.ts
import { desc, eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { db } from "@/lib/db"
import { trackerRoles } from "@/lib/db/schema"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const trackerId = parseInt(id, 10)
  if (Number.isNaN(trackerId)) {
    return NextResponse.json({ error: "Invalid tracker ID" }, { status: 400 })
  }

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
  try {
    await requireAuth()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const trackerId = parseInt(id, 10)
  if (Number.isNaN(trackerId)) {
    return NextResponse.json({ error: "Invalid tracker ID" }, { status: 400 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

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
