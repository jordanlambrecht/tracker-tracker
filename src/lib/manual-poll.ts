// src/lib/manual-poll.ts
//
// Functions: releaseClaim, runManualPoll

import { and, eq, isNull, lte, or } from "drizzle-orm"
import { trackerSiteFor } from "@/data/tracker-registry"
import { db } from "@/lib/db"
import { appSettings, trackers } from "@/lib/db/schema"
import { POLL_MANUAL_COOLDOWN_MS } from "@/lib/limits"
import { log } from "@/lib/logger"
import { pollTracker } from "@/lib/tracker-scheduler"
import { TRACKER_DEFUNCT_ERROR, TRACKER_UNLINKED_ERROR } from "@/lib/tracker-status"
import { buildProxyAgentFromSettings } from "@/lib/tunnel"

export type ManualPollResult =
  { ok: true; polled: boolean } | { ok: false; status: number; error: string }

// The claim holds lastPolledAt only as a cooldown. A poll that didn't succeed
// hands back the time it replaced, unless a poll that did has written it since.
async function releaseClaim(
  route: string,
  trackerId: number,
  claimedAt: Date,
  previous: Date | null
) {
  try {
    await db
      .update(trackers)
      .set({ lastPolledAt: previous })
      .where(and(eq(trackers.id, trackerId), eq(trackers.lastPolledAt, claimedAt)))
  } catch (error) {
    log.error({ route, trackerId, error: String(error) }, "manual poll cooldown not released")
  }
}

/**
 * Runs a poll the user requested, as Poll Now does: at most one per tracker per
 * cooldown, claimed with an atomic update so that several tabs cannot start
 * overlapping polls. pollTracker records a failed poll on the row itself, so
 * polled says whether it succeeded and only a database fault is an error here.
 */
export async function runManualPoll(
  trackerId: number,
  key: Buffer,
  route: string
): Promise<ManualPollResult> {
  // Refused before the claim, so a refusal never starts the cooldown.
  const [tracker] = await db
    .select({ registrySlug: trackers.registrySlug, lastPolledAt: trackers.lastPolledAt })
    .from(trackers)
    .where(eq(trackers.id, trackerId))
    .limit(1)
  if (!tracker) return { ok: false, status: 404, error: "Tracker not found" }
  const site = trackerSiteFor(tracker)
  if (!site) return { ok: false, status: 400, error: TRACKER_UNLINKED_ERROR }
  if (site.entry.defunct) return { ok: false, status: 400, error: TRACKER_DEFUNCT_ERROR }

  // Atomically claim poll slot. Prevents TOCTOU race with multiple tabs
  const threshold = new Date(Date.now() - POLL_MANUAL_COOLDOWN_MS)
  const claimedAt = new Date()
  const [claimed] = await db
    .update(trackers)
    .set({ lastPolledAt: claimedAt })
    .where(
      and(
        eq(trackers.id, trackerId),
        or(isNull(trackers.lastPolledAt), lte(trackers.lastPolledAt, threshold))
      )
    )
    .returning({ id: trackers.id })

  if (!claimed) {
    return { ok: false, status: 429, error: "Polled a moment ago. Try again in a few seconds" }
  }

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

  let polled = false
  try {
    polled = await pollTracker(trackerId, key, privacyMode, proxyAgent, undefined, undefined, true)
    return { ok: true, polled }
  } catch (error) {
    log.error({ route, trackerId, error: String(error) }, "manual poll failed")
    return { ok: false, status: 500, error: "Poll failed" }
  } finally {
    if (!polled) await releaseClaim(route, trackerId, claimedAt, tracker.lastPolledAt)
  }
}
