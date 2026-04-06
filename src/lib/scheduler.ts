// src/lib/scheduler.ts
//
// Functions: startScheduler, stopScheduler, ensureSchedulerRunning
//
// Master scheduler orchestrator. Coordinates all three polling subsystems:
//   tracker-scheduler  — polls tracker APIs for stats
//   client-scheduler   — polls download clients for torrent data
//   backup-scheduler   — runs automated backups

import { startBackupScheduler, stopBackupScheduler } from "@/lib/backup-scheduler"
import {
  ensureClientSchedulerRunning,
  startClientScheduler,
  stopClientScheduler,
} from "@/lib/client-scheduler"
import { ensureIndexes } from "@/lib/db/ensure-indexes"
import {
  isTrackerPollingRunning,
  startTrackerPolling,
  stopTrackerPolling,
} from "@/lib/tracker-scheduler"

export function startScheduler(encryptionKey: Buffer): void {
  startTrackerPolling(encryptionKey)
  startClientScheduler(encryptionKey)
  startBackupScheduler(encryptionKey)
}

export function stopScheduler(): void {
  stopTrackerPolling()
  stopClientScheduler()
  stopBackupScheduler()
}

/**
 * Restarts all schedulers if they died (i.e. after server restart).
 * Called from the auth layout on every authenticated page load.
 */
export function ensureSchedulerRunning(encryptionKeyHex: string): void {
  if (isTrackerPollingRunning()) return
  const key = Buffer.from(encryptionKeyHex, "hex")
  startScheduler(key)
  ensureClientSchedulerRunning(encryptionKeyHex)
  // Fire-and-forget: create covering indexes that Drizzle's schema DSL can't express.
  // Idempotent (IF NOT EXISTS), guarded by globalThis flag, non-fatal on failure.
  ensureIndexes().catch(() => {})
}
