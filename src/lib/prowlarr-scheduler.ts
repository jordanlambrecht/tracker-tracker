// src/lib/prowlarr-scheduler.ts
//
// Functions: pollAllProwlarrInstances, startProwlarrScheduler, stopProwlarrScheduler,
//            isProwlarrSchedulerRunning, ensureProwlarrSchedulerRunning
//
// Polls every enabled Prowlarr instance every five minutes. Separate from the
// tracker loop on purpose: a slow or unreachable Prowlarr must not delay or
// fail a tracker poll.

import { eq } from "drizzle-orm"
import cron, { type ScheduledTask } from "node-cron"
import { withCycleDeadline } from "@/lib/cycle-deadline"
import { db } from "@/lib/db"
import { prowlarrInstances } from "@/lib/db/schema"
import { PROWLARR_CYCLE_DEADLINE_MS } from "@/lib/limits"
import { log } from "@/lib/logger"
import { pollProwlarrInstance } from "@/lib/prowlarr/sync"

// On globalThis so it persists across HMR reloads, like the other schedulers.
const g = globalThis as typeof globalThis & {
  __prowlarrTask?: ScheduledTask | null
  __prowlarrInFlight?: boolean
}

export async function pollAllProwlarrInstances(encryptionKey: Buffer): Promise<void> {
  const instances = await db
    .select({ id: prowlarrInstances.id })
    .from(prowlarrInstances)
    .where(eq(prowlarrInstances.enabled, true))
  // pollProwlarrInstance catches and records its own failures, so a failing instance does not stop the others.
  await Promise.allSettled(instances.map((i) => pollProwlarrInstance(i.id, encryptionKey)))
}

async function runCycle(encryptionKey: Buffer): Promise<void> {
  if (g.__prowlarrInFlight) return
  g.__prowlarrInFlight = true
  try {
    await withCycleDeadline(
      pollAllProwlarrInstances(encryptionKey),
      PROWLARR_CYCLE_DEADLINE_MS,
      "Prowlarr poll cycle"
    )
  } catch (error) {
    log.error(error, "Prowlarr scheduler error")
  } finally {
    g.__prowlarrInFlight = false
  }
}

export function startProwlarrScheduler(encryptionKey: Buffer): void {
  if (g.__prowlarrTask) return
  void runCycle(encryptionKey)
  g.__prowlarrTask = cron.schedule("*/5 * * * *", () => runCycle(encryptionKey))
  log.info("Prowlarr scheduler started (every 5 minutes)")
}

export function stopProwlarrScheduler(): void {
  g.__prowlarrTask?.stop()
  g.__prowlarrTask = null
}

export function isProwlarrSchedulerRunning(): boolean {
  return (g.__prowlarrTask ?? null) !== null
}

/** Restarts the scheduler if it has stopped. Called from ensureSchedulerRunning in scheduler.ts. */
export function ensureProwlarrSchedulerRunning(encryptionKeyHex: string): void {
  if (isProwlarrSchedulerRunning()) return
  startProwlarrScheduler(Buffer.from(encryptionKeyHex, "hex"))
}
