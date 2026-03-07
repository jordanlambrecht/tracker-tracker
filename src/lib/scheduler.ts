// src/lib/scheduler.ts
//
// Functions: pollTracker, pollAllTrackers, startScheduler, stopScheduler
import { eq } from "drizzle-orm"
import cron, { type ScheduledTask } from "node-cron"
import { getAdapter } from "@/lib/adapters"
import { decrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { trackerSnapshots, trackers } from "@/lib/db/schema"

let schedulerTask: ScheduledTask | null = null

export async function pollTracker(
  trackerId: number,
  encryptionKey: Buffer
): Promise<void> {
  const [tracker] = await db
    .select()
    .from(trackers)
    .where(eq(trackers.id, trackerId))
    .limit(1)

  if (!tracker || !tracker.isActive) return

  try {
    const apiToken = decrypt(tracker.encryptedApiToken, encryptionKey)
    const adapter = getAdapter(tracker.platformType)
    const stats = await adapter.fetchStats(tracker.baseUrl, apiToken, tracker.apiPath)

    await db.insert(trackerSnapshots).values({
      trackerId: tracker.id,
      polledAt: new Date(),
      uploadedBytes: stats.uploadedBytes,
      downloadedBytes: stats.downloadedBytes,
      ratio: stats.ratio,
      bufferBytes: stats.bufferBytes,
      seedingCount: stats.seedingCount,
      leechingCount: stats.leechingCount,
      seedbonus: stats.seedbonus,
      hitAndRuns: stats.hitAndRuns,
      username: stats.username,
      group: stats.group,
    })

    await db
      .update(trackers)
      .set({ lastPolledAt: new Date(), lastError: null, updatedAt: new Date() })
      .where(eq(trackers.id, tracker.id))
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    await db
      .update(trackers)
      .set({ lastError: message, updatedAt: new Date() })
      .where(eq(trackers.id, trackerId))
    console.error(`Poll failed for tracker ${trackerId}:`, message)
  }
}

export async function pollAllTrackers(encryptionKey: Buffer): Promise<void> {
  const allTrackers = await db
    .select()
    .from(trackers)
    .where(eq(trackers.isActive, true))

  const now = Date.now()

  for (const tracker of allTrackers) {
    const intervalMs = tracker.pollIntervalMinutes * 60 * 1000
    const lastPoll = tracker.lastPolledAt?.getTime() ?? 0

    if (now - lastPoll >= intervalMs) {
      await pollTracker(tracker.id, encryptionKey)
    }
  }
}

export function startScheduler(encryptionKey: Buffer): void {
  if (schedulerTask) return

  // Check every 5 minutes if any tracker needs polling
  schedulerTask = cron.schedule("*/5 * * * *", async () => {
    try {
      await pollAllTrackers(encryptionKey)
    } catch (error) {
      console.error("Scheduler error:", error)
    }
  })

  console.log("Polling scheduler started (checking every 5 minutes)")
}

export function stopScheduler(): void {
  if (schedulerTask) {
    schedulerTask.stop()
    schedulerTask = null
  }
}
