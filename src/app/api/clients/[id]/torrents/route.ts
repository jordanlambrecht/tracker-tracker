// src/app/api/clients/[id]/torrents/route.ts
//
// Functions: GET

import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate, decodeKey, parseRouteId, type RouteContext } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { downloadClients } from "@/lib/db/schema"
import { createAdapterForClient, stripSensitiveTorrentFields } from "@/lib/download-clients"
import { classifyConnectionError, isDecryptionError } from "@/lib/error-utils"
import { log } from "@/lib/logger"

export async function GET(request: Request, props: RouteContext) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const clientId = await parseRouteId(props.params, "client ID")
  if (clientId instanceof NextResponse) return clientId

  const url = new URL(request.url)
  const tag = url.searchParams.get("tag")
  if (!tag?.trim()) {
    return NextResponse.json({ error: "tag query parameter is required" }, { status: 400 })
  }

  const [client] = await db
    .select({
      name: downloadClients.name,
      host: downloadClients.host,
      port: downloadClients.port,
      useSsl: downloadClients.useSsl,
      encryptedUsername: downloadClients.encryptedUsername,
      encryptedPassword: downloadClients.encryptedPassword,
      crossSeedTags: downloadClients.crossSeedTags,
      type: downloadClients.type,
    })
    .from(downloadClients)
    .where(eq(downloadClients.id, clientId))
    .limit(1)

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 })
  }

  const key = decodeKey(auth)

  try {
    const adapter = createAdapterForClient(client, key)
    const torrents = await adapter.getTorrents({ tag: tag.trim() })
    return NextResponse.json(torrents.map(stripSensitiveTorrentFields))
  } catch (error) {
    if (isDecryptionError(error)) {
      log.warn({ route: "GET /api/clients/[id]/torrents", clientId }, "failed — stale session key")
      return NextResponse.json({ error: "Session expired. Please log in again" }, { status: 401 })
    }
    const raw = error instanceof Error ? error.message : ""
    const detail = classifyConnectionError(raw)
    log.error(
      {
        route: "GET /api/clients/[id]/torrents",
        clientId,
        error: `Failed to fetch torrents${detail}`,
      },
      "torrent fetch failed"
    )
    return NextResponse.json(
      { error: `Failed to fetch torrents from client${detail}` },
      { status: 502 }
    )
  }
}
