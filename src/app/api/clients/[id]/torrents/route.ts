// src/app/api/clients/[id]/torrents/route.ts
//
// Functions: GET

import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate, decodeKey, parseRouteId } from "@/lib/api-helpers"
import { log } from "@/lib/logger"
import { decryptClientCredentials } from "@/lib/client-decrypt"
import { db } from "@/lib/db"
import { downloadClients } from "@/lib/db/schema"
import { getTorrents, withSessionRetry } from "@/lib/qbt"

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const clientId = await parseRouteId(props.params, "client ID")
  if (clientId instanceof NextResponse) return clientId

  const url = new URL(request.url)
  const tag = url.searchParams.get("tag")
  if (!tag || !tag.trim()) {
    return NextResponse.json({ error: "tag query parameter is required" }, { status: 400 })
  }

  const [client] = await db
    .select()
    .from(downloadClients)
    .where(eq(downloadClients.id, clientId))
    .limit(1)

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 })
  }

  const key = decodeKey(auth)

  let username: string
  let password: string
  try {
    ;({ username, password } = decryptClientCredentials(client, key))
  } catch {
    log.error({ route: "GET /api/clients/[id]/torrents", clientId }, "torrent fetch failed — credential decrypt error")
    return NextResponse.json({ error: "Failed to decrypt credentials" }, { status: 422 })
  }

  try {
    const torrents = await withSessionRetry(
      client.host,
      client.port,
      client.useSsl,
      username,
      password,
      (baseUrl, sid) => getTorrents(baseUrl, sid, tag.trim())
    )
    return NextResponse.json(torrents)
  } catch (error) {
    const raw = error instanceof Error ? error.message : ""
    let detail = ""
    if (/timed?\s*out/i.test(raw)) detail = " (timed out)"
    else if (/ECONNREFUSED/i.test(raw)) detail = " (ECONNREFUSED)"
    else if (/403/.test(raw)) detail = " (403)"
    log.error({ route: "GET /api/clients/[id]/torrents", clientId, error: `Failed to fetch torrents${detail}` }, "torrent fetch failed")
    return NextResponse.json(
      { error: `Failed to fetch torrents from client${detail}` },
      { status: 502 }
    )
  }
}
