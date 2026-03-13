// src/app/api/settings/settings-routes.test.ts

import { NextResponse } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { authenticate, parseJsonBody } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { PATCH } from "./route"

vi.mock("@/lib/api-helpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-helpers")>()
  return {
    ...actual,
    authenticate: vi.fn(),
    parseJsonBody: vi.fn(),
    decodeKey: vi.fn().mockReturnValue(Buffer.from("a".repeat(32))),
  }
})

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock("@/lib/db/schema", () => ({
  appSettings: {},
  trackerSnapshots: {},
}))

vi.mock("@/lib/backup", () => ({
  VALID_BACKUP_FREQUENCIES: new Set(["daily", "weekly", "monthly"]),
}))

vi.mock("@/lib/crypto", () => ({
  encrypt: vi.fn((value: string) => `encrypted:${value}`),
}))

vi.mock("@/lib/privacy", () => ({
  isRedacted: vi.fn(() => false),
  maskUsername: vi.fn((value: string | null | undefined) => value ?? null),
}))

vi.mock("@/lib/privacy-db", () => ({
  scrubSnapshotUsernames: vi.fn().mockResolvedValue(0),
}))

vi.mock("@/lib/proxy", () => ({
  PROXY_HOST_PATTERN: /^[\w.\-:[\]]+$/,
  VALID_PROXY_TYPES: new Set(["socks5", "http", "https"]),
}))

vi.mock("@/lib/qbitmanage-defaults", () => ({
  parseQbitmanageTags: vi.fn(() => ({})),
  QBITMANAGE_KEYS: [],
}))

function mockSettingsSelect() {
  const settings = {
    id: 1,
    storeUsernames: true,
    username: null,
    sessionTimeoutMinutes: null,
    autoWipeThreshold: null,
    snapshotRetentionDays: null,
    trackerPollIntervalMinutes: 60,
    proxyEnabled: false,
    proxyType: "socks5",
    proxyHost: null,
    proxyPort: 1080,
    proxyUsername: null,
    encryptedProxyPassword: null,
    qbitmanageEnabled: false,
    qbitmanageTags: null,
    backupScheduleEnabled: false,
    backupScheduleFrequency: "daily",
    backupRetentionCount: 7,
    backupEncryptionEnabled: false,
    backupStoragePath: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
  }
  const limit = vi.fn().mockResolvedValue([settings])
  const from = vi.fn().mockReturnValue({ limit })
  ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from })
}

describe("PATCH /api/settings route validation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue({ encryptionKey: "a".repeat(64) })
    mockSettingsSelect()
  })

  it("rejects non-integer trackerPollIntervalMinutes", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({ trackerPollIntervalMinutes: 30.5 })

    const response = await PATCH(
      new Request("http://localhost/api/settings", { method: "PATCH" })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: "Invalid poll interval" })
  })

  it("rejects trackerPollIntervalMinutes below 15 minutes", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({ trackerPollIntervalMinutes: 5 })

    const response = await PATCH(
      new Request("http://localhost/api/settings", { method: "PATCH" })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "Poll interval must be between 15 minutes and 24 hours",
    })
  })

  it("rejects trackerPollIntervalMinutes above 24 hours", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({ trackerPollIntervalMinutes: 1441 })

    const response = await PATCH(
      new Request("http://localhost/api/settings", { method: "PATCH" })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "Poll interval must be between 15 minutes and 24 hours",
    })
  })

  it("returns 401 when unauthenticated", async () => {
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    )
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({ trackerPollIntervalMinutes: 60 })

    const response = await PATCH(
      new Request("http://localhost/api/settings", { method: "PATCH" })
    )

    expect(response.status).toBe(401)
  })
})