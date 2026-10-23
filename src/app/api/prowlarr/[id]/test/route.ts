// src/app/api/prowlarr/[id]/test/route.ts
//
// Functions: POST

import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate, decodeKey, parseRouteId, type RouteContext } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { prowlarrInstances } from "@/lib/db/schema"
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

  const out = await testProwlarrInstance(instance, decodeKey(auth))
  if ("error" in out) {
    log.warn(
      { route: "POST /api/prowlarr/[id]/test", prowlarrInstanceId: instanceId, error: out.error },
      "Prowlarr connection test failed"
    )
    return NextResponse.json({ error: out.error }, { status: 502 })
  }
  return NextResponse.json(out)
}
