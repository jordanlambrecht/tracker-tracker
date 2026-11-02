// src/app/api/prowlarr/[id]/test/route.ts
//
// Functions: POST

import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate, decodeKey, parseRouteId, type RouteContext } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { prowlarrInstances } from "@/lib/db/schema"
import { PROWLARR_KEY_UNREADABLE_ERROR, PROWLARR_NO_API_KEY_ERROR } from "@/lib/error-utils"
import { log } from "@/lib/logger"
import {
  ProwlarrKeyUnreadableError,
  ProwlarrSetupError,
  testProwlarrInstance,
} from "@/lib/prowlarr/sync"

export async function POST(_request: Request, props: RouteContext) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const instanceId = await parseRouteId(props.params, "Prowlarr instance ID")
  if (instanceId instanceof NextResponse) return instanceId

  const [instance] = await db
    .select({ url: prowlarrInstances.url, encryptedApiKey: prowlarrInstances.encryptedApiKey })
    .from(prowlarrInstances)
    .where(eq(prowlarrInstances.id, instanceId))
    .limit(1)
  if (!instance) {
    return NextResponse.json({ error: "Prowlarr instance not found" }, { status: 404 })
  }

  let out: Awaited<ReturnType<typeof testProwlarrInstance>>
  try {
    out = await testProwlarrInstance(instance, decodeKey(auth))
  } catch (err) {
    if (err instanceof ProwlarrKeyUnreadableError) {
      log.warn(
        { route: "POST /api/prowlarr/[id]/test", prowlarrInstanceId: instanceId },
        "failed: unreadable stored credential"
      )
      return NextResponse.json({ error: PROWLARR_KEY_UNREADABLE_ERROR }, { status: 422 })
    }
    if (err instanceof ProwlarrSetupError) {
      log.warn(
        { route: "POST /api/prowlarr/[id]/test", prowlarrInstanceId: instanceId },
        "failed: no API key stored"
      )
      return NextResponse.json({ error: PROWLARR_NO_API_KEY_ERROR }, { status: 422 })
    }
    throw err
  }
  if ("error" in out) {
    log.warn(
      { route: "POST /api/prowlarr/[id]/test", prowlarrInstanceId: instanceId, error: out.error },
      "Prowlarr connection test failed"
    )
    return NextResponse.json({ error: out.error }, { status: 502 })
  }
  return NextResponse.json(out)
}
