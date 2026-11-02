// src/lib/__tests__/backup-scheduler.test.ts

// @vitest-environment node

import cron from "node-cron"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { startBackupScheduler, stopBackupScheduler } from "@/lib/backup-scheduler"
import { db } from "@/lib/db"

vi.mock("node-cron", () => ({ default: { schedule: vi.fn(() => ({ stop: vi.fn() })) } }))
vi.mock("@/lib/db", () => ({ db: { select: vi.fn(), insert: vi.fn() } }))
vi.mock("@/lib/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const KEY = Buffer.alloc(32, 7)

/** Holds the settings read open until the returned release runs. */
function holdSettingsRead(settings: Record<string, unknown>) {
  let release: () => void = () => {}
  const read = new Promise<Record<string, unknown>[]>((resolve) => {
    release = () => resolve([settings])
  })
  vi.mocked(db.select).mockReturnValue({ from: () => ({ limit: () => read }) } as never)
  return () => release()
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

beforeEach(() => {
  vi.clearAllMocks()
  stopBackupScheduler()
})

afterEach(() => {
  stopBackupScheduler()
})

describe("startBackupScheduler", () => {
  it("registers one task when a second start arrives during the settings read", async () => {
    const release = holdSettingsRead({
      backupScheduleEnabled: true,
      backupScheduleFrequency: "daily",
    })

    startBackupScheduler(KEY)
    startBackupScheduler(KEY)
    release()
    await flush()

    expect(db.select).toHaveBeenCalledTimes(1)
    expect(cron.schedule).toHaveBeenCalledTimes(1)
  })

  it("registers nothing for a start that a stop overtook, so the next start owns the task", async () => {
    const releaseFirst = holdSettingsRead({
      backupScheduleEnabled: true,
      backupScheduleFrequency: "daily",
    })
    startBackupScheduler(KEY)
    stopBackupScheduler()

    const releaseSecond = holdSettingsRead({
      backupScheduleEnabled: true,
      backupScheduleFrequency: "weekly",
    })
    startBackupScheduler(KEY)
    releaseFirst()
    releaseSecond()
    await flush()

    expect(cron.schedule).toHaveBeenCalledTimes(1)
    expect(vi.mocked(cron.schedule).mock.calls[0][0]).toBe("0 3 * * 0")
  })

  it("can start again after backups were off at the last read", async () => {
    const releaseOff = holdSettingsRead({ backupScheduleEnabled: false })
    startBackupScheduler(KEY)
    releaseOff()
    await flush()

    const releaseOn = holdSettingsRead({
      backupScheduleEnabled: true,
      backupScheduleFrequency: "daily",
    })
    startBackupScheduler(KEY)
    releaseOn()
    await flush()

    expect(cron.schedule).toHaveBeenCalledTimes(1)
  })

  it("can start again after the settings read failed", async () => {
    vi.mocked(db.select).mockReturnValueOnce({
      from: () => ({ limit: () => Promise.reject(new Error("connection reset")) }),
    } as never)
    startBackupScheduler(KEY)
    await flush()

    const release = holdSettingsRead({
      backupScheduleEnabled: true,
      backupScheduleFrequency: "daily",
    })
    startBackupScheduler(KEY)
    release()
    await flush()

    expect(cron.schedule).toHaveBeenCalledTimes(1)
  })
})
