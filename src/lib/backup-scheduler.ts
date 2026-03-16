// src/lib/backup-scheduler.ts
//
// Functions: startBackupScheduler, stopBackupScheduler, runScheduledBackup

import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import cron, { type ScheduledTask } from "node-cron"
import { generateBackupPayload, pruneOldBackups } from "@/lib/backup"
import { db } from "@/lib/db"
import { appSettings, backupHistory } from "@/lib/db/schema"
import { log } from "@/lib/logger"

// Store on globalThis to survive HMR in development.
// Without this, each hot-reload orphans the old cron job while creating a new one.
const g = globalThis as typeof globalThis & {
  __backupSchedulerTask?: ScheduledTask | null
  __backupSchedulerKey?: Buffer | null
}

function getBackupTask(): ScheduledTask | null {
  return g.__backupSchedulerTask ?? null
}
function setBackupTask(task: ScheduledTask | null) {
  g.__backupSchedulerTask = task
}
function getBackupKey(): Buffer | null {
  return g.__backupSchedulerKey ?? null
}
function setBackupKey(key: Buffer | null) {
  g.__backupSchedulerKey = key
}

// Cron expressions for backup frequencies (run at 03:00)
function getCronExpression(frequency: string): string {
  switch (frequency) {
    case "weekly":
      return "0 3 * * 0" // 03:00 every Sunday
    case "monthly":
      return "0 3 1 * *" // 03:00 first of month
    default:
      return "0 3 * * *" // 03:00 every day (covers "daily" and any unknown value)
  }
}

export async function runScheduledBackup(_encryptionKey: Buffer): Promise<void> {
  const [settings] = await db.select().from(appSettings).limit(1)
  if (!settings) return

  const storagePath = settings.backupStoragePath ?? "/data/backups"
  const retentionCount = settings.backupRetentionCount

  try {
    const payload = await generateBackupPayload()

    // Automated backups are always plain JSON (encryption requires user-provided password)
    const serialized = JSON.stringify(payload)
    const ext = "json"

    await mkdir(storagePath, { recursive: true })

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const filename = `tracker-tracker-backup-${timestamp}.${ext}`
    const filePath = path.join(storagePath, filename)
    await writeFile(filePath, serialized, "utf8")

    const sizeBytes = Buffer.byteLength(serialized, "utf8")

    await db.insert(backupHistory).values({
      sizeBytes,
      encrypted: false, // Automated backups are always plain JSON
      frequency: settings.backupScheduleFrequency,
      status: "completed",
      storagePath: filePath,
    })

    log.info(`Scheduled backup saved: ${filePath} (${sizeBytes} bytes)`)

    await pruneOldBackups(retentionCount, storagePath)
  } catch (error) {
    log.error(error, "Scheduled backup failed")

    try {
      await db.insert(backupHistory).values({
        sizeBytes: 0,
        encrypted: false,
        frequency: settings.backupScheduleFrequency,
        status: "failed",
        storagePath: null,
        notes: error instanceof Error ? error.message : "Unknown error",
      })
    } catch (historyError) {
      log.error(historyError, "Failed to record backup failure")
    }
  }
}

export function startBackupScheduler(encryptionKey: Buffer): void {
  if (getBackupTask()) return

  db.select()
    .from(appSettings)
    .limit(1)
    .then(([settings]) => {
      if (!settings?.backupScheduleEnabled) return

      setBackupKey(Buffer.from(encryptionKey))
      const cronExpr = getCronExpression(settings.backupScheduleFrequency)

      const task = cron.schedule(cronExpr, async () => {
        const key = getBackupKey()
        if (!key) return
        try {
          await runScheduledBackup(key)
        } catch (error) {
          log.error(error, "Backup scheduler error")
        }
      })
      setBackupTask(task)
      log.info(`Backup scheduler started (${settings.backupScheduleFrequency} at 03:00)`)
    })
    .catch((err) => {
      log.error(err, "Failed to initialize backup scheduler")
    })
}

export function stopBackupScheduler(): void {
  const task = getBackupTask()
  if (task) {
    task.stop()
    setBackupTask(null)
  }
  const key = getBackupKey()
  if (key) {
    key.fill(0)
    setBackupKey(null)
  }
}

