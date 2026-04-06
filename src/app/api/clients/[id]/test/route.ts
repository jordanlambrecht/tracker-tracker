// src/app/api/clients/[id]/test/route.ts
//
// Functions: POST

import { NextResponse } from "next/server"
import { authenticate, decodeKey, parseRouteId, type RouteContext } from "@/lib/api-helpers"
import { testClientConnection } from "@/lib/download-clients"
import { log } from "@/lib/logger"

export async function POST(_request: Request, props: RouteContext) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const clientId = await parseRouteId(props.params, "client ID")
  if (clientId instanceof NextResponse) return clientId

  const key = decodeKey(auth)
  const out = await testClientConnection(clientId, key)

  if ("error" in out) {
    log.warn(
      { route: "POST /api/clients/[id]/test", clientId, error: out.error },
      "client connection test failed"
    )
    return NextResponse.json({ error: out.error }, { status: out.status })
  }

  return NextResponse.json(out)
}
