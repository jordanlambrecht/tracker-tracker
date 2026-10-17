// src/app/api/trackers/[id]/mousehole/route.ts
//
// Functions: resolveMousehole, refusalMessage, toResponse, failure, GET, POST

import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate, decodeKey, parseTrackerId, type RouteContext } from "@/lib/api-helpers"
import { decrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { trackers } from "@/lib/db/schema"
import { classifyFetchError, errMsg, isDecryptionError } from "@/lib/error-utils"
import { log } from "@/lib/logger"
import type { MouseholeResult, MouseholeStatusResponse } from "@/lib/mousehole"

const GET_TIMEOUT_MS = 10_000
// /updates waits on Mousehole's own MAM contact, which can queue behind a
// background contact already in flight.
const POST_TIMEOUT_MS = 30_000
const ROUTE = "/api/trackers/[id]/mousehole"

// /health answers from v0.4.0 and carries lastMamContactResult from v0.5.0,
// the first release whose /state and /updates this route can call. A saved
// path such as the web UI's /web gets the same 404 as an older release.
const NO_MOUSEHOLE_API =
  "Mousehole v0.5.0 or newer was not found at this URL. Use its root address, without /web"
const REDIRECTED =
  "Mousehole redirected the request. Save the address it ends up at, checking http or https"

interface MouseholeState {
  hasCookie?: boolean
  nextContactAt?: string
  lastMamContact?: {
    at?: string
    reached?: boolean
    ip?: string
    asn?: number
    as?: string
    ipUpdate?: { success?: boolean; msg?: string; httpStatus?: number }
    error?: { type?: string; message?: string }
  }
}

interface MouseholeTarget {
  baseUrl: string
  hostname: string
  headers: Record<string, string>
  hasToken: boolean
}

async function resolveMousehole(
  auth: { encryptionKey: string },
  params: RouteContext["params"]
): Promise<NextResponse | MouseholeTarget> {
  const trackerId = await parseTrackerId(params)
  if (trackerId instanceof NextResponse) return trackerId

  const [tracker] = await db
    .select({
      platformType: trackers.platformType,
      mouseholeUrl: trackers.mouseholeUrl,
      encryptedMouseholeToken: trackers.encryptedMouseholeToken,
    })
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

  if (!URL.canParse(tracker.mouseholeUrl)) {
    log.warn({ route: ROUTE, trackerId }, "stored Mousehole URL does not parse")
    return NextResponse.json({ error: "Invalid Mousehole URL in database" }, { status: 400 })
  }
  const url = new URL(tracker.mouseholeUrl)
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return NextResponse.json({ error: "Mousehole URL must use http or https" }, { status: 400 })
  }
  // Older builds accepted userinfo here. fetch() refuses such a URL in an
  // error that quotes it, so stop with a message that points at the token field.
  if (url.username || url.password) {
    return NextResponse.json(
      {
        error:
          "Mousehole URL carries a token or password. Remove it and enter the token in the Mousehole API token field",
      },
      { status: 400 }
    )
  }

  const headers: Record<string, string> = { Accept: "application/json" }
  if (tracker.encryptedMouseholeToken) {
    try {
      headers.Authorization = `Bearer ${decrypt(tracker.encryptedMouseholeToken, decodeKey(auth))}`
    } catch (error) {
      if (isDecryptionError(error)) {
        log.warn({ route: ROUTE, trackerId }, "Mousehole token unreadable: stale session key")
        return NextResponse.json({ error: "Session expired. Please log in again." }, { status: 401 })
      }
      log.error({ route: ROUTE, trackerId, error: errMsg(error) }, "Mousehole token unreadable")
      return NextResponse.json({ error: "Failed to read the Mousehole API token" }, { status: 500 })
    }
  }

  return {
    baseUrl: tracker.mouseholeUrl.replace(/\/+$/, ""),
    hostname: url.hostname,
    headers,
    hasToken: Boolean(tracker.encryptedMouseholeToken),
  }
}

// A 401 is reworded because Mousehole's no-token text ("No credentials
// presented") never names MOUSEHOLE_AUTH_TOKEN, and its API never takes the
// web UI password. Everything else passes Mousehole's message through, since
// its host-not-allowed 403 names MOUSEHOLE_ALLOWED_HOSTS itself.
async function refusalMessage(res: Response, hasToken: boolean): Promise<string> {
  if (res.status === 401) {
    return hasToken
      ? "Mousehole rejected the API token. Check that MOUSEHOLE_AUTH_TOKEN on Mousehole matches the token saved in this tracker's settings"
      : "Mousehole needs an API token. Set MOUSEHOLE_AUTH_TOKEN on Mousehole (a password alone is never accepted by its API) and enter it in this tracker's settings"
  }
  const body = (await res.json().catch(() => null)) as { message?: unknown } | null
  const message = typeof body?.message === "string" ? body.message.trim() : ""
  return message || `Mousehole returned HTTP ${res.status}`
}

function toResponse(
  result: MouseholeResult | null,
  state: MouseholeState | null,
  stateError: string | null
): MouseholeStatusResponse {
  const contact = state?.lastMamContact
  return {
    result,
    hasCookie: state?.hasCookie ?? null,
    ip: contact?.ip ?? null,
    asn: contact?.asn ?? null,
    asOrg: contact?.as ?? null,
    nextContactAt: state?.nextContactAt ?? null,
    lastContactAt: contact?.at ?? null,
    lastMessage: contact?.ipUpdate?.msg ?? contact?.error?.message ?? null,
    stateError,
  }
}

function failure(route: string, hostname: string, error: unknown): NextResponse {
  if (error instanceof Error && error.name === "AbortError") {
    log.warn({ route }, "Mousehole request timed out")
    return NextResponse.json({ error: "Mousehole request timed out" }, { status: 504 })
  }
  const cause = classifyFetchError(error, hostname).message
  // Never String(error), because undici's header refusal quotes the header value.
  log.warn({ route, error: cause }, "Mousehole unreachable")
  // redirect: "error" turns a 3xx into this TypeError; the host did answer.
  if (cause.endsWith("unexpected redirect")) {
    return NextResponse.json({ error: REDIRECTED }, { status: 502 })
  }
  return NextResponse.json({ error: "Mousehole unreachable" }, { status: 502 })
}

export async function GET(_request: Request, { params }: RouteContext) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const target = await resolveMousehole(auth, params)
  if (target instanceof NextResponse) return target

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), GET_TIMEOUT_MS)

  try {
    const [healthRes, stateRes] = await Promise.all([
      fetch(`${target.baseUrl}/health`, {
        headers: target.headers,
        redirect: "error",
        signal: controller.signal,
      }),
      fetch(`${target.baseUrl}/state`, {
        headers: target.headers,
        redirect: "error",
        signal: controller.signal,
      }),
    ])
    clearTimeout(timer)

    if (healthRes.status === 404) {
      return NextResponse.json({ error: NO_MOUSEHOLE_API }, { status: 502 })
    }
    if (!healthRes.ok) {
      // v0.4.0 answers /health with 503 {ok, isOnline} while it waits to sync.
      const body = (await healthRes.clone().json().catch(() => null)) as { ok?: unknown } | null
      if (typeof body?.ok === "boolean") {
        return NextResponse.json({ error: NO_MOUSEHOLE_API }, { status: 502 })
      }
      return NextResponse.json(
        { error: await refusalMessage(healthRes, target.hasToken) },
        { status: 502 }
      )
    }
    const health = (await healthRes.json().catch(() => null)) as {
      lastMamContactResult?: unknown
    } | null
    if (typeof health?.lastMamContactResult !== "string") {
      return NextResponse.json({ error: NO_MOUSEHOLE_API }, { status: 502 })
    }

    let state: MouseholeState | null = null
    let stateError: string | null = null
    if (stateRes.ok) {
      state = (await stateRes.json().catch(() => null)) as MouseholeState | null
      if (state === null) stateError = "Mousehole returned an unreadable /state response"
    } else {
      stateError = await refusalMessage(stateRes, target.hasToken)
    }

    return NextResponse.json(
      toResponse(health.lastMamContactResult as MouseholeResult, state, stateError)
    )
  } catch (error) {
    clearTimeout(timer)
    return failure(`GET ${ROUTE}`, target.hostname, error)
  }
}

export async function POST(_request: Request, { params }: RouteContext) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const target = await resolveMousehole(auth, params)
  if (target instanceof NextResponse) return target

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), POST_TIMEOUT_MS)

  try {
    const res = await fetch(`${target.baseUrl}/updates`, {
      method: "POST",
      headers: target.headers,
      redirect: "error",
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (!res.ok) {
      return NextResponse.json(
        { error: await refusalMessage(res, target.hasToken) },
        { status: 502 }
      )
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    clearTimeout(timer)
    return failure(`POST ${ROUTE}`, target.hostname, error)
  }
}
