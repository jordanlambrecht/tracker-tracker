// src/app/api/fleet/torrents/route.ts
//
// Functions: GET
//
// Returns merged torrent list across all download clients and all tracker tags.
// Uses Promise.allSettled for resilience — one failed client doesn't block others.

import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate, decodeKey } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { downloadClients, trackers } from "@/lib/db/schema"
import { log } from "@/lib/logger"
import { fetchAndMergeTorrents } from "@/lib/qbt/fetch-merged"

export async function GET() {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth
  const key = decodeKey(auth)

  const [allTrackers, clients] = await Promise.all([
    db.select({ qbtTag: trackers.qbtTag }).from(trackers).where(eq(trackers.isActive, true)),
    db
      .select({
        name: downloadClients.name,
        host: downloadClients.host,
        port: downloadClients.port,
        useSsl: downloadClients.useSsl,
        encryptedUsername: downloadClients.encryptedUsername,
        encryptedPassword: downloadClients.encryptedPassword,
        crossSeedTags: downloadClients.crossSeedTags,
      })
      .from(downloadClients)
      .where(eq(downloadClients.enabled, true)),
  ])

  const tags = [
    ...new Set(
      allTrackers
        .map((t) => t.qbtTag)
        .filter((t): t is string => t !== null && t.trim() !== "")
        .map((t) => t.trim())
    ),
  ]

  const result = await fetchAndMergeTorrents(clients, tags, key)

  if (result.sessionExpired) {
    log.warn({ route: "GET /api/fleet/torrents" }, "fleet fetch failed — stale session key")
    return NextResponse.json({ error: "Session expired — please log in again" }, { status: 401 })
  }

  return NextResponse.json(result)
}
