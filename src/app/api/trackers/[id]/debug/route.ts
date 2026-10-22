// src/app/api/trackers/[id]/debug/route.ts
//
// Functions: POST
// Debug endpoint: fetches raw + normalized API response for a tracker.
// Scrubs sensitive fields before returning to the client.

import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { trackerSiteFor } from "@/data/tracker-registry"
import {
  authenticate,
  decodeKey,
  parseTrackerId,
  type RouteContext,
  refuseIfOutboundDisabled,
} from "@/lib/api-helpers"
import { decrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { appSettings, trackers } from "@/lib/db/schema"
import { log } from "@/lib/logger"
import { scrubObject } from "@/lib/scrub-object"
import { buildFetchOptions, getAdapter } from "@/lib/tracker-platforms"
import { TRACKER_DEFUNCT_ERROR, TRACKER_UNLINKED_ERROR } from "@/lib/tracker-status"
import { buildProxyAgentFromSettings } from "@/lib/tunnel"
import { type DebugApiCall, isTrackerOverview, type TrackerPollResult } from "@/types/tracker-stats"

function serializeStats(stats: TrackerPollResult): Record<string, unknown> {
  if (isTrackerOverview(stats)) {
    return {
      kind: stats.kind,
      username: stats.username,
      group: stats.group,
      remoteUserId: stats.remoteUserId ?? null,
      joinedDate: stats.joinedDate ?? null,
      lastAccessDate: stats.lastAccessDate ?? null,
      avatarUrl: stats.avatarUrl ?? null,
      platformMeta: stats.platformMeta ?? null,
    }
  }
  return {
    username: stats.username,
    group: stats.group,
    uploadedBytes: stats.uploadedBytes.toString(),
    downloadedBytes: stats.downloadedBytes.toString(),
    ratio: stats.ratio,
    bufferBytes: stats.bufferBytes.toString(),
    seedingCount: stats.seedingCount,
    leechingCount: stats.leechingCount,
    seedbonus: stats.seedbonus,
    hitAndRuns: stats.hitAndRuns,
    requiredRatio: stats.requiredRatio,
    warned: stats.warned,
    freeleechTokens: stats.freeleechTokens,
    remoteUserId: stats.remoteUserId ?? null,
    joinedDate: stats.joinedDate ?? null,
    lastAccessDate: stats.lastAccessDate ?? null,
    shareScore: stats.shareScore ?? null,
    avatarUrl: stats.avatarUrl ?? null,
    platformMeta: stats.platformMeta ?? null,
  }
}

export async function POST(_request: Request, props: RouteContext) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth
  const refusal = refuseIfOutboundDisabled()
  if (refusal) return refusal

  const trackerId = await parseTrackerId(props.params)
  if (trackerId instanceof NextResponse) return trackerId

  const key = decodeKey(auth)

  const [tracker] = await db
    .select({
      id: trackers.id,
      name: trackers.name,
      registrySlug: trackers.registrySlug,
      encryptedApiToken: trackers.encryptedApiToken,
      isActive: trackers.isActive,
      remoteUserId: trackers.remoteUserId,
      useProxy: trackers.useProxy,
    })
    .from(trackers)
    .where(eq(trackers.id, trackerId))
    .limit(1)

  if (!tracker) {
    return NextResponse.json({ error: "Tracker not found" }, { status: 404 })
  }

  if (!tracker.isActive) {
    return NextResponse.json({ error: "Tracker is archived" }, { status: 400 })
  }

  // A debug call sends the token, so only to an address from the tracker list.
  const site = trackerSiteFor(tracker)
  if (!site) {
    return NextResponse.json({ error: TRACKER_UNLINKED_ERROR }, { status: 400 })
  }
  if (site.entry.defunct) {
    return NextResponse.json({ error: TRACKER_DEFUNCT_ERROR }, { status: 400 })
  }

  const [settings] = await db
    .select({
      proxyEnabled: appSettings.proxyEnabled,
      proxyType: appSettings.proxyType,
      proxyHost: appSettings.proxyHost,
      proxyPort: appSettings.proxyPort,
      proxyUsername: appSettings.proxyUsername,
      encryptedProxyPassword: appSettings.encryptedProxyPassword,
    })
    .from(appSettings)
    .limit(1)

  let apiToken: string
  try {
    apiToken = decrypt(tracker.encryptedApiToken, key)
  } catch {
    return NextResponse.json(
      { error: `API key is missing or invalid for tracker "${tracker.name}"` },
      { status: 400 }
    )
  }
  // An empty token decrypts cleanly but can never authenticate, the same outcome
  // as an undecryptable one, so report it identically rather than round-tripping
  // to the tracker for a guaranteed 401.
  if (!apiToken) {
    return NextResponse.json(
      { error: `API key is missing or invalid for tracker "${tracker.name}"` },
      { status: 400 }
    )
  }

  // Undefined while the proxy is off, when a row set to use it goes direct.
  const proxyAgent = settings ? buildProxyAgentFromSettings(settings, key) : undefined

  const fetchOptions = buildFetchOptions({
    entry: site.entry,
    proxyAgent: tracker.useProxy ? proxyAgent : undefined,
    remoteUserId: tracker.remoteUserId ?? undefined,
  })

  const adapter = getAdapter(site.platform)

  let apiCalls: DebugApiCall[] | null = null
  let rawError: string | null = null

  try {
    const calls = await adapter.fetchRaw(site.url, apiToken, site.apiPath, fetchOptions)
    apiCalls = calls.map((call) => ({
      ...call,
      data: call.data ? scrubObject(call.data) : null,
    }))
  } catch (err) {
    // security-audit-ignore: error captured in rawError for debug response
    rawError = err instanceof Error ? err.message : "Raw fetch failed"
    log.warn(
      { route: "POST /api/trackers/[id]/debug", trackerId, error: rawError },
      "debug raw fetch failed"
    )
  }

  let normalizedResponse: Record<string, unknown> | null = null
  let normalizedError: string | null = null

  try {
    const stats = await adapter.fetchStats(site.url, apiToken, site.apiPath, fetchOptions)
    normalizedResponse = serializeStats(stats)
  } catch (err) {
    normalizedError = err instanceof Error ? err.message : "Normalized fetch failed"
    log.warn(
      { route: "POST /api/trackers/[id]/debug", trackerId, error: normalizedError },
      "debug normalized fetch failed"
    )
  }

  return NextResponse.json({
    apiCalls,
    rawError,
    normalized: normalizedResponse,
    normalizedError,
    platform: site.platform,
    trackerName: tracker.name,
  })
}
