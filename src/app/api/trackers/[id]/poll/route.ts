// src/app/api/trackers/[id]/poll/route.ts

import { NextResponse } from "next/server"
import {
  authenticate,
  decodeKey,
  parseTrackerId,
  type RouteContext,
  refuseIfOutboundDisabled,
} from "@/lib/api-helpers"
import { runManualPoll } from "@/lib/manual-poll"

export async function POST(_request: Request, props: RouteContext) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth
  const refusal = refuseIfOutboundDisabled()
  if (refusal) return refusal

  const trackerId = await parseTrackerId(props.params)
  if (trackerId instanceof NextResponse) return trackerId

  // A recorded failure still answers 200, which makes Poll Now refetch the row
  // and show its error, with success saying which it was.
  const result = await runManualPoll(trackerId, decodeKey(auth), "POST /api/trackers/[id]/poll")
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ success: result.polled })
}
