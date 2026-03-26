// src/app/api/dashboard/today/route.ts

import { NextResponse } from "next/server"
import { authenticate } from "@/lib/api-helpers"
import { log } from "@/lib/logger"
import { backfillTrackerCheckpoints, computeTodayAtAGlance } from "@/lib/today"

const g = globalThis as typeof globalThis & { __backfillDone?: boolean }

export async function GET() {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  try {
    // One-time backfill on first request that populates checkpoint table from existing snapshots
    if (!g.__backfillDone) {
      g.__backfillDone = true
      try {
        const filled = await backfillTrackerCheckpoints()
        if (filled > 0) log.info(`Backfilled ${filled} tracker daily checkpoints`)
      } catch (err) {
        log.error(err, "Checkpoint backfill failed")
      }
    }

    const data = await computeTodayAtAGlance()
    return NextResponse.json(data)
  } catch (error) {
    log.error(error, "Failed to compute today at a glance")
    return NextResponse.json({ error: "Failed to compute daily stats" }, { status: 500 })
  }
}
