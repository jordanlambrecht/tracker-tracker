// src/app/api/tag-groups/[id]/members/[memberId]/route.ts
//
// Functions: PATCH, DELETE

import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate, parseJsonBody, validateHexColor } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { tagGroupMembers } from "@/lib/db/schema"
import { log } from "@/lib/logger"

async function parseGroupAndMemberId(
  params: Promise<{ id: string; memberId: string }>
): Promise<NextResponse | { groupId: number; memberId: number }> {
  const { id, memberId } = await params
  const groupId = parseInt(id, 10)
  const memberIdNum = parseInt(memberId, 10)
  if (Number.isNaN(groupId) || groupId < 1)
    return NextResponse.json({ error: "Invalid group ID" }, { status: 400 })
  if (Number.isNaN(memberIdNum) || memberIdNum < 1)
    return NextResponse.json({ error: "Invalid member ID" }, { status: 400 })
  return { groupId, memberId: memberIdNum }
}

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string; memberId: string }> }
) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const parsed = await parseGroupAndMemberId(props.params)
  if (parsed instanceof NextResponse) return parsed
  const { groupId, memberId } = parsed

  const body = await parseJsonBody(request)
  if (body instanceof NextResponse) return body

  const [existing] = await db
    .select()
    .from(tagGroupMembers)
    .where(and(eq(tagGroupMembers.id, memberId), eq(tagGroupMembers.groupId, groupId)))
    .limit(1)

  if (!existing) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 })
  }

  const updates: Record<string, unknown> = {}

  if (typeof body.tag === "string") {
    if (body.tag.trim().length === 0) {
      return NextResponse.json({ error: "Tag cannot be empty" }, { status: 400 })
    }
    if (body.tag.length > 100) {
      return NextResponse.json({ error: "Tag must be 100 characters or fewer" }, { status: 400 })
    }
    if (body.tag.trim() !== existing.tag) {
      const [duplicate] = await db
        .select({ id: tagGroupMembers.id })
        .from(tagGroupMembers)
        .where(and(eq(tagGroupMembers.groupId, groupId), eq(tagGroupMembers.tag, body.tag.trim())))
        .limit(1)

      if (duplicate) {
        return NextResponse.json(
          { error: "A member with this tag already exists in the group" },
          { status: 409 }
        )
      }
    }
    updates.tag = body.tag.trim()
  }

  if (typeof body.label === "string") {
    if (body.label.trim().length === 0) {
      return NextResponse.json({ error: "Label cannot be empty" }, { status: 400 })
    }
    if (body.label.length > 100) {
      return NextResponse.json({ error: "Label must be 100 characters or fewer" }, { status: 400 })
    }
    updates.label = body.label.trim()
  }

  if (typeof body.color === "string") {
    const colorErr = validateHexColor(body.color)
    if (colorErr) return colorErr
    updates.color = body.color
  } else if (body.color === null) {
    updates.color = null
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

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ success: true })
  }

  await db
    .update(tagGroupMembers)
    .set(updates)
    .where(and(eq(tagGroupMembers.id, memberId), eq(tagGroupMembers.groupId, groupId)))

  return NextResponse.json({ success: true })
}

export async function DELETE(
  _request: Request,
  props: { params: Promise<{ id: string; memberId: string }> }
) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const parsed = await parseGroupAndMemberId(props.params)
  if (parsed instanceof NextResponse) return parsed
  const { groupId, memberId } = parsed

  const [existing] = await db
    .select({ id: tagGroupMembers.id })
    .from(tagGroupMembers)
    .where(and(eq(tagGroupMembers.id, memberId), eq(tagGroupMembers.groupId, groupId)))
    .limit(1)

  if (!existing) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 })
  }

  await db
    .delete(tagGroupMembers)
    .where(and(eq(tagGroupMembers.id, memberId), eq(tagGroupMembers.groupId, groupId)))

  log.info({ route: "DELETE /api/tag-groups/[id]/members/[memberId]", groupId, memberId }, "tag group member deleted")
  return NextResponse.json({ success: true })
}
