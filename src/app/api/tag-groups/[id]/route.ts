// src/app/api/tag-groups/[id]/route.ts
//
// Functions: PATCH, DELETE

import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate, parseJsonBody, parseRouteId, type RouteContext } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { tagGroupMembers, tagGroups } from "@/lib/db/schema"
import { log } from "@/lib/logger"
import { VALID_CHART_TYPES } from "@/types/api"

// ─── Batch member mutation types ──────────────────────────────────────────────

interface MemberUpdate {
  id: number
  tag?: string
  label?: string
  color?: string | null
  sortOrder?: number
}

interface MemberCreate {
  tag: string
  label: string
  color?: string | null
  sortOrder?: number
}

interface BatchMembers {
  removes?: number[]
  updates?: MemberUpdate[]
  creates?: MemberCreate[]
}

// ─── Validation helpers ───────────────────────────────────────────────────────

function validateMemberTag(tag: unknown): string | null {
  if (typeof tag !== "string" || tag.trim().length === 0) return "tag is required"
  if (tag.length > 100) return "Tag must be 100 characters or fewer"
  return null
}

function validateMemberLabel(label: unknown): string | null {
  if (typeof label !== "string" || label.trim().length === 0) return "label is required"
  if (label.length > 100) return "Label must be 100 characters or fewer"
  return null
}

function validateSortOrder(sortOrder: unknown): string | null {
  if (sortOrder === undefined || sortOrder === null) return null
  if (
    typeof sortOrder !== "number" ||
    !Number.isFinite(sortOrder) ||
    sortOrder < 0 ||
    sortOrder > 9999
  ) {
    return "sortOrder must be a finite integer between 0 and 9999"
  }
  return null
}

// ─── PATCH ────────────────────────────────────────────────────────────────────

export async function PATCH(request: Request, props: RouteContext) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const groupId = await parseRouteId(props.params, "group ID")
  if (groupId instanceof NextResponse) return groupId

  const body = await parseJsonBody(request)
  if (body instanceof NextResponse) return body

  // --- Build group metadata updates ---

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
      return NextResponse.json(
        { error: "Description must be 500 characters or fewer" },
        { status: 400 }
      )
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
      return NextResponse.json(
        { error: `chartType must be one of: ${VALID_CHART_TYPES.join(", ")}` },
        { status: 400 }
      )
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

  // --- Validate group exists ---

  const [existing] = await db
    .select({ id: tagGroups.id })
    .from(tagGroups)
    .where(eq(tagGroups.id, groupId))
    .limit(1)

  if (!existing) {
    return NextResponse.json({ error: "Tag group not found" }, { status: 404 })
  }

  // --- Batch member mutations (optional) ---

  const members = body.members as BatchMembers | undefined

  if (members) {
    // Pre-validate all member mutations before touching the DB
    const removes = members.removes ?? []
    const memberUpdates = members.updates ?? []
    const creates = members.creates ?? []

    if (
      !Array.isArray(removes) ||
      !removes.every((id) => typeof id === "number" && Number.isInteger(id))
    ) {
      return NextResponse.json(
        { error: "members.removes must be an array of integer IDs" },
        { status: 400 }
      )
    }
    if (removes.length > 500) {
      return NextResponse.json({ error: "Too many removes" }, { status: 400 })
    }

    for (const u of memberUpdates) {
      if (typeof u.id !== "number" || !Number.isInteger(u.id)) {
        return NextResponse.json({ error: "Each update must have an integer id" }, { status: 400 })
      }
      if (u.tag !== undefined) {
        const err = validateMemberTag(u.tag)
        if (err) return NextResponse.json({ error: err }, { status: 400 })
      }
      if (u.label !== undefined) {
        const err = validateMemberLabel(u.label)
        if (err) return NextResponse.json({ error: err }, { status: 400 })
      }
      const sortErr = validateSortOrder(u.sortOrder)
      if (sortErr) return NextResponse.json({ error: sortErr }, { status: 400 })
    }
    if (memberUpdates.length > 500) {
      return NextResponse.json({ error: "Too many updates" }, { status: 400 })
    }

    for (const c of creates) {
      const tagErr = validateMemberTag(c.tag)
      if (tagErr) return NextResponse.json({ error: tagErr }, { status: 400 })
      const labelErr = validateMemberLabel(c.label)
      if (labelErr) return NextResponse.json({ error: labelErr }, { status: 400 })
      const sortErr = validateSortOrder(c.sortOrder)
      if (sortErr) return NextResponse.json({ error: sortErr }, { status: 400 })
    }
    if (creates.length > 500) {
      return NextResponse.json({ error: "Too many creates" }, { status: 400 })
    }

    // All valid — execute atomically
    await db.transaction(async (tx) => {
      // 1. Update group metadata
      await tx.update(tagGroups).set(updates).where(eq(tagGroups.id, groupId))

      // 2. Deletes first (must precede creates — tag duplicate check depends on this)
      for (const memberId of removes) {
        await tx
          .delete(tagGroupMembers)
          .where(and(eq(tagGroupMembers.id, memberId), eq(tagGroupMembers.groupId, groupId)))
      }

      // 3. Updates second
      for (const u of memberUpdates) {
        const fields: Record<string, unknown> = {}
        if (u.tag !== undefined) fields.tag = u.tag.trim()
        if (u.label !== undefined) fields.label = u.label.trim()
        if (u.color !== undefined) fields.color = u.color
        if (u.sortOrder !== undefined) fields.sortOrder = Math.floor(u.sortOrder)
        if (Object.keys(fields).length > 0) {
          await tx
            .update(tagGroupMembers)
            .set(fields)
            .where(and(eq(tagGroupMembers.id, u.id), eq(tagGroupMembers.groupId, groupId)))
        }
      }

      // 4. Creates last (after deletes to avoid false duplicate-tag conflicts)
      for (const c of creates) {
        await tx.insert(tagGroupMembers).values({
          groupId,
          tag: c.tag.trim(),
          label: c.label.trim(),
          color: typeof c.color === "string" ? c.color : null,
          sortOrder: typeof c.sortOrder === "number" ? Math.floor(c.sortOrder) : 0,
        })
      }
    })

    log.info(
      {
        route: "PATCH /api/tag-groups/[id]",
        groupId,
        removes: removes.length,
        updates: memberUpdates.length,
        creates: creates.length,
      },
      "tag group batch saved"
    )
    return NextResponse.json({ success: true })
  }

  // --- Non-batch path (group metadata only, backward-compatible) ---

  await db.update(tagGroups).set(updates).where(eq(tagGroups.id, groupId))

  return NextResponse.json({ success: true })
}

export async function DELETE(_request: Request, props: RouteContext) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const groupId = await parseRouteId(props.params, "group ID")
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

  log.info({ route: "DELETE /api/tag-groups/[id]", groupId }, "tag group deleted")
  return NextResponse.json({ success: true })
}
