// src/app/api/settings/retention-prompt/route.ts
//
// Records the user's answer to the first-run snapshot-retention prompt.
//
// This is deliberately NOT part of PUT /api/settings, because the two fields have
// to move together: writing `snapshotRetentionDays` without stamping
// `retentionPromptedAt` would re-ask on the next load, and stamping without the
// value would silently accept "keep forever" as if it had been chosen. A single
// route makes that pairing impossible to get wrong from the client.
//
// Functions: GET (has the user been asked yet?), POST (record the answer).

import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate, parseJsonBody } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { appSettings } from "@/lib/db/schema"
import { SNAPSHOT_RETENTION_MAX, SNAPSHOT_RETENTION_MIN } from "@/lib/limits"

export async function GET() {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const [row] = await db
    .select({
      retentionPromptedAt: appSettings.retentionPromptedAt,
      snapshotRetentionDays: appSettings.snapshotRetentionDays,
    })
    .from(appSettings)
    .limit(1)

  return NextResponse.json({
    // Absent settings means setup has not finished; do not prompt over the top of it.
    prompted: row ? row.retentionPromptedAt !== null : true,
    snapshotRetentionDays: row?.snapshotRetentionDays ?? null,
  })
}

export async function POST(request: Request) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const body = await parseJsonBody(request)
  if (body instanceof NextResponse) return body

  // null (or 0, matching PUT /api/settings) means "keep snapshots forever" — a real
  // choice here, not an absence of one. That is exactly why it needs its own marker.
  const raw = body.snapshotRetentionDays
  let days: number | null
  if (raw === null || raw === 0) {
    days = null
  } else if (typeof raw === "number" && Number.isInteger(raw)) {
    if (raw < SNAPSHOT_RETENTION_MIN || raw > SNAPSHOT_RETENTION_MAX) {
      return NextResponse.json(
        {
          error: `Snapshot retention must be between ${SNAPSHOT_RETENTION_MIN} and ${SNAPSHOT_RETENTION_MAX} days`,
        },
        { status: 400 }
      )
    }
    days = raw
  } else {
    return NextResponse.json({ error: "Invalid snapshot retention" }, { status: 400 })
  }

  const [row] = await db.select({ id: appSettings.id }).from(appSettings).limit(1)
  if (!row) {
    return NextResponse.json({ error: "Not configured" }, { status: 400 })
  }

  await db
    .update(appSettings)
    .set({ snapshotRetentionDays: days, retentionPromptedAt: new Date() })
    .where(eq(appSettings.id, row.id))

  return NextResponse.json({ prompted: true, snapshotRetentionDays: days })
}
