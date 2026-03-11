// src/app/api/settings/reset-stats/route.ts
//
// Functions: POST

import { NextResponse } from "next/server"
import { authenticate } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { clientSnapshots, trackerSnapshots, trackers } from "@/lib/db/schema"

export async function POST() {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  // Delete all tracker snapshots
  await db.delete(trackerSnapshots)

  // Delete all client snapshots
  await db.delete(clientSnapshots)

  // Clear lastPolledAt and lastError on all trackers so they re-poll fresh
  await db
    .update(trackers)
    .set({ lastPolledAt: null, lastError: null })

  return NextResponse.json({ success: true })
}
