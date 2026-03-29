// src/app/api/trackers/[id]/mousehole/route.ts
//
// Functions: GET, POST

import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate, parseTrackerId, type RouteContext } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { trackers } from "@/lib/db/schema"
import { log } from "@/lib/logger"

const GET_TIMEOUT_MS = 10_000
const POST_TIMEOUT_MS = 15_000

// ---------------------------------------------------------------------------
// Shared guards
// ---------------------------------------------------------------------------

async function resolveMouseholeBase(
  params: RouteContext["params"]
): Promise<NextResponse | { mouseholeBase: string }> {
  const trackerId = await parseTrackerId(params)
  if (trackerId instanceof NextResponse) return trackerId

  const [tracker] = await db
    .select({ platformType: trackers.platformType, mouseholeUrl: trackers.mouseholeUrl })
    .from(trackers)
    .where(eq(trackers.id, trackerId))
    .limit(1)

  if (!tracker) {
    return NextResponse.json({ error: "Tracker not found" }, { status: 404 })
  }

  if (tracker.platformType !== "mam") {
    return NextResponse.json(
      { error: "Mousehole is only available for MAM trackers" },
      { status: 400 }
    )
  }

  if (!tracker.mouseholeUrl) {
    return NextResponse.json({ error: "Mousehole URL not configured" }, { status: 400 })
  }

  try {
    const parsed = new URL(tracker.mouseholeUrl)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return NextResponse.json({ error: "Mousehole URL must use http or https" }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: "Invalid Mousehole URL in database" }, { status: 400 })
  }

  const mouseholeBase = tracker.mouseholeUrl.replace(/\/+$/, "")
  return { mouseholeBase }
}

// ---------------------------------------------------------------------------
// GET /api/trackers/[id]/mousehole
// Combines GET /ok + GET /state from the Mousehole instance
// ---------------------------------------------------------------------------

export async function GET(_request: Request, { params }: RouteContext) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const resolved = await resolveMouseholeBase(params)
  if (resolved instanceof NextResponse) return resolved

  const { mouseholeBase } = resolved

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), GET_TIMEOUT_MS)

  try {
    const [okRes, stateRes] = await Promise.all([
      fetch(`${mouseholeBase}/ok`, { signal: controller.signal }),
      fetch(`${mouseholeBase}/state`, { signal: controller.signal }),
    ])

    clearTimeout(timer)

    const [okJson, stateJson] = await Promise.all([
      okRes.json() as Promise<{ ok: boolean; reason: string }>,
      stateRes.json() as Promise<{
        host?: { ip?: string | null; asn?: number | null; as?: string | null }
        nextUpdateAt?: string | null
        lastUpdate?: { at?: string | null; mamUpdated?: boolean | null }
        lastMam?: { response?: { body?: { msg?: string | null } } }
      }>,
    ])

    return NextResponse.json({
      ok: okJson.ok ?? false,
      reason: okJson.reason ?? null,
      ip: stateJson.host?.ip ?? null,
      asn: stateJson.host?.asn ?? null,
      asOrg: stateJson.host?.as ?? null,
      nextUpdateAt: stateJson.nextUpdateAt ?? null,
      lastUpdateAt: stateJson.lastUpdate?.at ?? null,
      lastUpdateResult: stateJson.lastMam?.response?.body?.msg ?? null,
      mamUpdated: stateJson.lastUpdate?.mamUpdated ?? null,
    })
  } catch (error) {
    clearTimeout(timer)

    if (error instanceof Error && error.name === "AbortError") {
      log.warn({ route: "GET /api/trackers/[id]/mousehole" }, "Mousehole request timed out")
      return NextResponse.json({ error: "Mousehole request timed out" }, { status: 504 })
    }

    log.warn(
      { route: "GET /api/trackers/[id]/mousehole", error: String(error) },
      "Mousehole unreachable"
    )
    return NextResponse.json({ error: "Mousehole unreachable" }, { status: 502 })
  }
}

// ---------------------------------------------------------------------------
// POST /api/trackers/[id]/mousehole
// Proxies POST /update to the Mousehole instance
// ---------------------------------------------------------------------------

export async function POST(request: Request, { params }: RouteContext) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const resolved = await resolveMouseholeBase(params)
  if (resolved instanceof NextResponse) return resolved

  const { mouseholeBase } = resolved

  const MAX_BODY_SIZE = 256
  const contentLength = Number(request.headers.get("content-length") ?? 0)
  if (contentLength > MAX_BODY_SIZE) {
    return NextResponse.json({ error: "Request body too large" }, { status: 413 })
  }

  let body: { force?: boolean } = {}
  try {
    const raw = await request.json()
    if (raw && typeof raw === "object" && "force" in raw) {
      body = { force: Boolean(raw.force) }
    }
  } catch (_err) {
    log.warn({ route: "POST /api/trackers/[id]/mousehole" }, "no request body (optional)")
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), POST_TIMEOUT_MS)

  try {
    const res = await fetch(`${mouseholeBase}/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    clearTimeout(timer)

    const data: unknown = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (error) {
    clearTimeout(timer)

    if (error instanceof Error && error.name === "AbortError") {
      log.warn({ route: "POST /api/trackers/[id]/mousehole" }, "Mousehole request timed out")
      return NextResponse.json({ error: "Mousehole request timed out" }, { status: 504 })
    }

    log.warn(
      { route: "POST /api/trackers/[id]/mousehole", error: String(error) },
      "Mousehole unreachable"
    )
    return NextResponse.json({ error: "Mousehole unreachable" }, { status: 502 })
  }
}
