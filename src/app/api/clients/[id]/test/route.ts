// src/app/api/clients/[id]/test/route.ts
//
// Functions: POST

import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate, decodeKey, parseRouteId } from "@/lib/api-helpers"
import { decryptClientCredentials } from "@/lib/client-decrypt"
import { db } from "@/lib/db"
import { downloadClients } from "@/lib/db/schema"
import { isDecryptionError } from "@/lib/error-utils"
import { log } from "@/lib/logger"
import { buildBaseUrl, getTransferInfo, invalidateSession, login } from "@/lib/qbt"

export async function POST(_request: Request, props: { params: Promise<{ id: string }> }) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const clientId = await parseRouteId(props.params, "client ID")
  if (clientId instanceof NextResponse) return clientId

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
  } catch (err) {
    if (isDecryptionError(err)) {
      log.warn(
        { route: "POST /api/clients/[id]/test", clientId },
        "client test failed — stale session key"
      )
      return NextResponse.json({ error: "Session expired — please log in again" }, { status: 401 })
    }
    log.error(
      { route: "POST /api/clients/[id]/test", clientId },
      "client test failed — credential decrypt error"
    )
    return NextResponse.json({ error: "Failed to decrypt credentials" }, { status: 422 })
  }

  try {
    // Force a fresh login for explicit connection tests — don't use cached SID
    const baseUrl = buildBaseUrl(client.host, client.port, client.useSsl)
    invalidateSession(baseUrl)
    const sid = await login(client.host, client.port, client.useSsl, username, password)
    await getTransferInfo(baseUrl, sid)
    return NextResponse.json({ success: true })
  } catch (error) {
    const raw = error instanceof Error ? error.message : ""
    let detail = ""
    if (/timed?\s*out/i.test(raw)) detail = " (timed out)"
    else if (/ECONNREFUSED/i.test(raw)) detail = " (ECONNREFUSED)"
    else if (/403/.test(raw)) detail = " (403)"
    log.warn(
      { route: "POST /api/clients/[id]/test", clientId, error: `Connection test failed${detail}` },
      "client connection test failed"
    )
    return NextResponse.json({ error: `Connection test failed${detail}` }, { status: 422 })
  }
}
