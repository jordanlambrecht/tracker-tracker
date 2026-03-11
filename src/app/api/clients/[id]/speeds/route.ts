// src/app/api/clients/[id]/speeds/route.ts

import { NextResponse } from "next/server"
import { authenticate, parseRouteId } from "@/lib/api-helpers"
import { getSpeedSnapshots } from "@/lib/qbt"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const clientId = await parseRouteId(params, "client ID")
  if (clientId instanceof NextResponse) return clientId

  return NextResponse.json(getSpeedSnapshots(clientId))
}
