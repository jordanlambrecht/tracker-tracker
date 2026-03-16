// src/app/api/tag-groups/[id]/route.ts
//
// Functions: PATCH, DELETE

import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate, parseJsonBody, parseRouteId } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { tagGroups } from "@/lib/db/schema"
import { VALID_CHART_TYPES } from "@/types/api"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const groupId = await parseRouteId(params, "group ID")
  if (groupId instanceof NextResponse) return groupId

  const body = await parseJsonBody(request)
  if (body instanceof NextResponse) return body

  const updates: Record<string, unknown> = { updatedAt: new Date() }

  if (typeof body.name === "string") {
    if (body.name.trim().length === 0) {
      return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 })
    }
    if (body.name.length > 100) {
      return NextResponse.json({ error: "Name must be 100 characters or fewer" }, { status: 400 })
    }
    updates.name = body.name.trim()
  }

  if (typeof body.description === "string") {
    if (body.description.length > 500) {
      return NextResponse.json({ error: "Description must be 500 characters or fewer" }, { status: 400 })
    }
    updates.description = body.description.trim()
  } else if (body.description === null) {
    updates.description = null
  }

  if (typeof body.emoji === "string") {
    if (body.emoji.length > 10) {
      return NextResponse.json({ error: "Emoji must be 10 characters or fewer" }, { status: 400 })
    }
    updates.emoji = body.emoji.trim() || null
  } else if (body.emoji === null) {
    updates.emoji = null
  }

  if (typeof body.chartType === "string") {
    if (!(VALID_CHART_TYPES as readonly string[]).includes(body.chartType)) {
      return NextResponse.json({ error: `chartType must be one of: ${VALID_CHART_TYPES.join(", ")}` }, { status: 400 })
    }
    updates.chartType = body.chartType
  }

  if (typeof body.sortOrder === "number") {
    if (!Number.isFinite(body.sortOrder) || body.sortOrder < 0 || body.sortOrder > 9999) {
      return NextResponse.json(
        { error: "sortOrder must be a finite integer between 0 and 9999" },
        { status: 400 }
      )
    }
    updates.sortOrder = Math.floor(body.sortOrder)
  }

  if (typeof body.countUnmatched === "boolean") updates.countUnmatched = body.countUnmatched

  const [existing] = await db
    .select({ id: tagGroups.id })
    .from(tagGroups)
    .where(eq(tagGroups.id, groupId))
    .limit(1)

  if (!existing) {
    return NextResponse.json({ error: "Tag group not found" }, { status: 404 })
  }

  await db.update(tagGroups).set(updates).where(eq(tagGroups.id, groupId))

  return NextResponse.json({ success: true })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const groupId = await parseRouteId(params, "group ID")
  if (groupId instanceof NextResponse) return groupId

  const [existing] = await db
    .select({ id: tagGroups.id })
    .from(tagGroups)
    .where(eq(tagGroups.id, groupId))
    .limit(1)

  if (!existing) {
    return NextResponse.json({ error: "Tag group not found" }, { status: 404 })
  }

  await db.delete(tagGroups).where(eq(tagGroups.id, groupId))

  return NextResponse.json({ success: true })
}
