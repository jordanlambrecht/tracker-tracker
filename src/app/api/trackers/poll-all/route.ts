// src/app/api/trackers/poll-all/route.ts
//
// Functions: POST
//
// Streams NDJSON progress as each tracker completes polling.
// First line: { "total": N }
// Per tracker: { "trackerId": N, "ok": bool }
// Final line:  { "done": true, "polled": N, "failed": N }
// Nothing to poll: one line, { "total": 0, "done": true, "polled": 0, "failed": 0 }

import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { trackerSiteFor } from "@/data/tracker-registry"
import { authenticate, decodeKey, refuseIfOutboundDisabled } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { appSettings, trackers } from "@/lib/db/schema"
import { log } from "@/lib/logger"
import { pollTracker } from "@/lib/tracker-scheduler"
import { buildProxyAgentFromSettings } from "@/lib/tunnel"

const NDJSON_HEADERS = { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache" }

export async function POST() {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth
  const refusal = refuseIfOutboundDisabled()
  if (refusal) return refusal

  const key = decodeKey(auth)

  const [[settings], activeTrackers] = await Promise.all([
    db
      .select({
        storeUsernames: appSettings.storeUsernames,
        proxyEnabled: appSettings.proxyEnabled,
        proxyType: appSettings.proxyType,
        proxyHost: appSettings.proxyHost,
        proxyPort: appSettings.proxyPort,
        proxyUsername: appSettings.proxyUsername,
        encryptedProxyPassword: appSettings.encryptedProxyPassword,
      })
      .from(appSettings)
      .limit(1),
    db
      .select({
        id: trackers.id,
        userPausedAt: trackers.userPausedAt,
        registrySlug: trackers.registrySlug,
      })
      .from(trackers)
      .where(eq(trackers.isActive, true)),
  ])

  // Failure-paused trackers stay in so poll all retries them.
  const trackersToPoll = activeTrackers.filter((t) => {
    if (t.userPausedAt) return false
    const site = trackerSiteFor(t)
    return site !== null && !site.entry.defunct
  })

  const privacyMode = settings ? !settings.storeUsernames : false
  const proxyAgent = settings ? buildProxyAgentFromSettings(settings, key) : undefined

  // One NDJSON line, newline and all, so the button reads it like the stream.
  if (trackersToPoll.length === 0) {
    const line = `${JSON.stringify({ total: 0, done: true, polled: 0, failed: 0 })}\n`
    return new Response(line, { headers: NDJSON_HEADERS })
  }

  log.info(
    {
      route: "POST /api/trackers/poll-all",
      count: trackersToPoll.length,
      skipped: activeTrackers.length - trackersToPoll.length,
    },
    "poll-all initiated"
  )

  const batchTimestamp = new Date()
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(`${JSON.stringify({ total: trackersToPoll.length })}\n`))

      let polled = 0
      let failed = 0

      const promises = trackersToPoll.map(async (t) => {
        try {
          await pollTracker(t.id, key, privacyMode, proxyAgent, batchTimestamp)
          polled++
          try {
            controller.enqueue(encoder.encode(`${JSON.stringify({ trackerId: t.id, ok: true })}\n`))
          } catch {
            /* security-audit-ignore: stream closed by client disconnect. Nothing to recover */
          }
        } catch {
          // security-audit-ignore: poll failure tracked via failed++ counter and streamed to client
          failed++
          try {
            controller.enqueue(
              encoder.encode(`${JSON.stringify({ trackerId: t.id, ok: false })}\n`)
            )
          } catch {
            /* security-audit-ignore: stream closed by client disconnect. Nothing to recover */
          }
        }
      })

      await Promise.allSettled(promises)

      try {
        controller.enqueue(encoder.encode(`${JSON.stringify({ done: true, polled, failed })}\n`))
        controller.close()
      } catch {
        /* security-audit-ignore: stream closed by client disconnect. Nothing to recover */
      }
    },
  })

  return new Response(stream, {
    headers: { ...NDJSON_HEADERS, "Transfer-Encoding": "chunked" },
  })
}
