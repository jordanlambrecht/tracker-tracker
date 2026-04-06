// src/app/api/trackers/[id]/avatar/route.ts
//
// Proxies a tracker's avatar image server-side so the browser never makes a
// direct request to the tracker (which would bypass SOCKS/HTTP proxy and leak IP).
// Caches as base64 in the DB; re-fetches weekly.

import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import {
  authenticate,
  decodeKey,
  parseTrackerId,
  type RouteContext,
  validateHttpUrl,
} from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { appSettings, trackers } from "@/lib/db/schema"
import { AVATAR_FETCH_MAX_BYTES } from "@/lib/limits"
import { log } from "@/lib/logger"
import { buildProxyAgentFromSettings, proxyFetch } from "@/lib/tunnel"

const STALE_MS = 7 * 24 * 60 * 60 * 1000

/** Detect image format from magic bytes. Falls back to image/png. */
function sniffImageMime(buf: Buffer): string {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg"
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png"
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return "image/gif"
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  )
    return "image/webp"
  if (
    buf[0] === 0x00 &&
    buf[1] === 0x00 &&
    buf[2] === 0x00 &&
    buf[4] === 0x66 &&
    buf[5] === 0x74 &&
    buf[6] === 0x79 &&
    buf[7] === 0x70
  )
    return "image/avif"
  return "image/png"
}

function avatarUrl(
  platformType: string,
  remoteUserId: number,
  avatarRemoteUrl?: string | null
): string | null {
  if (avatarRemoteUrl) return avatarRemoteUrl
  if (platformType === "ggn") {
    return `https://gazellegames.net/avatars/${remoteUserId}.png`
  }
  return null
}

export async function GET(_request: Request, props: RouteContext) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const trackerId = await parseTrackerId(props.params)
  if (trackerId instanceof NextResponse) return trackerId

  const [tracker] = await db
    .select({
      platformType: trackers.platformType,
      remoteUserId: trackers.remoteUserId,
      useProxy: trackers.useProxy,
      avatarData: trackers.avatarData,
      avatarMimeType: trackers.avatarMimeType,
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
          "Content-Type": tracker.avatarMimeType ?? "image/png",
          "Cache-Control": "private, max-age=86400",
        },
      })
    }
  }

  // Fetch from tracker
  try {
    let imageBuffer: Buffer
    let mimeType = "image/png"

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
        maxBytes: AVATAR_FETCH_MAX_BYTES,
        headers: { Accept: "image/*" },
      })

      if (!result.ok) {
        return NextResponse.json({ error: "Avatar not found" }, { status: 404 })
      }

      imageBuffer = await result.buffer()
      // proxyFetch doesn't expose content-type; sniff from magic bytes
      mimeType = sniffImageMime(imageBuffer)
    } else {
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) })
      if (!response.ok) {
        return NextResponse.json({ error: "Avatar not found" }, { status: 404 })
      }
      const contentLength = response.headers.get("content-length")
      if (contentLength && parseInt(contentLength, 10) > AVATAR_FETCH_MAX_BYTES) {
        return NextResponse.json({ error: "Avatar too large" }, { status: 413 })
      }
      imageBuffer = Buffer.from(await response.arrayBuffer())
      mimeType =
        response.headers.get("content-type")?.split(";")[0].trim() || sniffImageMime(imageBuffer)
    }

    if (imageBuffer.length > AVATAR_FETCH_MAX_BYTES) {
      return NextResponse.json({ error: "Avatar too large" }, { status: 413 })
    }

    // Cache in DB
    await db
      .update(trackers)
      .set({
        avatarData: imageBuffer.toString("base64"),
        avatarMimeType: mimeType,
        avatarCachedAt: new Date(),
      })
      .where(eq(trackers.id, trackerId))

    return new NextResponse(new Uint8Array(imageBuffer), {
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "private, max-age=86400",
      },
    })
  } catch {
    // If we have stale cache, serve it rather than failing
    if (tracker.avatarData) {
      log.warn(
        { route: "GET /api/trackers/[id]/avatar", trackerId },
        "avatar fetch failed — serving stale cache"
      )
      const data = Buffer.from(tracker.avatarData, "base64")
      return new NextResponse(new Uint8Array(data), {
        headers: {
          "Content-Type": tracker.avatarMimeType ?? "image/png",
          "Cache-Control": "private, max-age=3600",
        },
      })
    }
    log.error(
      { route: "GET /api/trackers/[id]/avatar", trackerId },
      "avatar fetch failed — no cache available"
    )
    return NextResponse.json({ error: "Failed to fetch avatar" }, { status: 502 })
  }
}
