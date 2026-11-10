// src/app/api/prowlarr/[id]/indexers/[indexerId]/test/route.ts
//
// Functions: parseId, POST

import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import {
  authenticate,
  decodeKey,
  type RouteContext,
  refuseIfOutboundDisabled,
} from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { prowlarrInstances } from "@/lib/db/schema"
import { errMsg, PROWLARR_KEY_UNREADABLE_ERROR, PROWLARR_NO_API_KEY_ERROR } from "@/lib/error-utils"
import { PROWLARR_TEST_COOLDOWN_MS } from "@/lib/limits"
import { log } from "@/lib/logger"
import {
  ProwlarrKeyUnreadableError,
  ProwlarrSetupError,
  retestProwlarrIndexer,
} from "@/lib/prowlarr/sync"
import { requestProwlarrPoll } from "@/lib/prowlarr-scheduler"

// When each indexer was last tested from here, keyed "<instanceId>:<indexerId>".
// On globalThis so it persists across HMR reloads.
const g = globalThis as typeof globalThis & { __prowlarrTestedAt?: Map<string, number> }

function parseId(value: string): number | null {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 2_147_483_647 ? parsed : null
}

/**
 * Runs Prowlarr's test for one indexer; a passing test clears its failure
 * backoff and a failed one extends it. Returns 422 with Prowlarr's validation
 * messages when the test fails or the stored key can't be used, 429 within the
 * cooldown, and 502 when Prowlarr cannot be reached.
 */
export async function POST(
  _request: Request,
  props: RouteContext<{ id: string; indexerId: string }>
) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth
  const refusal = refuseIfOutboundDisabled()
  if (refusal) return refusal

  const params = await props.params
  const instanceId = parseId(params.id)
  const indexerId = parseId(params.indexerId)
  if (instanceId === null || indexerId === null) {
    return NextResponse.json({ error: "Invalid Prowlarr indexer" }, { status: 400 })
  }

  const [instance] = await db
    .select({
      id: prowlarrInstances.id,
      url: prowlarrInstances.url,
      encryptedApiKey: prowlarrInstances.encryptedApiKey,
    })
    .from(prowlarrInstances)
    .where(eq(prowlarrInstances.id, instanceId))
    .limit(1)
  if (!instance) {
    return NextResponse.json({ error: "Prowlarr instance not found" }, { status: 404 })
  }

  // Each test is a search with the user's account on the site.
  g.__prowlarrTestedAt ??= new Map()
  const testedAt = g.__prowlarrTestedAt
  const cooldownKey = `${instanceId}:${indexerId}`
  const last = testedAt.get(cooldownKey)
  const now = Date.now()
  if (last !== undefined && now - last < PROWLARR_TEST_COOLDOWN_MS) {
    const seconds = Math.ceil((PROWLARR_TEST_COOLDOWN_MS - (now - last)) / 1000)
    return NextResponse.json(
      { error: `This indexer was tested moments ago. Try again in ${seconds} s` },
      { status: 429, headers: { "Retry-After": String(seconds) } }
    )
  }
  testedAt.set(cooldownKey, now)

  const key = decodeKey(auth)
  let out: Awaited<ReturnType<typeof retestProwlarrIndexer>>
  try {
    out = await retestProwlarrIndexer(instance, indexerId, key)
  } catch (err) {
    if (err instanceof ProwlarrKeyUnreadableError) {
      log.warn(
        {
          route: "POST /api/prowlarr/[id]/indexers/[indexerId]/test",
          prowlarrInstanceId: instanceId,
        },
        "failed: unreadable stored credential"
      )
      return NextResponse.json({ error: PROWLARR_KEY_UNREADABLE_ERROR }, { status: 422 })
    }
    if (err instanceof ProwlarrSetupError) {
      log.warn(
        {
          route: "POST /api/prowlarr/[id]/indexers/[indexerId]/test",
          prowlarrInstanceId: instanceId,
        },
        "failed: no API key stored"
      )
      return NextResponse.json({ error: PROWLARR_NO_API_KEY_ERROR }, { status: 422 })
    }
    throw err
  }

  if ("error" in out) {
    log.warn(
      {
        route: "POST /api/prowlarr/[id]/indexers/[indexerId]/test",
        prowlarrInstanceId: instanceId,
        error: out.error,
      },
      "Prowlarr indexer test could not run"
    )
    return NextResponse.json({ error: out.error }, { status: 502 })
  }

  // Re-read the status so a cleared or extended backoff is shown at once.
  await requestProwlarrPoll(instanceId, key).catch((err) => {
    log.warn({ prowlarrInstanceId: instanceId, error: errMsg(err) }, "Prowlarr refresh failed")
  })
  if ("failures" in out) {
    return NextResponse.json({ error: out.failures.join("; ") }, { status: 422 })
  }
  return NextResponse.json({ ok: true })
}
