// src/app/api/tag-groups/route.ts
//
// Functions: GET, POST

import { asc } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate, parseJsonBody } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { tagGroupMembers, tagGroups } from "@/lib/db/schema"
import type { TagGroup, TagGroupChartType } from "@/types/api"
import { VALID_CHART_TYPES } from "@/types/api"

export async function GET() {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const [groups, allMembers] = await Promise.all([
    db.select().from(tagGroups).orderBy(asc(tagGroups.sortOrder), asc(tagGroups.id)),
    db.select().from(tagGroupMembers).orderBy(asc(tagGroupMembers.sortOrder)),
  ])

  const membersByGroup = new Map<number, typeof allMembers>()
  for (const member of allMembers) {
    const list = membersByGroup.get(member.groupId)
    if (list) {
      list.push(member)
    } else {
      membersByGroup.set(member.groupId, [member])
    }
  }

  const result: TagGroup[] = groups.map((group) => ({
    id: group.id,
    name: group.name,
    emoji: group.emoji,
    chartType: group.chartType as TagGroupChartType,
    description: group.description,
    sortOrder: group.sortOrder,
    countUnmatched: group.countUnmatched,
    members: membersByGroup.get(group.id) ?? [],
  }))

  return NextResponse.json(result)
}

export async function POST(request: Request) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const body = await parseJsonBody(request)
  if (body instanceof NextResponse) return body

  const { name, description, emoji, chartType, countUnmatched } = body as {
    name?: string
    description?: string
    emoji?: string
    chartType?: string
    countUnmatched?: boolean
  }

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "name is required" }, { status: 400 })
  }

  if (name.length > 100) {
    return NextResponse.json({ error: "Name must be 100 characters or fewer" }, { status: 400 })
  }

  if (typeof description === "string" && description.length > 500) {
    return NextResponse.json(
      { error: "Description must be 500 characters or fewer" },
      { status: 400 }
    )
  }

  if (
    typeof chartType === "string" &&
    !(VALID_CHART_TYPES as readonly string[]).includes(chartType)
  ) {
    return NextResponse.json(
      { error: `chartType must be one of: ${VALID_CHART_TYPES.join(", ")}` },
      { status: 400 }
    )
  }

  if (typeof emoji === "string" && emoji.length > 10) {
    return NextResponse.json({ error: "Emoji must be 10 characters or fewer" }, { status: 400 })
  }

  const [group] = await db
    .insert(tagGroups)
    .values({
      name: name.trim(),
      emoji: typeof emoji === "string" && emoji.trim() ? emoji.trim() : null,
      chartType: typeof chartType === "string" ? chartType : "bar",
      description: typeof description === "string" ? description.trim() : null,
      sortOrder: 0,
      countUnmatched: typeof countUnmatched === "boolean" ? countUnmatched : false,
    })
    .returning()

  return NextResponse.json({ id: group.id, name: group.name }, { status: 201 })
}
