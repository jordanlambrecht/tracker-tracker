// src/app/api/trackers/[id]/debug/route.ts
//
// Functions: POST
// Debug endpoint: fetches raw + normalized API response for a tracker.
// Scrubs sensitive fields before returning to the client.

import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate, decodeKey, parseTrackerId, type RouteContext } from "@/lib/api-helpers"
import { decrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { appSettings, trackers } from "@/lib/db/schema"
import { loadFlareSolverrConfig } from "@/lib/flaresolverr-config"
import { log } from "@/lib/logger"
import { scrubObject } from "@/lib/scrub-object"
import { buildFetchOptions, getAdapter } from "@/lib/tracker-platforms"
import { buildProxyAgentFromSettings } from "@/lib/tunnel"
import type { DebugApiCall, TrackerStats } from "@/types/tracker-stats"

function serializeStats(stats: TrackerStats): Record<string, unknown> {
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

  const trackerId = await parseTrackerId(props.params)
  if (trackerId instanceof NextResponse) return trackerId

  const key = decodeKey(auth)

  const [tracker] = await db
    .select({
      id: trackers.id,
      name: trackers.name,
      baseUrl: trackers.baseUrl,
      apiPath: trackers.apiPath,
      platformType: trackers.platformType,
      registrySlug: trackers.registrySlug,
      encryptedApiToken: trackers.encryptedApiToken,
      isActive: trackers.isActive,
      remoteUserId: trackers.remoteUserId,
      useProxy: trackers.useProxy,
      useFlaresolverr: trackers.useFlaresolverr,
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

  const proxyAgent = settings ? buildProxyAgentFromSettings(settings, key) : undefined

  const flaresolverr = tracker.useFlaresolverr
    ? ((await loadFlareSolverrConfig()) ?? undefined)
    : undefined
  if (tracker.useFlaresolverr && !flaresolverr) {
    return NextResponse.json(
      { error: "FlareSolverr is enabled for this tracker but not set up in Settings" },
      { status: 400 }
    )
  }

  if (tracker.useProxy && !proxyAgent && !flaresolverr) {
    return NextResponse.json(
      { error: "Proxy required but not configured, refusing direct connection" },
      { status: 400 }
    )
  }

  const fetchOptions = buildFetchOptions({
    registrySlug: tracker.registrySlug,
    proxyAgent: tracker.useProxy ? proxyAgent : undefined,
    remoteUserId: tracker.remoteUserId ?? undefined,
    flaresolverr,
  })

  const adapter = getAdapter(tracker.platformType)

  let apiCalls: DebugApiCall[] | null = null
  let rawError: string | null = null

  try {
    const calls = await adapter.fetchRaw(tracker.baseUrl, apiToken, tracker.apiPath, fetchOptions)
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
    const stats = await adapter.fetchStats(tracker.baseUrl, apiToken, tracker.apiPath, fetchOptions)
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
    platform: tracker.platformType,
    trackerName: tracker.name,
  })
}
