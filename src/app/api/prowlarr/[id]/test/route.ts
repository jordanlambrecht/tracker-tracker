// src/app/api/prowlarr/[id]/test/route.ts
//
// Functions: POST

import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate, decodeKey, parseRouteId, type RouteContext } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { prowlarrInstances } from "@/lib/db/schema"
import { isDecryptionError } from "@/lib/error-utils"
import { log } from "@/lib/logger"
import { testProwlarrInstance } from "@/lib/prowlarr/sync"

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
    // The key was sealed under the master key, so a session key that cannot
    // open it is stale. Re-entering the key would seal it under that stale key.
    if (isDecryptionError(err)) {
      log.warn({ route: "POST /api/prowlarr/[id]/test" }, "failed: stale session key")
      return NextResponse.json({ error: "Session expired. Please log in again" }, { status: 401 })
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
