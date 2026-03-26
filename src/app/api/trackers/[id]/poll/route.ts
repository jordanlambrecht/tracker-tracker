// src/app/api/trackers/[id]/poll/route.ts
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate, decodeKey, parseTrackerId } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { appSettings, trackers } from "@/lib/db/schema"
import { isDecryptionError } from "@/lib/error-utils"
import { log } from "@/lib/logger"
import { buildProxyAgentFromSettings } from "@/lib/proxy"
import { pollTracker } from "@/lib/scheduler"

const POLL_COOLDOWN_MS = 10_000

export async function POST(_request: Request, props: { params: Promise<{ id: string }> }) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const trackerId = await parseTrackerId(props.params)
  if (trackerId instanceof NextResponse) return trackerId

  // Rate limit: reject if this tracker was polled within the last 60 seconds
  const [tracker] = await db
    .select({ lastPolledAt: trackers.lastPolledAt })
    .from(trackers)
    .where(eq(trackers.id, trackerId))
    .limit(1)

  if (tracker?.lastPolledAt) {
    const elapsed = Date.now() - tracker.lastPolledAt.getTime()
    if (elapsed < POLL_COOLDOWN_MS) {
      const waitSec = Math.ceil((POLL_COOLDOWN_MS - elapsed) / 1000)
      return NextResponse.json(
        { error: `Poll cooldown: try again in ${waitSec}s` },
        { status: 429 }
      )
    }
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
    const message = error instanceof Error ? error.message : "Poll failed"
    log.error(
      { route: "POST /api/trackers/[id]/poll", trackerId, error: message },
      "manual poll failed"
    )
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
