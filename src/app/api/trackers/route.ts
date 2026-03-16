// src/app/api/trackers/route.ts
//
// Functions: GET, POST

import { sql } from "drizzle-orm"
import { NextResponse } from "next/server"
import { CHART_THEME } from "@/components/charts/theme"
import { DEFAULT_API_PATHS, VALID_PLATFORM_TYPES } from "@/lib/adapters"
import {
  authenticate,
  decodeKey,
  parseJsonBody,
  validateHexColor,
  validateHttpUrl,
} from "@/lib/api-helpers"
import { encrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { appSettings, trackerSnapshots, trackers } from "@/lib/db/schema"
import { createPrivacyMaskSync } from "@/lib/privacy-db"
import { serializeTrackerResponse } from "@/lib/tracker-serializer"

export async function GET() {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const [allTrackers, [privacySettings]] = await Promise.all([
    db.select().from(trackers).orderBy(trackers.createdAt),
    db.select({ storeUsernames: appSettings.storeUsernames }).from(appSettings).limit(1),
  ])

  // Enforce masking at response time — even if DB has plaintext from before
  // privacy was enabled, the API never leaks it when privacy mode is on.
  // Fallback true = "store usernames" = no masking. Matches createPrivacyMask()
  // behavior when no settings row exists. Do NOT change to false.
  const mask = createPrivacyMaskSync(privacySettings?.storeUsernames ?? true)

  // Batch-fetch the latest snapshot per tracker using a single query.
  const latestSnapshots = await db
    .select()
    .from(trackerSnapshots)
    .where(
      sql`(${trackerSnapshots.trackerId}, ${trackerSnapshots.polledAt}) IN (
        SELECT ${trackerSnapshots.trackerId}, MAX(${trackerSnapshots.polledAt})
        FROM ${trackerSnapshots}
        GROUP BY ${trackerSnapshots.trackerId}
      )`
    )

  // Build a lookup map for O(1) access
  const snapshotByTracker = new Map(latestSnapshots.map((s) => [s.trackerId, s]))

  // SECURITY: Never include encryptedApiToken in response
  // security-audit-ignore: serializeTrackerResponse omits encryptedApiToken by design
  const trackersWithStats = allTrackers.map((tracker) => {
    const latest = snapshotByTracker.get(tracker.id) ?? null
    return serializeTrackerResponse(tracker, latest, mask)
  })

  return NextResponse.json(trackersWithStats)
}

export async function POST(request: Request) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const body = await parseJsonBody(request)
  if (body instanceof NextResponse) return body

  const { name, baseUrl, apiToken, platformType, color, qbtTag, joinedAt } = body as {
    name?: string
    baseUrl?: string
    apiToken?: string
    platformType?: string
    color?: string
    qbtTag?: string
    joinedAt?: string
  }

  if (
    typeof name !== "string" ||
    typeof baseUrl !== "string" ||
    typeof apiToken !== "string" ||
    !name.trim() ||
    !baseUrl.trim() ||
    !apiToken.trim()
  ) {
    return NextResponse.json(
      { error: "name, baseUrl, and apiToken are required strings" },
      { status: 400 }
    )
  }

  if (name.length > 100) {
    return NextResponse.json({ error: "Name must be 100 characters or fewer" }, { status: 400 })
  }

  if (baseUrl.length > 500) {
    return NextResponse.json({ error: "URL must be 500 characters or fewer" }, { status: 400 })
  }

  if (apiToken.length > 500) {
    return NextResponse.json(
      { error: "API token must be 500 characters or fewer" },
      { status: 400 }
    )
  }

  const urlErr = validateHttpUrl(baseUrl)
  if (urlErr) return urlErr

  if (typeof color === "string") {
    const colorErr = validateHexColor(color)
    if (colorErr) return colorErr
  }

  if (typeof qbtTag === "string" && qbtTag.length > 100) {
    return NextResponse.json(
      { error: "qBittorrent tag must be 100 characters or fewer" },
      { status: 400 }
    )
  }

  if (typeof joinedAt === "string" && joinedAt) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(joinedAt)) {
      return NextResponse.json({ error: "joinedAt must be YYYY-MM-DD" }, { status: 400 })
    }
    if (joinedAt > new Date().toISOString().split("T")[0]) {
      return NextResponse.json({ error: "Join date cannot be in the future" }, { status: 400 })
    }
  }

  const platform = typeof platformType === "string" ? platformType : "unit3d"
  if (!VALID_PLATFORM_TYPES.includes(platform as (typeof VALID_PLATFORM_TYPES)[number])) {
    return NextResponse.json({ error: "Invalid platform type" }, { status: 400 })
  }

  const key = decodeKey(auth)
  const encryptedApiToken = encrypt(apiToken.trim(), key)

  const [tracker] = await db
    .insert(trackers)
    .values({
      name: name.trim(),
      baseUrl: baseUrl.trim(),
      apiPath: DEFAULT_API_PATHS[platform] ?? "/api/user",
      encryptedApiToken,
      platformType: platform,
      color: (color as string) || CHART_THEME.accent,
      qbtTag: typeof qbtTag === "string" ? qbtTag.trim() : null,
      joinedAt: typeof joinedAt === "string" && joinedAt ? joinedAt : null,
    })
    .returning()

  // SECURITY: Only return safe fields
  return NextResponse.json({ id: tracker.id, name: tracker.name }, { status: 201 })
}
