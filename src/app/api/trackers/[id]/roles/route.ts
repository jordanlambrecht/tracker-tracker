// src/app/api/trackers/[id]/roles/route.ts
import { desc, eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate, parseJsonBody, parseTrackerId, type RouteContext } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { trackerRoles } from "@/lib/db/schema"
import { log } from "@/lib/logger"

export async function GET(_request: Request, props: RouteContext) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const trackerId = await parseTrackerId(props.params)
  if (trackerId instanceof NextResponse) return trackerId

  const roles = await db
    .select()
    .from(trackerRoles)
    .where(eq(trackerRoles.trackerId, trackerId))
    .orderBy(desc(trackerRoles.achievedAt))

  return NextResponse.json(
    roles.map((role) => ({
      ...role,
      achievedAt: role.achievedAt?.toISOString() ?? null,
    }))
  )
}

export async function POST(request: Request, props: RouteContext) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const trackerId = await parseTrackerId(props.params)
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

  if (roleName.length > 255) {
    return NextResponse.json(
      { error: "Role name must be 255 characters or fewer" },
      { status: 400 }
    )
  }

  if (achievedAt !== undefined) {
    if (typeof achievedAt !== "string" || Number.isNaN(new Date(achievedAt).getTime())) {
      return NextResponse.json({ error: "Invalid date format for achievedAt" }, { status: 400 })
    }
  }

  if (typeof notes === "string" && notes.length > 2000) {
    return NextResponse.json({ error: "Notes must be 2000 characters or fewer" }, { status: 400 })
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

  log.info({ route: "POST /api/trackers/[id]/roles", trackerId }, "role created")
  return NextResponse.json(
    { ...role, achievedAt: role.achievedAt?.toISOString() ?? null },
    { status: 201 }
  )
}
