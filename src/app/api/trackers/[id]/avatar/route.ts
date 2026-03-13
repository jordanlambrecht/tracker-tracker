// src/app/api/trackers/[id]/avatar/route.ts
//
// Proxies a tracker's avatar image server-side so the browser never makes a
// direct request to the tracker (which would bypass SOCKS/HTTP proxy and leak IP).
// Caches as base64 in the DB; re-fetches weekly.

import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate, decodeKey, parseTrackerId, validateHttpUrl } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { appSettings, trackers } from "@/lib/db/schema"
import { buildProxyAgentFromSettings, proxyFetch } from "@/lib/proxy"

const STALE_MS = 7 * 24 * 60 * 60 * 1000
const MAX_AVATAR_BYTES = 5 * 1024 * 1024

function avatarUrl(platformType: string, remoteUserId: number, avatarRemoteUrl?: string | null): string | null {
  if (avatarRemoteUrl) return avatarRemoteUrl
  if (platformType === "ggn") {
    return `https://gazellegames.net/avatars/${remoteUserId}.png`
  }
  return null
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const trackerId = await parseTrackerId(params)
  if (trackerId instanceof NextResponse) return trackerId

  const [tracker] = await db
    .select({
      platformType: trackers.platformType,
      remoteUserId: trackers.remoteUserId,
      useProxy: trackers.useProxy,
      avatarData: trackers.avatarData,
      avatarCachedAt: trackers.avatarCachedAt,
      avatarRemoteUrl: trackers.avatarRemoteUrl,
    })
    .from(trackers)
    .where(eq(trackers.id, trackerId))
    .limit(1)

  if (!tracker?.remoteUserId) {
    return NextResponse.json({ error: "No avatar available" }, { status: 404 })
  }

  const url = avatarUrl(tracker.platformType, tracker.remoteUserId, tracker.avatarRemoteUrl)
  if (!url) {
    return NextResponse.json({ error: "Platform does not support avatars" }, { status: 404 })
  }

  const urlErr = validateHttpUrl(url)
  if (urlErr) {
    return NextResponse.json({ error: "Invalid avatar URL" }, { status: 400 })
  }

  // Serve from DB cache if fresh
  if (tracker.avatarData && tracker.avatarCachedAt) {
    const age = Date.now() - tracker.avatarCachedAt.getTime()
    if (age < STALE_MS) {
      const data = Buffer.from(tracker.avatarData, "base64")
      return new NextResponse(new Uint8Array(data), {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "private, max-age=86400",
        },
      })
    }
  }

  // Fetch from tracker
  try {
    let imageBuffer: Buffer

    if (tracker.useProxy) {
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

      const key = decodeKey(auth)
      const agent = settings ? buildProxyAgentFromSettings(settings, key) : undefined

      if (!agent) {
        return NextResponse.json({ error: "Proxy required but not configured" }, { status: 503 })
      }

      const result = await proxyFetch(url, agent, {
        timeoutMs: 10000,
        maxBytes: MAX_AVATAR_BYTES,
        headers: { Accept: "image/png,image/*" },
      })

      if (!result.ok) {
        return NextResponse.json({ error: "Avatar not found" }, { status: 404 })
      }

      imageBuffer = await result.buffer()
    } else {
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) })
      if (!response.ok) {
        return NextResponse.json({ error: "Avatar not found" }, { status: 404 })
      }
      const contentLength = response.headers.get("content-length")
      if (contentLength && parseInt(contentLength, 10) > MAX_AVATAR_BYTES) {
        return NextResponse.json({ error: "Avatar too large" }, { status: 413 })
      }
      imageBuffer = Buffer.from(await response.arrayBuffer())
    }

    if (imageBuffer.length > MAX_AVATAR_BYTES) {
      return NextResponse.json({ error: "Avatar too large" }, { status: 413 })
    }

    // Cache in DB
    await db
      .update(trackers)
      .set({
        avatarData: imageBuffer.toString("base64"),
        avatarCachedAt: new Date(),
      })
      .where(eq(trackers.id, trackerId))

    return new NextResponse(new Uint8Array(imageBuffer), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, max-age=86400",
      },
    })
  } catch {
    // If we have stale cache, serve it rather than failing
    if (tracker.avatarData) {
      const data = Buffer.from(tracker.avatarData, "base64")
      return new NextResponse(new Uint8Array(data), {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "private, max-age=3600",
        },
      })
    }
    return NextResponse.json({ error: "Failed to fetch avatar" }, { status: 502 })
  }
}
