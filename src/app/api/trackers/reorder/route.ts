// src/app/api/trackers/reorder/route.ts
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate, parseJsonBody } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { trackers } from "@/lib/db/schema"
import { errMsg } from "@/lib/error-utils"
import { REORDER_IDS_MAX } from "@/lib/limits"
import { log } from "@/lib/logger"

export async function PATCH(request: Request) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const body = await parseJsonBody(request)
  if (body instanceof NextResponse) return body

  const { ids } = body as { ids?: number[] }

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids must be a non-empty array of numbers" }, { status: 400 })
  }

  if (ids.length > REORDER_IDS_MAX) {
    return NextResponse.json({ error: "Too many ids" }, { status: 400 })
  }

  if (!ids.every((id) => typeof id === "number" && Number.isInteger(id))) {
    return NextResponse.json({ error: "All ids must be integers" }, { status: 400 })
  }

  if (new Set(ids).size !== ids.length) {
    return NextResponse.json({ error: "Duplicate ids are not allowed" }, { status: 400 })
  }

  try {
    await db.transaction(async (tx) => {
      for (let i = 0; i < ids.length; i++) {
        await tx.update(trackers).set({ sortOrder: i }).where(eq(trackers.id, ids[i]))
      }
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    log.error(
      { route: "PATCH /api/trackers/reorder", error: errMsg(err) },
      "Failed to reorder trackers"
    )
    return NextResponse.json({ error: "Failed to reorder trackers" }, { status: 500 })
  }
}
