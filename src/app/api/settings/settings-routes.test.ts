// src/app/api/settings/settings-routes.test.ts

import { NextResponse } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { authenticate, parseJsonBody } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { GET, PATCH } from "./route"

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
  trackers: {
    id: "id",
    name: "name",
    baseUrl: "baseUrl",
    apiPath: "apiPath",
    platformType: "platformType",
    isActive: "isActive",
    lastPolledAt: "lastPolledAt",
    lastError: "lastError",
    consecutiveFailures: "consecutiveFailures",
    pausedAt: "pausedAt",
    userPausedAt: "userPausedAt",
    color: "color",
    qbtTag: "qbtTag",
    remoteUserId: "remoteUserId",
    platformMeta: "platformMeta",
    avatarData: "avatarData",
    avatarCachedAt: "avatarCachedAt",
    avatarRemoteUrl: "avatarRemoteUrl",
    useProxy: "useProxy",
    countCrossSeedUnsatisfied: "countCrossSeedUnsatisfied",
    isFavorite: "isFavorite",
    sortOrder: "sortOrder",
    joinedAt: "joinedAt",
    lastAccessAt: "lastAccessAt",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
  trackerSnapshots: {},
  downloadClients: {
    id: "id",
    name: "name",
    type: "type",
    enabled: "enabled",
    host: "host",
    port: "port",
    useSsl: "useSsl",
    encryptedUsername: "encryptedUsername",
    encryptedPassword: "encryptedPassword",
    pollIntervalSeconds: "pollIntervalSeconds",
    isDefault: "isDefault",
    crossSeedTags: "crossSeedTags",
    lastPolledAt: "lastPolledAt",
    lastError: "lastError",
    errorSince: "errorSince",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
  prowlarrIndexers: {},
  prowlarrInstances: {},
  notificationTargets: {
    id: "id",
    name: "name",
    type: "type",
    enabled: "enabled",
    encryptedConfig: "encryptedConfig",
    notifyRatioDrop: "notifyRatioDrop",
    notifyHitAndRun: "notifyHitAndRun",
    notifyTrackerDown: "notifyTrackerDown",
    notifyBufferMilestone: "notifyBufferMilestone",
    notifyWarned: "notifyWarned",
    notifyRatioDanger: "notifyRatioDanger",
    notifyZeroSeeding: "notifyZeroSeeding",
    notifyRankChange: "notifyRankChange",
    notifyAnniversary: "notifyAnniversary",
    notifyBonusCap: "notifyBonusCap",
    notifyVipExpiring: "notifyVipExpiring",
    notifyUnsatisfiedLimit: "notifyUnsatisfiedLimit",
    notifyActiveHnrs: "notifyActiveHnrs",
    notifyDownloadDisabled: "notifyDownloadDisabled",
    thresholds: "thresholds",
    includeTrackerName: "includeTrackerName",
    scope: "scope",
    lastDeliveryStatus: "lastDeliveryStatus",
    lastDeliveryAt: "lastDeliveryAt",
    lastDeliveryError: "lastDeliveryError",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
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

vi.mock("@/lib/download-clients/qbt/qbitmanage-defaults", () => ({
  parseQbitmanageTags: vi.fn(() => ({})),
  QBITMANAGE_KEYS: [],
}))

function mockSettingsSelect(overrides: Record<string, unknown> = {}) {
  const settings = {
    id: 1,
    storeUsernames: true,
    username: null,
    sessionTimeoutMinutes: null,
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
    ...overrides,
  }
  const limit = vi.fn().mockResolvedValue([settings])
  const from = vi.fn().mockReturnValue({ limit })
  ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from })
}

// Add Tracker offers the proxy only when this says it can be used. It is
// decided on the server, and the stored password never leaves it.
describe("GET /api/settings proxyUsable", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue({ encryptionKey: "a".repeat(64) })
  })

  it.each<[string, Record<string, unknown>, boolean]>([
    [
      "is usable when on with a host",
      { proxyEnabled: true, proxyHost: "proxy.example.test" },
      true,
    ],
    ["is not usable while off", { proxyEnabled: false, proxyHost: "proxy.example.test" }, false],
    ["is not usable with no host", { proxyEnabled: true, proxyHost: null }, false],
    [
      "is not usable with a port typed into the host",
      { proxyEnabled: true, proxyHost: "proxy.example.test:1080" },
      false,
    ],
  ])("says a proxy %s", async (_case, overrides, usable) => {
    mockSettingsSelect(overrides)

    const res = await GET()

    expect((await res.json()).proxyUsable).toBe(usable)
  })

  it("decides it without sending the stored password", async () => {
    const CANARY = "CANARY-proxy-password-ciphertext"
    mockSettingsSelect({
      proxyEnabled: true,
      proxyHost: "proxy.example.test",
      hasProxyPassword: CANARY,
    })

    const body = await (await GET()).json()

    expect(body).toMatchObject({ proxyUsable: true, hasProxyPassword: true })
    expect(JSON.stringify(body)).not.toContain(CANARY)
  })
})

describe("PATCH /api/settings route validation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue({ encryptionKey: "a".repeat(64) })
    mockSettingsSelect()
  })

  it("rejects non-integer trackerPollIntervalMinutes", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      trackerPollIntervalMinutes: 30.5,
    })

    const response = await PATCH(new Request("http://localhost/api/settings", { method: "PATCH" }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "Poll interval must be between 15 and 1440 minutes",
    })
  })

  it("rejects trackerPollIntervalMinutes below 15 minutes", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      trackerPollIntervalMinutes: 5,
    })

    const response = await PATCH(new Request("http://localhost/api/settings", { method: "PATCH" }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "Poll interval must be between 15 and 1440 minutes",
    })
  })

  it("rejects trackerPollIntervalMinutes above 24 hours", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      trackerPollIntervalMinutes: 1441,
    })

    const response = await PATCH(new Request("http://localhost/api/settings", { method: "PATCH" }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "Poll interval must be between 15 and 1440 minutes",
    })
  })

  // ─── Username validation ──────────────────────────────────────

  it("rejects username shorter than 3 characters", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({ username: "ab" })

    const response = await PATCH(new Request("http://localhost/api/settings", { method: "PATCH" }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "Username must be between 3 and 100 characters",
    })
  })

  it("accepts username of exactly 3 characters", async () => {
    const set = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) })
    ;(db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set })
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({ username: "joe" })

    const response = await PATCH(new Request("http://localhost/api/settings", { method: "PATCH" }))

    expect(response.status).toBe(200)
  })

  // This route used to measure length against the raw string and store the
  // trimmed one, so padding smuggled a too-short username past the minimum.
  it("rejects a username that is only long enough before trimming", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({ username: "  ab  " })

    const response = await PATCH(new Request("http://localhost/api/settings", { method: "PATCH" }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "Username must be between 3 and 100 characters",
    })
  })

  // No character class was applied here at all, so this route could write a
  // username that setup and the post-login prompt would both have rejected.
  it("rejects a username containing illegal characters", async () => {
    const set = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) })
    ;(db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set })
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      username: "<script>alert(1)</script>",
    })

    const response = await PATCH(new Request("http://localhost/api/settings", { method: "PATCH" }))

    expect(response.status).toBe(400)
    expect(set).not.toHaveBeenCalled()
  })

  it("rejects username longer than 100 characters", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      username: "a".repeat(101),
    })

    const response = await PATCH(new Request("http://localhost/api/settings", { method: "PATCH" }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "Username must be between 3 and 100 characters",
    })
  })

  it("accepts null username to clear it", async () => {
    const set = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) })
    ;(db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set })
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({ username: null })

    const response = await PATCH(new Request("http://localhost/api/settings", { method: "PATCH" }))

    expect(response.status).toBe(200)
  })

  it("returns 401 when unauthenticated", async () => {
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    )
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      trackerPollIntervalMinutes: 60,
    })

    const response = await PATCH(new Request("http://localhost/api/settings", { method: "PATCH" }))

    expect(response.status).toBe(401)
  })
})
