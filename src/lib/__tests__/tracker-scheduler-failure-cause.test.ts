// src/lib/__tests__/tracker-scheduler-failure-cause.test.ts
//
// The message a failed poll stores is deliberately lossy: sanitizeNetworkError
// collapses anything it does not recognise to "Poll failed", and that string
// is what the UI shows. Issue #214's logs carried exactly that and nothing
// else, so an adapter crash on a changed payload was indistinguishable from a
// dead host. The raw cause has to reach the server log next to the sanitised
// message, as download-client-scheduler already does for clients.

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
vi.mock("@/data/tracker-registry", () => ({ findRegistryEntry: vi.fn(() => null) }))
vi.mock("node-cron", () => ({ default: { schedule: vi.fn() } }))

const fetchStats = vi.fn()
vi.mock("@/lib/adapters", () => ({
  getAdapter: vi.fn(() => ({ fetchStats })),
  buildFetchOptions: vi.fn(() => ({})),
}))

import { db } from "@/lib/db"
import { log } from "@/lib/logger"
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

const TRACKER_ROW = {
  id: 42,
  name: "LST",
  isActive: true,
  encryptedApiToken: "enc",
  platformType: "unit3d",
  baseUrl: "https://lst.gg",
  apiPath: "/api/user",
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
  minimumRatio: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(db.select).mockImplementation(((cols: Record<string, unknown>) => {
    const keys = Object.keys(cols ?? {})
    if (keys.includes("encryptedApiToken")) return chain([TRACKER_ROW])
    return chain([])
  }) as never)
  vi.mocked(db.insert).mockImplementation((() => chain([])) as never)
  vi.mocked(db.update).mockImplementation((() =>
    chain([{ consecutiveFailures: 1, pausedAt: null }])) as never)
  vi.mocked(db.delete).mockImplementation((() => chain([])) as never)
})

const KEY = Buffer.alloc(32)

describe("pollTracker failure logging", () => {
  it("logs the raw cause next to the sanitised message", async () => {
    const raw = "Cannot read properties of undefined (reading 'trim')"
    fetchStats.mockRejectedValue(new Error(raw))

    await pollTracker(42, KEY, false)

    const entry = vi
      .mocked(log.error)
      .mock.calls.find(
        ([, msg]) => typeof msg === "string" && msg.startsWith("Poll failed for tracker 42")
      )
    expect(entry).toBeDefined()
    expect(entry?.[1]).toBe("Poll failed for tracker 42: Poll failed")
    expect(entry?.[0]).toMatchObject({ trackerId: 42, trackerName: "LST", cause: raw })
  })

  it("drops the bound params from a database failure's cause", async () => {
    // drizzle's DrizzleQueryError message is "Failed query: <sql>\nparams: <values>",
    // and the snapshot insert binds the username when privacy mode is off. The
    // SQL is the diagnostic; the values are not for the log.
    fetchStats.mockResolvedValue({
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
    })
    const dbMessage =
      'Failed query: insert into "snapshots" ("tracker_id", "username") values ($1, $2)\nparams: 42,JohnDoe'
    vi.mocked(db.insert).mockImplementation((() =>
      chain(Promise.reject(new Error(dbMessage)))) as never)

    await pollTracker(42, KEY, false)

    const entry = vi
      .mocked(log.error)
      .mock.calls.find(
        ([, msg]) => typeof msg === "string" && msg.startsWith("Poll failed for tracker 42")
      )
    expect(entry).toBeDefined()
    expect(entry?.[0]).toMatchObject({
      cause: 'Failed query: insert into "snapshots" ("tracker_id", "username") values ($1, $2)',
    })
    expect(JSON.stringify(entry?.[0])).not.toContain("JohnDoe")
  })
})
