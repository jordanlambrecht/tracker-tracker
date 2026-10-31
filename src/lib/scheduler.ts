// src/lib/scheduler.ts
//
// Functions: startScheduler, stopScheduler, ensureSchedulerRunning
//
// Master scheduler orchestrator. Coordinates all four polling subsystems:
//   tracker-scheduler. Polls tracker APIs for stats.
//   download-client-scheduler. Polls download clients for torrent data.
//   backup-scheduler. Runs automated backups.
//   prowlarr-scheduler. Reads indexer health from Prowlarr.

import { startBackupScheduler, stopBackupScheduler } from "@/lib/backup-scheduler"
import { ensureIndexes } from "@/lib/db/ensure-indexes"
import {
  ensureClientSchedulerRunning,
  startClientScheduler,
  stopClientScheduler,
} from "@/lib/download-client-scheduler"
import { log } from "@/lib/logger"
import {
  ensureProwlarrSchedulerRunning,
  startProwlarrScheduler,
  stopProwlarrScheduler,
} from "@/lib/prowlarr-scheduler"
import {
  isTrackerPollingRunning,
  startTrackerPolling,
  stopTrackerPolling,
} from "@/lib/tracker-scheduler"

// Set on SIGTERM only, since lockdown, restore and a password change stop and
// then restart. Without it a render still in flight during Next's drain would
// restart every scheduler with a fresh, never-zeroed key.
let shuttingDown = false

export function startScheduler(encryptionKey: Buffer): void {
  if (shuttingDown) return
  startTrackerPolling(encryptionKey)
  startClientScheduler(encryptionKey)
  startBackupScheduler(encryptionKey)
  startProwlarrScheduler(encryptionKey)
}

export function stopScheduler(): void {
  stopTrackerPolling()
  stopClientScheduler()
  stopBackupScheduler()
  stopProwlarrScheduler()
}

// Zero-fills the encryption keys synchronously, before any await. Next's own
// SIGTERM handler drains requests and then exits, so this one must not.
// With NEXT_MANUAL_SIG_HANDLE set, nothing would exit.
process.on("SIGTERM", () => {
  shuttingDown = true
  log.info("SIGTERM received, shutting down")
  stopScheduler()
})

/**
 * Restarts all schedulers if they died (i.e. after server restart).
 * Called from the auth layout on every authenticated page load.
 */
export function ensureSchedulerRunning(encryptionKeyHex: string): void {
  if (shuttingDown) return
  if (isTrackerPollingRunning()) return
  const key = Buffer.from(encryptionKeyHex, "hex")
  startScheduler(key)
  ensureClientSchedulerRunning(encryptionKeyHex)
  ensureProwlarrSchedulerRunning(encryptionKeyHex)
  // Fire-and-forget: create covering indexes that Drizzle's schema DSL can't express.
  // Idempotent (IF NOT EXISTS), guarded by globalThis flag, non-fatal on failure.
  ensureIndexes().catch((err) => {
    log.warn(err, "ensureIndexes fire-and-forget failed")
  })
}

/** Exposed for testing. Clears the flag the SIGTERM handler sets. */
export function _resetShutdownForTest(): void {
  shuttingDown = false
}
