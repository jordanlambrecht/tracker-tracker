// src/app/api/tag-groups/route.ts
//
// Functions: GET, POST

import { NextResponse } from "next/server"
import { authenticate, parseJsonBody, validateMaxLength } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { tagGroups } from "@/lib/db/schema"
import { EMOJI_MAX, LONG_STRING_MAX, SHORT_NAME_MAX } from "@/lib/limits"
import { log } from "@/lib/logger"
import { getTagGroupsWithMembers } from "@/lib/server-data"
import { VALID_CHART_TYPES } from "@/types/api"

export async function GET() {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const result = await getTagGroupsWithMembers()
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

  const nameErr = validateMaxLength(name, SHORT_NAME_MAX, "Name")
  if (nameErr) return nameErr

  if (typeof description === "string" && description.length > LONG_STRING_MAX) {
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

  if (typeof emoji === "string" && emoji.length > EMOJI_MAX) {
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

  log.info({ route: "POST /api/tag-groups", groupId: group.id }, "tag group created")
  return NextResponse.json({ id: group.id, name: group.name }, { status: 201 })
}
