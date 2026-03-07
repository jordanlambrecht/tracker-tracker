// src/app/api/trackers/route.ts
//
// Functions: GET, POST

import { desc, eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { encrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { trackerSnapshots, trackers } from "@/lib/db/schema"

export async function GET() {
  try {
    await requireAuth()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const allTrackers = await db.select().from(trackers).orderBy(trackers.name)

  // Get latest snapshot for each tracker (for sidebar ratio display)
  const trackersWithStats = await Promise.all(
    allTrackers.map(async (tracker) => {
      const [latest] = await db
        .select()
        .from(trackerSnapshots)
        .where(eq(trackerSnapshots.trackerId, tracker.id))
        .orderBy(desc(trackerSnapshots.polledAt))
        .limit(1)

      // SECURITY: Never include encryptedApiToken in response
      return {
        id: tracker.id,
        name: tracker.name,
        baseUrl: tracker.baseUrl,
        platformType: tracker.platformType,
        pollIntervalMinutes: tracker.pollIntervalMinutes,
        isActive: tracker.isActive,
        lastPolledAt: tracker.lastPolledAt,
        lastError: tracker.lastError,
        color: tracker.color,
        latestStats: latest
          ? {
              ratio: latest.ratio,
              uploadedBytes: latest.uploadedBytes?.toString(),
              downloadedBytes: latest.downloadedBytes?.toString(),
              seedingCount: latest.seedingCount,
              leechingCount: latest.leechingCount,
              username: latest.username,
              group: latest.group,
            }
          : null,
      }
    })
  )

  return NextResponse.json(trackersWithStats)
}

export async function POST(request: Request) {
  let session: { encryptionKey: string }
  try {
    session = await requireAuth()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { name, baseUrl, apiToken, platformType, pollIntervalMinutes, color } = body as {
    name?: string
    baseUrl?: string
    apiToken?: string
    platformType?: string
    pollIntervalMinutes?: number
    color?: string
  }

  if (!name || !baseUrl || !apiToken) {
    return NextResponse.json(
      { error: "name, baseUrl, and apiToken are required" },
      { status: 400 }
    )
  }

  if (typeof name !== "string" || typeof baseUrl !== "string" || typeof apiToken !== "string") {
    return NextResponse.json({ error: "Invalid field types" }, { status: 400 })
  }

  // Validate URL format
  try {
    new URL(baseUrl)
  } catch {
    return NextResponse.json({ error: "Invalid baseUrl format" }, { status: 400 })
  }

  const key = Buffer.from(session.encryptionKey, "hex")
  const encryptedApiToken = encrypt(apiToken, key)

  const [tracker] = await db
    .insert(trackers)
    .values({
      name: name.trim(),
      baseUrl: baseUrl.trim(),
      encryptedApiToken,
      platformType: (platformType as string) || "unit3d",
      pollIntervalMinutes: typeof pollIntervalMinutes === "number" ? pollIntervalMinutes : 360,
      color: (color as string) || "#00d4ff",
    })
    .returning()

  // SECURITY: Only return safe fields
  return NextResponse.json({ id: tracker.id, name: tracker.name }, { status: 201 })
}
