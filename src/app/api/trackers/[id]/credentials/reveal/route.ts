// src/app/api/trackers/[id]/credentials/reveal/route.ts
//
// Functions: POST
//
// Returns the plaintext of ONE credential field. This is the most sensitive
// surface in the feature: it hands back a secret keyed by an id, and it is the
// only endpoint that ever does. Every call is rate-limited and logged.
//
// POST rather than GET, even though it reads: a GET would put the field id in
// the URL, and URLs land in access logs, proxy logs and the browser history.
// The body keeps the id out of all three. It also means no route can prefetch
// or cache a reveal.

import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import {
  authenticate,
  decodeKey,
  parseJsonBody,
  parseTrackerId,
  type RouteContext,
} from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { trackers } from "@/lib/db/schema"
import { errMsg } from "@/lib/error-utils"
import { log } from "@/lib/logger"
import { decryptTrackerCredentials } from "@/lib/tracker-credentials/decrypt"
import { requireCredentialVaultEnabled } from "@/lib/tracker-credentials/gate"
import { consumeRevealToken } from "@/lib/tracker-credentials/reveal-limit"
import { isCredentialSlug } from "@/lib/tracker-credentials/validate"

export async function POST(request: Request, props: RouteContext) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  // The opt-in gate, checked BEFORE the rate limiter so a request that was never
  // allowed in the first place does not consume anyone's reveal budget. This is
  // the endpoint that makes the toggle mean something: a disabled feature must
  // not keep a live secret-dispensing URL behind it.
  const gated = await requireCredentialVaultEnabled()
  if (gated) return gated

  const trackerId = await parseTrackerId(props.params)
  if (trackerId instanceof NextResponse) return trackerId

  const body = await parseJsonBody(request)
  if (body instanceof NextResponse) return body

  const fieldId = body.fieldId
  // Checked against the slug rule before any length check and before the id is
  // logged. The rule bounds length to 64, so a hostile multi-megabyte id is
  // rejected here rather than being interpolated anywhere.
  if (typeof fieldId !== "string" || !isCredentialSlug(fieldId)) {
    return NextResponse.json({ error: "Invalid field id" }, { status: 400 })
  }

  // Throttle BEFORE doing any work, so a flood costs no decrypts.
  const retryAfterMs = consumeRevealToken()
  if (retryAfterMs !== null) {
    log.warn(
      { route: "POST /api/trackers/[id]/credentials/reveal", trackerId },
      "credential reveal rate limit exceeded"
    )
    return NextResponse.json(
      { error: "Too many reveals. Wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } }
    )
  }

  const [tracker] = await db
    .select({
      id: trackers.id,
      name: trackers.name,
      encryptedCredentials: trackers.encryptedCredentials,
    })
    .from(trackers)
    .where(eq(trackers.id, trackerId))
    .limit(1)

  if (!tracker) return NextResponse.json({ error: "Tracker not found" }, { status: 404 })
  // NULL is "no vault" and must never reach decrypt(). A 404 rather than a 500:
  // there is genuinely nothing at this id.
  if (!tracker.encryptedCredentials) {
    return NextResponse.json({ error: "Field not found" }, { status: 404 })
  }

  const key = decodeKey(auth)
  try {
    const vault = decryptTrackerCredentials(
      { name: tracker.name, encryptedCredentials: tracker.encryptedCredentials },
      key
    )

    // Field ids are unique ACROSS THE WHOLE VAULT, which is what makes this
    // section-blind lookup unambiguous. validate.ts enforces that on write.
    let match: { value: string } | undefined
    for (const section of vault.sections) {
      const field = section.fields.find((f) => f.id === fieldId)
      if (field) {
        match = field
        break
      }
    }

    if (!match) return NextResponse.json({ error: "Field not found" }, { status: 404 })

    // The id, never the value or the label. A logged secret is a secret stored
    // in cleartext in the file the events tab reads.
    log.info(
      { route: "POST /api/trackers/[id]/credentials/reveal", trackerId, fieldId },
      "revealed tracker credential field"
    )

    // Deliberately not cached. No ETag, no revalidate. Next does not cache
    // route handler POSTs. This must stay a POST for that reason.
    return NextResponse.json({ value: match.value })
  } catch (err) {
    log.error(
      { route: "POST /api/trackers/[id]/credentials/reveal", trackerId, error: errMsg(err) },
      "Failed to reveal tracker credential field"
    )
    return NextResponse.json({ error: "Failed to read stored credentials" }, { status: 500 })
  } finally {
    key.fill(0)
  }
}
