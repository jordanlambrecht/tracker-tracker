// src/app/api/settings/settings-routes.test.ts

import { NextResponse } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { authenticate, parseJsonBody } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { appSettings as appSettingsTable, trackers as trackersTable } from "@/lib/db/schema"
import { PROXY_PASSWORD_UNREADABLE_ERROR } from "@/lib/error-utils"
import { GET, PATCH } from "./route"

// Conditions as data, so a test can tell which tracker rows an update reaches.
vi.mock("drizzle-orm", async (importOriginal) => ({
  ...(await importOriginal<typeof import("drizzle-orm")>()),
  and: (...conditions: unknown[]) => ({ and: conditions }),
  eq: (column: unknown, value: unknown) => ({ eq: [column, value] }),
  isNotNull: (column: unknown) => ({ isNotNull: column }),
}))

vi.mock("@/lib/api-helpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-helpers")>()
  return {
    ...actual,
    authenticate: vi.fn(),
    parseJsonBody: vi.fn(),
    decodeKey: vi.fn().mockReturnValue(Buffer.from("a".repeat(32))),
  }
})

// A transaction's tx writes through the same update mock, and marks each write
// it starts, so a test can tell a write through tx from one straight on db.
const throughTx = { value: false }
vi.mock("@/lib/db", () => {
  const db = {
    select: vi.fn(),
    update: vi.fn(),
    transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        update: (table: unknown) => {
          throughTx.value = true
          return db.update(table)
        },
      }),
  }
  return { db }
})

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

  it("stores a FlareSolverr URL without its trailing slash", async () => {
    const set = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) })
    ;(db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set })
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      flaresolverrUrl: " http://flaresolverr:8191/ ",
      flaresolverrMaxTimeout: 90000,
    })

    const response = await PATCH(new Request("http://localhost/api/settings", { method: "PATCH" }))

    expect(response.status).toBe(200)
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        flaresolverrUrl: "http://flaresolverr:8191",
        flaresolverrMaxTimeout: 90000,
      })
    )
  })

  it.each([
    [
      { flaresolverrUrl: "ftp://flaresolverr:8191" },
      "FlareSolverr URL must use https:// or http://",
    ],
    [
      { flaresolverrUrl: "http://user:pw@flaresolverr:8191" },
      "FlareSolverr URL must not contain a username or password",
    ],
    [{ flaresolverrMaxTimeout: 1000 }, "FlareSolverr timeout must be between 10000 and 180000 ms"],
  ])("rejects FlareSolverr settings %j", async (body, error) => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue(body)

    const response = await PATCH(new Request("http://localhost/api/settings", { method: "PATCH" }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error })
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

  // ─── Proxy host ──────────────────────────────────────

  const HOST_REFUSAL =
    "Proxy host can't be used. Enter a hostname or IP address without a port (use the Port field), and write an IPv6 address in brackets, like [::1]"

  // The host pattern passes each of these, and the agent build then refused
  // every proxied request.
  it.each<[string, Record<string, unknown>, Record<string, unknown>]>([
    ["a port typed into the host", {}, { proxyHost: "proxy.example.test:1080" }],
    ["a bare IPv6 address", {}, { proxyHost: "::1" }],
    [
      "a switch to http under a host only socks5 can hold",
      { proxyHost: "999.1.1.1" },
      { proxyType: "http" },
    ],
  ])("refuses to save %s", async (_case, stored, body) => {
    mockSettingsSelect(stored)
    const set = vi.fn()
    ;(db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set })
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({ proxyEnabled: true, ...body })

    const response = await PATCH(new Request("http://localhost/api/settings", { method: "PATCH" }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: HOST_REFUSAL })
    expect(set).not.toHaveBeenCalled()
  })

  it.each(["proxy.example.test", "[::1]"])("saves %s as the proxy host", async (proxyHost) => {
    const set = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) })
    ;(db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set })
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      proxyEnabled: true,
      proxyHost,
    })

    const response = await PATCH(new Request("http://localhost/api/settings", { method: "PATCH" }))

    expect(response.status).toBe(200)
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ proxyHost }))
  })

  // A row saved before the check must not block saving anything else.
  it("saves a change to another setting over a stored host it can't use", async () => {
    mockSettingsSelect({ proxyHost: "proxy.example.test:1080" })
    const set = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) })
    ;(db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set })
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({ username: "joe" })

    const response = await PATCH(new Request("http://localhost/api/settings", { method: "PATCH" }))

    expect(response.status).toBe(200)
  })

  // Turning the proxy on puts the stored host back in use.
  it("refuses turning the proxy on over a stored host it can't use", async () => {
    mockSettingsSelect({ proxyHost: "proxy.example.test:1080" })
    const set = vi.fn()
    ;(db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set })
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({ proxyEnabled: true })

    const response = await PATCH(new Request("http://localhost/api/settings", { method: "PATCH" }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: HOST_REFUSAL })
    expect(set).not.toHaveBeenCalled()
  })

  // Or a broken proxy could never be switched off.
  it("saves turning the proxy off over a stored host it can't use", async () => {
    mockSettingsSelect({ proxyEnabled: true, proxyHost: "proxy.example.test:1080" })
    const set = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) })
    ;(db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set })
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({ proxyEnabled: false })

    const response = await PATCH(new Request("http://localhost/api/settings", { method: "PATCH" }))

    expect(response.status).toBe(200)
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ proxyEnabled: false }))
  })

  // The shape ProxySection saves, which sends type, host and port with the toggle.
  function formSave(proxyEnabled: boolean) {
    return {
      proxyEnabled,
      proxyType: "socks5",
      proxyHost: "proxy.example.test:1080",
      proxyPort: 1080,
    }
  }

  it("saves the proxy form turning the proxy off over a host it can't use", async () => {
    mockSettingsSelect({ proxyEnabled: true, proxyHost: "proxy.example.test:1080" })
    const set = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) })
    ;(db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set })
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue(formSave(false))

    const response = await PATCH(new Request("http://localhost/api/settings", { method: "PATCH" }))

    expect(response.status).toBe(200)
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ proxyEnabled: false }))
  })

  it("refuses the proxy form keeping the proxy on over a host it can't use", async () => {
    mockSettingsSelect({ proxyEnabled: true, proxyHost: "proxy.example.test:1080" })
    const set = vi.fn()
    ;(db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set })
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue(formSave(true))

    const response = await PATCH(new Request("http://localhost/api/settings", { method: "PATCH" }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: HOST_REFUSAL })
    expect(set).not.toHaveBeenCalled()
  })

  it("checks a host edit while the proxy is already on", async () => {
    mockSettingsSelect({ proxyEnabled: true, proxyHost: "proxy.example.test" })
    const set = vi.fn()
    ;(db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set })
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({ proxyHost: "::1" })

    const response = await PATCH(new Request("http://localhost/api/settings", { method: "PATCH" }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: HOST_REFUSAL })
    expect(set).not.toHaveBeenCalled()
  })

  const HOST_REQUIRED = "Enter a proxy host, or turn the proxy off"

  it.each<[string, Record<string, unknown>, Record<string, unknown>]>([
    ["turning the proxy on with no host stored", {}, { proxyEnabled: true }],
    [
      "clearing the host while the proxy is on",
      { proxyEnabled: true, proxyHost: "proxy.example.test" },
      { proxyHost: "" },
    ],
    [
      "the proxy form keeping the proxy on with the host emptied",
      { proxyEnabled: true, proxyHost: "proxy.example.test" },
      { ...formSave(true), proxyHost: null },
    ],
  ])("refuses %s", async (_case, stored, body) => {
    mockSettingsSelect(stored)
    const set = vi.fn()
    ;(db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set })
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue(body)

    const response = await PATCH(new Request("http://localhost/api/settings", { method: "PATCH" }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: HOST_REQUIRED })
    expect(set).not.toHaveBeenCalled()
  })

  it("saves the proxy form turning the proxy off with the host emptied", async () => {
    mockSettingsSelect({ proxyEnabled: true, proxyHost: "proxy.example.test" })
    const set = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) })
    ;(db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set })
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...formSave(false),
      proxyHost: null,
    })

    const response = await PATCH(new Request("http://localhost/api/settings", { method: "PATCH" }))

    expect(response.status).toBe(200)
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ proxyEnabled: false, proxyHost: null })
    )
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

type Condition = { and: Condition[] } | { eq: [unknown, unknown] } | { isNotNull: unknown }

function trackerColumn(column: unknown): string {
  const entry = Object.entries(trackersTable).find(([, c]) => c === column)
  if (!entry) throw new Error("not a trackers column")
  return entry[0]
}

/** SQL three-valued logic: null is unknown, and only true matches a row. */
function holds(cond: Condition, row: Record<string, unknown>): boolean | null {
  if ("and" in cond) {
    const results = cond.and.map((c) => holds(c, row))
    return results.includes(false) ? false : results.includes(null) ? null : true
  }
  if ("isNotNull" in cond) return row[trackerColumn(cond.isNotNull)] !== null
  const [column, value] = cond.eq
  const stored = row[trackerColumn(column)]
  return stored === null ? null : stored === value
}

// A tracker that hit the refusing agent's unreadable password four times.
const PAUSED_AT = new Date("2026-11-01T10:00:00Z")
function trackerRow(overrides: Record<string, unknown> = {}) {
  return {
    pausedAt: PAUSED_AT,
    userPausedAt: null,
    lastError: PROXY_PASSWORD_UNREADABLE_ERROR,
    lastErrorAt: PAUSED_AT,
    consecutiveFailures: 4,
    ...overrides,
  }
}

describe("PATCH /api/settings proxy password", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue({ encryptionKey: "a".repeat(64) })
    mockSettingsSelect({ proxyEnabled: true, proxyHost: "proxy.example.test" })
  })

  // Applies each tracker update the save makes to the given rows.
  // Every write the save makes, and whether it ran inside the transaction.
  let writes: { table: unknown; inTransaction: boolean }[] = []

  async function saveOver(body: Record<string, unknown>, rows: Record<string, unknown>[]) {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue(body)
    const trackerUpdates: { values: Record<string, unknown>; where: Condition }[] = []
    writes = []
    ;(db.update as ReturnType<typeof vi.fn>).mockImplementation((table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: (where: Condition) => {
          writes.push({ table, inTransaction: throughTx.value })
          throughTx.value = false
          if (table === trackersTable) trackerUpdates.push({ values, where })
          return Promise.resolve([])
        },
      }),
    }))
    const response = await PATCH(new Request("http://localhost/api/settings", { method: "PATCH" }))
    for (const { values, where } of trackerUpdates) {
      for (const row of rows) if (holds(where, row) === true) Object.assign(row, values)
    }
    return response
  }

  it("resumes the trackers paused because the stored password wouldn't decrypt", async () => {
    const row = trackerRow()

    const response = await saveOver({ proxyPassword: "new-password" }, [row])

    expect(response.status).toBe(200)
    expect(row).toMatchObject({
      pausedAt: null,
      lastError: null,
      lastErrorAt: null,
      consecutiveFailures: 0,
    })
  })

  it("keeps the user's own pause on a tracker it resumes", async () => {
    const row = trackerRow({ userPausedAt: PAUSED_AT })

    await saveOver({ proxyPassword: "new-password" }, [row])

    expect(row.userPausedAt).toBe(PAUSED_AT)
  })

  it.each<[string, Record<string, unknown>]>([
    ["paused for another reason", { lastError: "Invalid credentials" }],
    ["not paused yet", { pausedAt: null, consecutiveFailures: 2 }],
  ])("leaves a tracker %s as it was", async (_case, overrides) => {
    const row = trackerRow(overrides)
    const before = { ...row }

    await saveOver({ proxyPassword: "new-password" }, [row])

    expect(row).toEqual(before)
  })

  it("resumes nothing on a save that clears the password", async () => {
    const row = trackerRow()
    const before = { ...row }

    await saveOver({ proxyPassword: "" }, [row])

    expect(row).toEqual(before)
  })

  // A resume that fails must not leave the new password saved with the trackers
  // still paused.
  it("saves the password and resumes the trackers in one transaction", async () => {
    await saveOver({ proxyPassword: "new-password" }, [trackerRow()])

    expect(writes).toEqual([
      { table: appSettingsTable, inTransaction: true },
      { table: trackersTable, inTransaction: true },
    ])
  })
})
