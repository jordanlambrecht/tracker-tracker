// src/lib/__tests__/tracker-scheduler-overview.test.ts
//
// An overview-only poll returns the account but no byte totals. The poll stores
// the account on the tracker row and resets the failure state, and writes no
// snapshot or daily checkpoint and runs no stat alerts.

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
  trackerSiteFor: vi.fn(() => ({
    url: "https://tracker.example",
    apiPath: "/forum/index.php",
    platform: "rutracker",
    entry: {},
  })),
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
function chain(result: unknown, onSet?: (values: unknown) => void): Record<string, unknown> {
  const settled = Promise.resolve(result)
  const proxy: Record<string, unknown> = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === "then") return settled.then.bind(settled)
        if (prop === "catch") return settled.catch.bind(settled)
        if (prop === "finally") return settled.finally.bind(settled)
        if (prop === "set" && onSet) {
          return (values: unknown) => {
            onSet(values)
            return proxy
          }
        }
        return () => proxy
      },
    }
  )
  return proxy
}

const OVERVIEW = {
  kind: "overview" as const,
  username: "someone",
  group: "User",
  remoteUserId: 1234,
  joinedDate: "2020-01-02",
  platformMeta: { role: "User" },
}

function trackerRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 42,
    name: "Example",
    isActive: true,
    encryptedApiToken: "enc",
    platformType: "rutracker",
    registrySlug: null,
    baseUrl: "https://tracker.example",
    apiPath: "/forum/index.php",
    useProxy: false,
    remoteUserId: null,
    joinedAt: null,
    platformMeta: null,
    lastPolledAt: null,
    lastError: "Session expired",
    lastErrorAt: new Date(),
    consecutiveFailures: 2,
    pausedAt: null,
    userPausedAt: null,
    ...overrides,
  }
}

let row = trackerRow()

let writes: Record<string, unknown>[] = []

beforeEach(() => {
  vi.clearAllMocks()
  writes = []
  row = trackerRow()
  vi.mocked(db.select).mockImplementation(((cols: Record<string, unknown>) => {
    const keys = Object.keys(cols ?? {})
    if (keys.includes("encryptedApiToken")) return chain([row])
    return chain([])
  }) as never)
  vi.mocked(db.insert).mockImplementation((() => chain([])) as never)
  vi.mocked(db.update).mockImplementation((() =>
    chain([], (values) => writes.push(values as Record<string, unknown>))) as never)
  vi.mocked(db.delete).mockImplementation((() => chain([])) as never)
})

const KEY = Buffer.alloc(32)

describe("pollTracker with an overview", () => {
  it("writes no snapshot or checkpoint and dispatches no alerts", async () => {
    fetchStats.mockResolvedValue(OVERVIEW)

    await pollTracker(42, KEY, false, undefined)

    expect(db.insert).not.toHaveBeenCalled()
    expect(dispatchNotifications).not.toHaveBeenCalled()
  })

  it("stores the username with the platform data on the tracker row", async () => {
    fetchStats.mockResolvedValue(OVERVIEW)

    await pollTracker(42, KEY, false, undefined)

    expect(writes[0]).toMatchObject({
      remoteUserId: 1234,
      joinedAt: "2020-01-02",
      platformMeta: JSON.stringify({ role: "User", username: "someone" }),
    })
  })

  it("masks the username in privacy mode", async () => {
    fetchStats.mockResolvedValue(OVERVIEW)

    await pollTracker(42, KEY, true, undefined)

    expect(writes[0]).toMatchObject({
      platformMeta: JSON.stringify({ role: "User", username: "▓7" }),
    })
  })

  it("records the poll as a success", async () => {
    fetchStats.mockResolvedValue(OVERVIEW)

    await pollTracker(42, KEY, false, undefined)

    expect(writes.at(-1)).toMatchObject({
      lastError: null,
      lastErrorAt: null,
      consecutiveFailures: 0,
      pausedAt: null,
    })
    expect(writes.at(-1)?.lastPolledAt).toBeInstanceOf(Date)
  })
})

describe("pollTracker join date", () => {
  it("takes the join date of another account the credentials now belong to", async () => {
    row = trackerRow({ remoteUserId: 999, joinedAt: "2026-10-22" })
    fetchStats.mockResolvedValue(OVERVIEW)

    await pollTracker(42, KEY, false, undefined)

    expect(writes[0]).toMatchObject({ remoteUserId: 1234, joinedAt: "2020-01-02" })
  })

  it("keeps a stored join date while the account is the same", async () => {
    row = trackerRow({ remoteUserId: 1234, joinedAt: "2026-10-22" })
    fetchStats.mockResolvedValue(OVERVIEW)

    await pollTracker(42, KEY, false, undefined)

    expect(writes[0]).not.toHaveProperty("joinedAt")
  })

  it("keeps a stored join date when no account was recorded before", async () => {
    row = trackerRow({ remoteUserId: null, joinedAt: "2026-10-22" })
    fetchStats.mockResolvedValue(OVERVIEW)

    await pollTracker(42, KEY, false, undefined)

    expect(writes[0]).not.toHaveProperty("joinedAt")
  })
})
