// src/lib/uptime.ts
//
// In-memory heartbeat accumulator with periodic DB flush.
// Buckets are 5 minutes wide. The accumulator lives on globalThis
// to survive HMR reloads in development.
//
// Functions: floorToFiveMin, recordHeartbeat, flushCompletedBuckets, removeClientFromAccumulator, clearUptimeAccumulator

import { db } from "@/lib/db"
import { clientUptimeBuckets } from "@/lib/db/schema"

const BUCKET_MS = 5 * 60 * 1000 // 5 minutes

interface Bucket {
  ts: number // floored epoch ms
  ok: number
  fail: number
}

type FlushEntry = Bucket & { clientId: number }
type Accumulator = Map<number, Bucket> // keyed by clientId

const g = globalThis as typeof globalThis & {
  __uptimeAccumulator?: Accumulator
  __uptimeFlushQueue?: FlushEntry[]
}

function getAccumulator(): Accumulator {
  if (!g.__uptimeAccumulator) {
    g.__uptimeAccumulator = new Map()
  }
  return g.__uptimeAccumulator
}

function getFlushQueue(): FlushEntry[] {
  if (!g.__uptimeFlushQueue) {
    g.__uptimeFlushQueue = []
  }
  return g.__uptimeFlushQueue
}

/** Floor a Date to the nearest 5-minute boundary. */
export function floorToFiveMin(date: Date): Date {
  const ms = date.getTime()
  return new Date(ms - (ms % BUCKET_MS))
}

/** Record a single heartbeat result for a client. */
export function recordHeartbeat(clientId: number, success: boolean): void {
  const acc = getAccumulator()
  const ts = floorToFiveMin(new Date()).getTime()

  const existing = acc.get(clientId)
  if (existing && existing.ts === ts) {
    // Same bucket — increment
    if (success) existing.ok++
    else existing.fail++
  } else {
    // Bucket boundary crossed (or first record for this client)
    if (existing) {
      // Push the completed bucket to the flush queue
      getFlushQueue().push({ clientId, ...existing })
    }
    acc.set(clientId, { ts, ok: success ? 1 : 0, fail: success ? 0 : 1 })
  }
}

/**
 * Write completed buckets to the database. Returns the number of buckets flushed.
 * Also prunes entries older than the retention window.
 *
 * Scans the accumulator for buckets older than the current 5-min window and
 * drains the flush queue. This ensures buckets are flushed even if
 * recordHeartbeat hasn't detected the boundary crossing yet.
 * Pruning is handled separately in the deep poll cron.
 */
export async function flushCompletedBuckets(): Promise<number> {
  // Move any completed buckets from the accumulator to the flush queue
  const acc = getAccumulator()
  const currentTs = floorToFiveMin(new Date()).getTime()
  for (const [clientId, bucket] of acc) {
    if (bucket.ts < currentTs) {
      getFlushQueue().push({ clientId, ...bucket })
      acc.delete(clientId)
    }
  }

  const queue = getFlushQueue()
  if (queue.length === 0) return 0

  const entries = queue.splice(0, queue.length)

  for (const entry of entries) {
    await db.insert(clientUptimeBuckets).values({
      clientId: entry.clientId,
      bucketTs: new Date(entry.ts),
      ok: entry.ok,
      fail: entry.fail,
    }).onConflictDoNothing()
  }

  return entries.length
}

/** Remove a single client from the accumulator and flush queue. Called when a client is deleted. */
export function removeClientFromAccumulator(clientId: number): void {
  getAccumulator().delete(clientId)
  const queue = getFlushQueue()
  const filtered = queue.filter((e) => e.clientId !== clientId)
  queue.length = 0
  queue.push(...filtered)
}

/** Clear the in-memory accumulator and flush queue. Called on logout/stop. */
export function clearUptimeAccumulator(): void {
  g.__uptimeAccumulator = new Map()
  g.__uptimeFlushQueue = []
}
