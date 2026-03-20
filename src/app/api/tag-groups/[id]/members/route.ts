// src/app/api/tag-groups/[id]/members/route.ts
//
// Functions: GET, POST

import { and, asc, eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate, parseJsonBody, parseRouteId, validateHexColor } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { tagGroupMembers, tagGroups } from "@/lib/db/schema"
import { log } from "@/lib/logger"

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const groupId = await parseRouteId(props.params, "group ID")
  if (groupId instanceof NextResponse) return groupId

  const [group] = await db
    .select({ id: tagGroups.id })
    .from(tagGroups)
    .where(eq(tagGroups.id, groupId))
    .limit(1)

  if (!group) {
    return NextResponse.json({ error: "Tag group not found" }, { status: 404 })
  }

  const members = await db
    .select()
    .from(tagGroupMembers)
    .where(eq(tagGroupMembers.groupId, groupId))
    .orderBy(asc(tagGroupMembers.sortOrder))

  return NextResponse.json(members)
}

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const groupId = await parseRouteId(props.params, "group ID")
  if (groupId instanceof NextResponse) return groupId

  const body = await parseJsonBody(request)
  if (body instanceof NextResponse) return body

  const { tag, label, color, sortOrder } = body as {
    tag?: string
    label?: string
    color?: string
    sortOrder?: number
  }

  if (!tag || typeof tag !== "string" || tag.trim().length === 0) {
    return NextResponse.json({ error: "tag is required" }, { status: 400 })
  }

  if (!label || typeof label !== "string" || label.trim().length === 0) {
    return NextResponse.json({ error: "label is required" }, { status: 400 })
  }

  if (tag.length > 100) {
    return NextResponse.json({ error: "Tag must be 100 characters or fewer" }, { status: 400 })
  }

  if (label.length > 100) {
    return NextResponse.json({ error: "Label must be 100 characters or fewer" }, { status: 400 })
  }

  if (typeof color === "string") {
    const colorErr = validateHexColor(color)
    if (colorErr) return colorErr
  }

  const [group] = await db
    .select({ id: tagGroups.id })
    .from(tagGroups)
    .where(eq(tagGroups.id, groupId))
    .limit(1)

  if (!group) {
    return NextResponse.json({ error: "Tag group not found" }, { status: 404 })
  }

  const [duplicate] = await db
    .select({ id: tagGroupMembers.id })
    .from(tagGroupMembers)
    .where(and(eq(tagGroupMembers.groupId, groupId), eq(tagGroupMembers.tag, tag.trim())))
    .limit(1)

  if (duplicate) {
    return NextResponse.json(
      { error: "A member with this tag already exists in the group" },
      { status: 409 }
    )
  }

  const [member] = await db
    .insert(tagGroupMembers)
    .values({
      groupId,
      tag: tag.trim(),
      label: label.trim(),
      color: typeof color === "string" ? color : null,
      sortOrder:
        typeof sortOrder === "number" && Number.isFinite(sortOrder) ? Math.floor(sortOrder) : 0,
    })
    .returning()

  log.info({ route: "POST /api/tag-groups/[id]/members", groupId }, "tag group member added")
  return NextResponse.json(member, { status: 201 })
}
