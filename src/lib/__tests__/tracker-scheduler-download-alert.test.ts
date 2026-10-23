// src/lib/__tests__/tracker-scheduler-download-alert.test.ts
//
// The download-revoked alert compares this poll's canDownload with the stored
// one, and the scheduler only hands both to dispatch for platforms it lists. A
// platform left off never gets the alert. The bonus cap is MAM's alone, so no
// other platform's context carries a seedbonus.

import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/db", () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
}))
vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))
vi.mock("@/lib/tracker-outages", () => ({
  recordTrackerPollFailure: vi.fn(async () => {}),
  pruneTrackerOutages: vi.fn(async () => 0),
}))
vi.mock("@/lib/app-liveness", () => ({ pruneCoverageGaps: vi.fn(async () => 0) }))
vi.mock("@/lib/crypto", () => ({ decrypt: vi.fn(() => "token") }))
vi.mock("@/lib/notifications/dispatch", () => ({ dispatchNotifications: vi.fn(async () => {}) }))
vi.mock("@/lib/alert-pruning", () => ({ pruneDismissedAlerts: vi.fn(async () => 0) }))
vi.mock("@/lib/server-data", () => ({ recordDatabaseSize: vi.fn(async () => {}) }))
vi.mock("@/lib/tunnel", () => ({ buildProxyAgentFromSettings: vi.fn(() => undefined) }))
vi.mock("@/data/tracker-registry", () => ({
  registryEntryFor: vi.fn(() => undefined),
}))
vi.mock("node-cron", () => ({ default: { schedule: vi.fn() } }))

const fetchStats = vi.fn()
vi.mock("@/lib/tracker-platforms", () => ({
  getAdapter: vi.fn(() => ({ fetchStats })),
  buildFetchOptions: vi.fn(() => ({})),
}))

import { db } from "@/lib/db"
import { dispatchNotifications } from "@/lib/notifications/dispatch"
import { pollTracker } from "@/lib/tracker-scheduler"

/** Drizzle-shaped chain: any method sequence resolves to `result`. */
function chain(result: unknown): Record<string, unknown> {
  const settled = Promise.resolve(result)
  const proxy: Record<string, unknown> = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === "then") return settled.then.bind(settled)
        if (prop === "catch") return settled.catch.bind(settled)
        if (prop === "finally") return settled.finally.bind(settled)
        return () => proxy
      },
    }
  )
  return proxy
}

const STATS = {
  uploadedBytes: 1_000n,
  downloadedBytes: 500n,
  ratio: 2,
  bufferBytes: 500n,
  seedbonus: 1840,
  hitAndRuns: null,
  seedingCount: null,
  leechingCount: null,
  requiredRatio: null,
  warned: null,
  freeleechTokens: null,
  username: "example-user",
  group: null,
}

function trackerRow(platformType: string, storedMeta: string) {
  return {
    id: 42,
    name: "Example",
    isActive: true,
    encryptedApiToken: "enc",
    platformType,
    baseUrl: "https://tracker.example",
    apiPath: "/api",
    useProxy: false,
    remoteUserId: null,
    joinedAt: null,
    platformMeta: storedMeta,
    lastPolledAt: null,
    lastError: null,
    lastErrorAt: null,
    consecutiveFailures: 0,
    pausedAt: null,
    userPausedAt: null,
    minimumRatio: null,
  }
}

function seedTracker(platformType: string, storedMeta = JSON.stringify({ canDownload: true })) {
  vi.mocked(db.select).mockImplementation(((cols: Record<string, unknown>) => {
    const keys = Object.keys(cols ?? {})
    if (keys.includes("encryptedApiToken")) return chain([trackerRow(platformType, storedMeta)])
    return chain([])
  }) as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(db.insert).mockImplementation((() => chain([])) as never)
  vi.mocked(db.update).mockImplementation((() => chain([])) as never)
  vi.mocked(db.delete).mockImplementation((() => chain([])) as never)
})

const KEY = Buffer.alloc(32)

describe("pollTracker download-revoked context", () => {
  it.each(["c411", "hawke"])("hands %s's canDownload transition to dispatch", async (platform) => {
    seedTracker(platform)
    fetchStats.mockResolvedValue({ ...STATS, platformMeta: { canDownload: false } })

    await pollTracker(42, KEY, false)

    const ctx = vi.mocked(dispatchNotifications).mock.calls[0]?.[0]
    expect(ctx?.platformContext).toMatchObject({ canDownload: false, previousCanDownload: true })
    // No other platform alert switches on with it.
    expect(ctx?.platformContext?.currentSeedbonus).toBeNull()
  })

  it.each([
    ["avistaz", { canDownload: true }, { canDownload: false }],
    ["digitalcore", { downloadBan: false }, { downloadBan: true }],
  ])(
    "hands %s's transition to dispatch in its own meta shape",
    async (platform, stored, polled) => {
      seedTracker(platform, JSON.stringify(stored))
      fetchStats.mockResolvedValue({ ...STATS, platformMeta: polled })

      await pollTracker(42, KEY, false)

      const ctx = vi.mocked(dispatchNotifications).mock.calls[0]?.[0]
      expect(ctx?.platformContext).toMatchObject({ canDownload: false, previousCanDownload: true })
    }
  )

  it("hands no platform context to a platform without these alerts", async () => {
    seedTracker("unit3d")
    fetchStats.mockResolvedValue({ ...STATS, platformMeta: { canDownload: false } })

    await pollTracker(42, KEY, false)

    const ctx = vi.mocked(dispatchNotifications).mock.calls[0]?.[0]
    expect(ctx).toBeDefined()
    expect(ctx?.platformContext).toBeUndefined()
  })

  it("reports an unknown transition when the poll carries no flag", async () => {
    seedTracker("c411")
    fetchStats.mockResolvedValue({ ...STATS, platformMeta: {} })

    await pollTracker(42, KEY, false)

    const ctx = vi.mocked(dispatchNotifications).mock.calls[0]?.[0]
    expect(ctx?.platformContext?.canDownload).toBeNull()
  })

  it("reads a stored meta without the flag as unknown, not as allowed", async () => {
    // An adapter omits an absent flag, so the last poll may have stored none.
    seedTracker("c411", JSON.stringify({}))
    fetchStats.mockResolvedValue({ ...STATS, platformMeta: { canDownload: false } })

    await pollTracker(42, KEY, false)

    const ctx = vi.mocked(dispatchNotifications).mock.calls[0]?.[0]
    expect(ctx?.platformContext).toMatchObject({ canDownload: false, previousCanDownload: null })
  })
})

describe("pollTracker bonus-cap context", () => {
  it("hands MAM's seedbonus to dispatch", async () => {
    seedTracker("mam")
    fetchStats.mockResolvedValue({ ...STATS, platformMeta: {} })

    await pollTracker(42, KEY, false)

    const ctx = vi.mocked(dispatchNotifications).mock.calls[0]?.[0]
    expect(ctx?.platformContext?.currentSeedbonus).toBe(1840)
  })

  // Any other seedbonus would fire "spend them before they're wasted" at 99,999.
  it.each(["avistaz", "digitalcore"])(
    "keeps %s's bonus points out of the MAM bonus cap",
    async (platform) => {
      seedTracker(platform)
      fetchStats.mockResolvedValue({ ...STATS, platformMeta: {} })

      await pollTracker(42, KEY, false)

      const ctx = vi.mocked(dispatchNotifications).mock.calls[0]?.[0]
      expect(ctx?.platformContext).toBeDefined()
      expect(ctx?.platformContext?.currentSeedbonus).toBeNull()
    }
  )
})
