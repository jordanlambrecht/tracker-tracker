// src/lib/__tests__/tracker-scheduler-url-refresh.test.ts
//
// A tracker row names its registry entry by slug; the URL it stores is only
// the poll address. When the registry's URL differs, because a site moved or
// the row was restored with an older spelling, the poll uses the registry URL
// and writes it back, so a domain change ships as a registry edit.
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
  registryEntryFor: vi.fn((t: { registrySlug: string | null }) =>
    t.registrySlug === "anthelion" ? { slug: "anthelion", url: "https://anthelion.me" } : undefined
  ),
}))
vi.mock("node-cron", () => ({ default: { schedule: vi.fn() } }))

const fetchStats = vi.fn()
vi.mock("@/lib/tracker-platforms", () => ({
  getAdapter: vi.fn(() => ({ fetchStats })),
  buildFetchOptions: vi.fn(() => ({})),
}))

import { db } from "@/lib/db"
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
    minimumRatio: null,
    ...overrides,
  }
}

const KEY = Buffer.alloc(32)
const setCalls: Record<string, unknown>[] = []

function mockRow(tracker: Record<string, unknown>) {
  vi.mocked(db.select).mockImplementation(((cols: Record<string, unknown>) => {
    const keys = Object.keys(cols ?? {})
    if (keys.includes("encryptedApiToken")) return chain([tracker])
    return chain([])
  }) as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  setCalls.length = 0
  fetchStats.mockResolvedValue(STATS)
  vi.mocked(db.insert).mockImplementation((() => chain([])) as never)
  vi.mocked(db.update).mockImplementation((() => ({
    set: (values: Record<string, unknown>) => {
      setCalls.push(values)
      return chain([{ consecutiveFailures: 0, pausedAt: null }])
    },
  })) as never)
  vi.mocked(db.delete).mockImplementation((() => chain([])) as never)
})

describe("pollTracker keeps a slug row's URL in step with the registry", () => {
  it("polls the registry URL and writes it back when the stored one differs", async () => {
    mockRow(row({ baseUrl: "http://anthelion.me" }))

    await pollTracker(42, KEY, false)

    expect(fetchStats).toHaveBeenCalledWith(
      "https://anthelion.me",
      expect.anything(),
      expect.anything(),
      expect.anything()
    )
    expect(setCalls.some((v) => v.baseUrl === "https://anthelion.me")).toBe(true)
  })

  it("writes nothing back when the stored URL already matches", async () => {
    mockRow(row({}))

    await pollTracker(42, KEY, false)

    expect(fetchStats).toHaveBeenCalledWith(
      "https://anthelion.me",
      expect.anything(),
      expect.anything(),
      expect.anything()
    )
    expect(setCalls.some((v) => "baseUrl" in v)).toBe(false)
  })

  it("polls the stored URL as it is for a row with no slug", async () => {
    mockRow(row({ registrySlug: null, baseUrl: "https://custom-unit3d.example" }))

    await pollTracker(42, KEY, false)

    expect(fetchStats).toHaveBeenCalledWith(
      "https://custom-unit3d.example",
      expect.anything(),
      expect.anything(),
      expect.anything()
    )
    expect(setCalls.some((v) => "baseUrl" in v)).toBe(false)
  })
})
