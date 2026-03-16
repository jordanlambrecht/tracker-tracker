// src/app/api/trackers/reorder/route.ts
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate, parseJsonBody } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { trackers } from "@/lib/db/schema"

export async function PATCH(request: Request) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const body = await parseJsonBody(request)
  if (body instanceof NextResponse) return body

  const { ids } = body as { ids?: number[] }

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids must be a non-empty array of numbers" }, { status: 400 })
  }

  if (ids.length > 500) {
    return NextResponse.json({ error: "Too many ids" }, { status: 400 })
  }

  if (!ids.every((id) => typeof id === "number" && Number.isInteger(id))) {
    return NextResponse.json({ error: "All ids must be integers" }, { status: 400 })
  }

  await Promise.all(
    ids.map((id, index) => db.update(trackers).set({ sortOrder: index }).where(eq(trackers.id, id)))
  )

  return NextResponse.json({ ok: true })
}
