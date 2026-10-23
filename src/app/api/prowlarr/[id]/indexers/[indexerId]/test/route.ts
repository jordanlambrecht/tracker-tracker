// src/app/api/prowlarr/[id]/indexers/[indexerId]/test/route.ts
//
// Functions: POST

import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate, decodeKey, type RouteContext } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { prowlarrInstances } from "@/lib/db/schema"
import { log } from "@/lib/logger"
import { retestProwlarrIndexer } from "@/lib/prowlarr/sync"

function parseId(value: string): number | null {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

/**
 * Runs Prowlarr's test for one indexer; a passing test clears its failure
 * backoff. Returns 422 with Prowlarr's validation messages when the test fails,
 * and 502 when Prowlarr cannot be reached.
 */
export async function POST(
  _request: Request,
  props: RouteContext<{ id: string; indexerId: string }>
) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

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

  const out = await retestProwlarrIndexer(instance, indexerId, decodeKey(auth))
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
  if ("failures" in out) {
    return NextResponse.json({ error: out.failures.join("; ") }, { status: 422 })
  }
  return NextResponse.json({ ok: true })
}
