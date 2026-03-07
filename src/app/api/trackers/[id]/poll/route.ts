// src/app/api/trackers/[id]/poll/route.ts
import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { pollTracker } from "@/lib/scheduler"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let session: { encryptionKey: string }
  try {
    session = await requireAuth()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const trackerId = parseInt(id, 10)
  if (Number.isNaN(trackerId)) {
    return NextResponse.json({ error: "Invalid tracker ID" }, { status: 400 })
  }

  const key = Buffer.from(session.encryptionKey, "hex")

  try {
    await pollTracker(trackerId, key)
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Poll failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
