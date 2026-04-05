// src/app/api/trackers/[id]/poll/route.ts
import { and, eq, sql } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate, decodeKey, parseTrackerId, type RouteContext } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { appSettings, trackers } from "@/lib/db/schema"
import { isDecryptionError } from "@/lib/error-utils"
import { log } from "@/lib/logger"
import { pollTracker } from "@/lib/scheduler"
import { buildProxyAgentFromSettings } from "@/lib/tunnel"

const POLL_COOLDOWN_MS = 10_000

export async function POST(_request: Request, props: RouteContext) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const trackerId = await parseTrackerId(props.params)
  if (trackerId instanceof NextResponse) return trackerId

  // Atomically claim poll slot — prevents TOCTOU race with multiple tabs
  const threshold = new Date(Date.now() - POLL_COOLDOWN_MS)
  const [claimed] = await db
    .update(trackers)
    .set({ lastPolledAt: new Date() })
    .where(
      and(
        eq(trackers.id, trackerId),
        sql`(${trackers.lastPolledAt} IS NULL OR ${trackers.lastPolledAt} <= ${threshold})`
      )
    )
    .returning({ id: trackers.id })

  if (!claimed) {
    return NextResponse.json(
      { error: "Poll cooldown: try again in a few seconds" },
      { status: 429 }
    )
  }

  const key = decodeKey(auth)

  const [settings] = await db
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
    .limit(1)

  const privacyMode = settings ? !settings.storeUsernames : false
  const proxyAgent = settings ? buildProxyAgentFromSettings(settings, key) : undefined

  try {
    await pollTracker(trackerId, key, privacyMode, proxyAgent)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (isDecryptionError(error)) {
      log.warn(
        { route: "POST /api/trackers/[id]/poll", trackerId },
        "manual poll failed — stale session key"
      )
      return NextResponse.json({ error: "Session expired — please log in again" }, { status: 401 })
    }
    log.error(
      { route: "POST /api/trackers/[id]/poll", trackerId, error: String(error) },
      "manual poll failed"
    )
    return NextResponse.json({ error: "Poll failed" }, { status: 500 })
  }
}
