// src/app/api/clients/[id]/speeds/route.ts

import { NextResponse } from "next/server"
import { authenticate, parseRouteId, type RouteContext } from "@/lib/api-helpers"
import { getSpeedSnapshots } from "@/lib/download-clients"

export async function GET(_request: Request, props: RouteContext) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const clientId = await parseRouteId(props.params, "client ID")
  if (clientId instanceof NextResponse) return clientId

  return NextResponse.json(getSpeedSnapshots(clientId))
}
