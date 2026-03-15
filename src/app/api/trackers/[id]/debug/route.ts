// src/app/api/trackers/[id]/debug/route.ts
//
// Functions: POST
// Debug endpoint: fetches raw + normalized API response for a tracker.
// Scrubs sensitive fields before returning to the client.

import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { findRegistryEntry } from "@/data/tracker-registry"
import { getAdapter } from "@/lib/adapters"
import type { TrackerStats } from "@/lib/adapters/types"
import { authenticate, decodeKey, parseTrackerId } from "@/lib/api-helpers"
import { decrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { appSettings, trackers } from "@/lib/db/schema"
import { buildProxyAgentFromSettings } from "@/lib/proxy"

// Top-level keys to scrub from raw response objects (auth tokens, passkeys, IPs)
const SCRUB_KEYS = new Set(["authkey", "passkey", "ip", "api_token", "key", "torrent_pass"])

function scrubObject(obj: unknown, depth = 0): unknown {
  if (depth > 10) return obj
  if (obj === null || typeof obj !== "object") return obj
  if (Array.isArray(obj)) {
    return obj.map((item) => scrubObject(item, depth + 1))
  }
  const result: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (SCRUB_KEYS.has(k.toLowerCase())) {
      result[k] = "[redacted]"
    } else {
      result[k] = scrubObject(v, depth + 1)
    }
  }
  return result
}

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
    shareScore: stats.shareScore ?? null,
    avatarUrl: stats.avatarUrl ?? null,
    platformMeta: stats.platformMeta ?? null,
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const trackerId = await parseTrackerId(params)
  if (trackerId instanceof NextResponse) return trackerId

  const key = decodeKey(auth)

  const [tracker] = await db
    .select({
      id: trackers.id,
      name: trackers.name,
      baseUrl: trackers.baseUrl,
      apiPath: trackers.apiPath,
      platformType: trackers.platformType,
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

  const proxyAgent = settings ? buildProxyAgentFromSettings(settings, key) : undefined

  const fetchOptions: {
    proxyAgent?: typeof proxyAgent
    remoteUserId?: number
    authStyle?: "token" | "raw"
    enrich?: boolean
  } = {}

  if (tracker.useProxy) {
    if (!proxyAgent) {
      return NextResponse.json(
        { error: "Proxy required but not configured — refusing direct connection" },
        { status: 400 }
      )
    }
    fetchOptions.proxyAgent = proxyAgent
  }

  if (tracker.remoteUserId) fetchOptions.remoteUserId = tracker.remoteUserId

  const registryEntry = findRegistryEntry(tracker.baseUrl)
  if (registryEntry?.gazelleAuthStyle) fetchOptions.authStyle = registryEntry.gazelleAuthStyle
  if (registryEntry?.gazelleEnrich) fetchOptions.enrich = true

  const adapter = getAdapter(tracker.platformType)

  let rawResponse: Record<string, unknown> | null = null
  let rawError: string | null = null

  if (adapter.fetchRaw) {
    try {
      const raw = await adapter.fetchRaw(tracker.baseUrl, apiToken, tracker.apiPath, fetchOptions)
      rawResponse = scrubObject(raw) as Record<string, unknown>
    } catch (err) { // security-audit-ignore: error captured in rawError for debug response
      rawError = err instanceof Error ? err.message : "Raw fetch failed"
    }
  } else {
    rawError = `fetchRaw not implemented for platform: ${tracker.platformType}`
  }

  let normalizedResponse: Record<string, unknown> | null = null
  let normalizedError: string | null = null

  try {
    const stats = await adapter.fetchStats(tracker.baseUrl, apiToken, tracker.apiPath, fetchOptions)
    normalizedResponse = serializeStats(stats)
  } catch (err) {
    normalizedError = err instanceof Error ? err.message : "Normalized fetch failed"
  }

  return NextResponse.json({
    raw: rawResponse,
    rawError,
    normalized: normalizedResponse,
    normalizedError,
    platform: tracker.platformType,
    trackerName: tracker.name,
  })
}
