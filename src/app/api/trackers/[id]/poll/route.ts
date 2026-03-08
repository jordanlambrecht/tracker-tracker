// src/app/api/trackers/[id]/poll/route.ts
import { NextResponse } from "next/server"
import { authenticate, parseTrackerId } from "@/lib/api-helpers"
import { pollTracker } from "@/lib/scheduler"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const trackerId = await parseTrackerId(params)
  if (trackerId instanceof NextResponse) return trackerId

  const key = Buffer.from(auth.encryptionKey, "hex")

  try {
    await pollTracker(trackerId, key)
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Poll failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
