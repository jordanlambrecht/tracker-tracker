// src/lib/__tests__/tracker-scheduler-registry-site.test.ts
//
// A poll takes the address, API path and platform from the row's registry entry
// and never from the copies the row stores, so a registry edit reaches every
// user. A row the tracker list cannot place is paused once, naming the host it
// was set up for, and a defunct entry is not polled at all.
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
vi.mock("node-cron", () => ({ default: { schedule: vi.fn() } }))
vi.mock("drizzle-orm", async (importOriginal) => ({
  ...(await importOriginal<typeof import("drizzle-orm")>()),
  and: (...conditions: unknown[]) => ({ and: conditions }),
  eq: (column: unknown, value: unknown) => ({ eq: [column, value] }),
  isNull: (column: unknown) => ({ isNull: column }),
}))

const fetchStats = vi.fn()
vi.mock("@/lib/tracker-platforms", () => ({
  getAdapter: vi.fn(() => ({ fetchStats })),
  buildFetchOptions: vi.fn(() => ({})),
}))

import { getTrackerBySlug, TRACKER_REGISTRY } from "@/data/tracker-registry"
import { ALL_TRACKERS } from "@/data/trackers"
import { decrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { trackers } from "@/lib/db/schema"
import { dispatchNotifications } from "@/lib/notifications/dispatch"
import { recordTrackerPollFailure } from "@/lib/tracker-outages"
import { buildFetchOptions, getAdapter } from "@/lib/tracker-platforms"
import { pollTracker } from "@/lib/tracker-scheduler"
import { UNLINKED_RESTORE_ERROR } from "@/lib/tracker-status"

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
  seedbonus: null,
  hitAndRuns: null,
  seedingCount: null,
  leechingCount: null,
  requiredRatio: null,
  warned: null,
  freeleechTokens: null,
  shareScore: null,
  username: "JohnDoe",
  group: null,
  remoteUserId: null,
  joinedDate: null,
  lastAccessDate: null,
  platformMeta: null,
  avatarUrl: null,
}

function row(overrides: Record<string, unknown>) {
  return {
    id: 42,
    name: "Anthelion",
    isActive: true,
    encryptedApiToken: "enc",
    platformType: "nebulance",
    baseUrl: "https://anthelion.me",
    registrySlug: "anthelion",
    apiPath: "/api.php",
    useProxy: false,
    remoteUserId: null,
    joinedAt: null,
    platformMeta: null,
    lastPolledAt: null,
    lastError: null,
    lastErrorAt: null,
    consecutiveFailures: 0,
    pausedAt: null,
    userPausedAt: null,
    ...overrides,
  }
}

const KEY = Buffer.alloc(32)
const updates: { values: Record<string, unknown>; where: unknown }[] = []

function mockRow(tracker: Record<string, unknown>) {
  vi.mocked(db.select).mockImplementation(((cols: Record<string, unknown>) => {
    const keys = Object.keys(cols ?? {})
    if (keys.includes("encryptedApiToken")) return chain([tracker])
    return chain([])
  }) as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  updates.length = 0
  fetchStats.mockResolvedValue(STATS)
  vi.mocked(db.insert).mockImplementation((() => chain([])) as never)
  vi.mocked(db.update).mockImplementation((() => ({
    set: (values: Record<string, unknown>) => ({
      where: (where: unknown) => {
        updates.push({ values, where })
        return chain([{ id: 42, consecutiveFailures: 0, pausedAt: null }])
      },
    }),
  })) as never)
  vi.mocked(db.delete).mockImplementation((() => chain([])) as never)
})

describe("pollTracker takes the address from the registry entry", () => {
  it("polls the entry's address, API path and platform when every stored copy differs", async () => {
    const entry = getTrackerBySlug("anthelion")
    mockRow(
      row({ baseUrl: "https://old-anthelion.example", apiPath: "/old.php", platformType: "unit3d" })
    )

    await pollTracker(42, KEY, false, undefined)

    expect(getAdapter).toHaveBeenCalledWith(entry?.platform)
    expect(buildFetchOptions).toHaveBeenCalledWith(expect.objectContaining({ entry }))
    expect(fetchStats).toHaveBeenCalledWith(entry?.url, "token", entry?.apiPath, {})
    expect(updates.some(({ values }) => "baseUrl" in values)).toBe(false)
  })

  // Rows added before 09-28 store AnimeBytes as gazelle.
  it("sends an AnimeBytes row stored as gazelle with /ajax.php through the animebytes adapter", async () => {
    const entry = getTrackerBySlug("animebytes")
    mockRow(
      row({
        registrySlug: "animebytes",
        baseUrl: entry?.url,
        platformType: "gazelle",
        apiPath: "/ajax.php",
      })
    )

    await pollTracker(42, KEY, false, undefined)

    expect(getAdapter).toHaveBeenCalledWith("animebytes")
    expect(fetchStats).toHaveBeenCalledWith(entry?.url, "token", entry?.apiPath, {})
  })
})

describe("pollTracker never polls a row the tracker list cannot place", () => {
  const draftSlug = ALL_TRACKERS.find((t) => t.draft)?.slug

  it.each([
    ["no slug", null],
    ["a slug the list no longer carries", "gone-tracker"],
    ["a draft entry's slug", draftSlug],
  ])("pauses a row with %s once, naming the host it was set up for", async (_form, slug) => {
    expect(slug, "the registry has no draft entry left to test with").not.toBeUndefined()
    mockRow(row({ registrySlug: slug, baseUrl: "https://www.old-site.example" }))

    await pollTracker(42, KEY, false, undefined)

    expect(decrypt).not.toHaveBeenCalled()
    expect(fetchStats).not.toHaveBeenCalled()
    expect(db.insert).not.toHaveBeenCalled()
    // Not a failure, so no outage band and no tracker-down alert.
    expect(recordTrackerPollFailure).not.toHaveBeenCalled()
    expect(dispatchNotifications).not.toHaveBeenCalled()
    expect(updates).toEqual([
      {
        values: {
          pausedAt: expect.any(Date),
          lastError:
            "Not in the tracker list, so it isn't polled. It was set up for old-site.example",
          lastErrorAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
        // Only a row not yet paused is written, so overlapping polls write it once.
        where: { and: [{ eq: [trackers.id, 42] }, { isNull: trackers.pausedAt }] },
      },
    ])
  })

  it("leaves the host out when the stored address does not parse", async () => {
    mockRow(row({ registrySlug: null, baseUrl: "not a url" }))

    await pollTracker(42, KEY, false, undefined)

    expect(updates.map(({ values }) => values.lastError)).toEqual([
      "Not in the tracker list, so it isn't polled",
    ])
  })

  // A restore's own message says more about the row than this one would.
  it("writes nothing for an unlinked row that is already paused", async () => {
    mockRow(
      row({
        registrySlug: null,
        baseUrl: "https://evil.example",
        pausedAt: new Date("2026-10-30T00:00:00Z"),
        lastError: UNLINKED_RESTORE_ERROR,
      })
    )

    await pollTracker(42, KEY, false, undefined, undefined, undefined, true)

    expect(fetchStats).not.toHaveBeenCalled()
    expect(db.update).not.toHaveBeenCalled()
    expect(recordTrackerPollFailure).not.toHaveBeenCalled()
    expect(dispatchNotifications).not.toHaveBeenCalled()
  })

  it("polls nothing and writes nothing for a defunct entry", async () => {
    const defunct = TRACKER_REGISTRY.find((t) => t.defunct)
    expect(defunct, "the registry has no defunct entry left to test with").toBeDefined()
    mockRow(row({ registrySlug: defunct?.slug, baseUrl: defunct?.url }))

    await pollTracker(42, KEY, false, undefined)

    expect(decrypt).not.toHaveBeenCalled()
    expect(fetchStats).not.toHaveBeenCalled()
    expect(db.update).not.toHaveBeenCalled()
    expect(db.insert).not.toHaveBeenCalled()
    expect(recordTrackerPollFailure).not.toHaveBeenCalled()
    expect(dispatchNotifications).not.toHaveBeenCalled()
  })
})
