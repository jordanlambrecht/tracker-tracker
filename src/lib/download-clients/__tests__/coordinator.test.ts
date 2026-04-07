// src/lib/download-clients/__tests__/coordinator.test.ts
//
// Functions:
//   makeTracker           - Build a minimal tracker row for DB mock returns
//   makeFetchClient       - Build a client row with credential columns (FETCH_CLIENT_COLUMNS shape)
//   makeCachedClient      - Build a client row for cached reads (CACHED_CLIENT_COLUMNS shape)
//   makeCachedClientFull  - Build a client row for fetchTrackerTorrentsCached (includes cachedTorrents)
//   makeTorrent           - Build a minimal TorrentRecord for tests
//   makeSlimTorrent       - Build a SlimTorrent for tests
//   makeEmptyAggregation  - Build an empty FleetAggregation for mocked returns

import { beforeEach, describe, expect, it, vi } from "vitest"

// ---------------------------------------------------------------------------
// Module mocks (must be before any imports from the module under test)
// ---------------------------------------------------------------------------

vi.mock("server-only", () => ({}))

// Drizzle operators: just pass-through identity stubs
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
  isNotNull: vi.fn((col: unknown) => ({ type: "isNotNull", col })),
}))

// DB mock
const mockSelect = vi.fn()

vi.mock("@/lib/db", () => ({
  db: { select: (...args: unknown[]) => mockSelect(...args) },
}))

vi.mock("@/lib/db/schema", () => ({
  trackers: {
    id: "trackers.id",
    name: "trackers.name",
    qbtTag: "trackers.qbtTag",
    color: "trackers.color",
    isActive: "trackers.isActive",
  },
  downloadClients: {
    id: "downloadClients.id",
    name: "downloadClients.name",
    host: "downloadClients.host",
    port: "downloadClients.port",
    useSsl: "downloadClients.useSsl",
    enabled: "downloadClients.enabled",
    encryptedUsername: "downloadClients.encryptedUsername",
    encryptedPassword: "downloadClients.encryptedPassword",
    crossSeedTags: "downloadClients.crossSeedTags",
    cachedTorrents: "downloadClients.cachedTorrents",
    cachedTorrentsAt: "downloadClients.cachedTorrentsAt",
  },
}))

vi.mock("@/lib/fleet", () => ({
  parseTorrentTags: vi.fn((tags: string) =>
    tags
      .split(",")
      .map((t: string) => t.trim().toLowerCase())
      .filter(Boolean)
  ),
}))

vi.mock("@/lib/fleet-aggregation", () => ({
  computeFleetAggregation: vi.fn(() => makeEmptyAggregation()),
}))

vi.mock("../credentials", () => ({
  CLIENT_CONNECTION_COLUMNS: {
    name: "downloadClients.name",
    host: "downloadClients.host",
    port: "downloadClients.port",
    useSsl: "downloadClients.useSsl",
    encryptedUsername: "downloadClients.encryptedUsername",
    encryptedPassword: "downloadClients.encryptedPassword",
  },
}))

vi.mock("../fetch", () => ({
  fetchAndMergeTorrents: vi.fn(),
  stripSensitiveTorrentFields: vi.fn((t: Record<string, unknown>) => {
    const { tracker: _t, contentPath: _cp, savePath: _sp, ...rest } = t
    return rest
  }),
}))

vi.mock("../merge", () => ({
  mergeTorrentLists: vi.fn((lists: unknown[][]) => lists.flat()),
  stampClientNames: vi.fn(
    (
      clientTorrents: { clientName: string; torrents: { hash: string }[] }[],
      merged: { hash: string }[]
    ) => {
      const hashClients = new Map<string, string[]>()
      for (const { clientName, torrents } of clientTorrents) {
        for (const t of torrents) {
          const names = hashClients.get(t.hash) ?? []
          names.push(clientName)
          hashClients.set(t.hash, names)
        }
      }
      return merged.map((t) => ({
        ...t,
        clientName: (hashClients.get(t.hash) ?? []).join(", "),
      }))
    }
  ),
  aggregateCrossSeedTags: vi.fn((clients: { crossSeedTags: string[] }[]) => {
    const tagSet = new Set<string>()
    for (const c of clients) {
      for (const tag of c.crossSeedTags) tagSet.add(tag)
    }
    return [...tagSet]
  }),
}))

vi.mock("../sync-store", () => ({
  STORE_MAX_AGE_MS: 10 * 60 * 1000,
  isStoreFresh: vi.fn(() => false),
  getFilteredTorrents: vi.fn(() => []),
}))

vi.mock("../transforms", () => ({
  parseCrossSeedTags: vi.fn((raw: string[] | null) => raw ?? []),
  slimTorrentForCache: vi.fn((t: unknown) => t),
}))

vi.mock("../qbt/transport", () => ({
  buildBaseUrl: vi.fn(
    (host: string, port: number, ssl: boolean) => `${ssl ? "https" : "http"}://${host}:${port}`
  ),
  parseCachedTorrents: vi.fn(() => []),
}))

// ---------------------------------------------------------------------------
// Re-import mocked modules for assertions
// ---------------------------------------------------------------------------

import type { TorrentRecord } from "@/lib/download-clients"
import { parseTorrentTags } from "@/lib/fleet"
import { computeFleetAggregation } from "@/lib/fleet-aggregation"
// Import module under test (after all mocks are registered)
import {
  fetchFleetAggregation,
  fetchFleetTorrents,
  fetchTrackerTorrents,
  fetchTrackerTorrentsCached,
} from "../coordinator"
import { fetchAndMergeTorrents } from "../fetch"
import { aggregateCrossSeedTags, mergeTorrentLists, stampClientNames } from "../merge"
import { buildBaseUrl, parseCachedTorrents } from "../qbt/transport"
import { getFilteredTorrents, isStoreFresh } from "../sync-store"
import { slimTorrentForCache } from "../transforms"

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeTracker(overrides: { qbtTag?: string | null; name?: string; color?: string } = {}) {
  return {
    qbtTag: "aither",
    name: "Aither",
    color: "#00d4ff",
    ...overrides,
  }
}

function makeFetchClient(
  overrides: Partial<{
    name: string
    host: string
    port: number
    useSsl: boolean
    encryptedUsername: string
    encryptedPassword: string
    crossSeedTags: string[] | null
  }> = {}
) {
  return {
    name: "Home qBT",
    host: "localhost",
    port: 8080,
    useSsl: false,
    encryptedUsername: "enc-admin",
    encryptedPassword: "enc-pass",
    crossSeedTags: null,
    ...overrides,
  }
}

function makeCachedClient(
  overrides: Partial<{
    id: number
    name: string
    host: string
    port: number
    useSsl: boolean
    crossSeedTags: string[] | null
    cachedTorrentsAt: Date | null
  }> = {}
) {
  return {
    id: 1,
    name: "Home qBT",
    host: "localhost",
    port: 8080,
    useSsl: false,
    crossSeedTags: null,
    cachedTorrentsAt: new Date("2026-04-01T12:00:00Z"),
    ...overrides,
  }
}

function makeCachedClientFull(
  overrides: Partial<{
    id: number
    name: string
    cachedTorrents: unknown
    cachedTorrentsAt: Date | null
    crossSeedTags: string[] | null
  }> = {}
) {
  return {
    id: 1,
    name: "Home qBT",
    cachedTorrents: null,
    cachedTorrentsAt: new Date("2026-04-01T12:00:00Z"),
    crossSeedTags: null,
    ...overrides,
  }
}

function makeTorrent(hash: string, overrides: Partial<TorrentRecord> = {}): TorrentRecord {
  return {
    hash,
    name: `Torrent ${hash}`,
    state: "stalledUP",
    tags: "aither",
    category: "movies",
    uploadSpeed: 0,
    downloadSpeed: 0,
    uploaded: 1000,
    downloaded: 500,
    ratio: 2.0,
    size: 1_000_000,
    seedCount: 5,
    leechCount: 1,
    swarmSeeders: 10,
    swarmLeechers: 2,
    tracker: "https://tracker.example.com/announce",
    addedAt: 1700000000,
    completedAt: 1700001000,
    lastActivityAt: 1700002000,
    seedingTime: 86400,
    activeTime: 86400,
    lastSeenComplete: 1700001500,
    availability: 1.0,
    remaining: 0,
    progress: 1.0,
    contentPath: "/data/movies/torrent",
    savePath: "/data/movies",
    ...overrides,
  }
}

function _makeSlimTorrent(hash: string, overrides: Partial<TorrentRecord> = {}) {
  const t = makeTorrent(hash, overrides)
  return {
    hash: t.hash,
    name: t.name,
    state: t.state,
    tags: t.tags,
    category: t.category,
    uploaded: t.uploaded,
    downloaded: t.downloaded,
    ratio: t.ratio,
    size: t.size,
    seedingTime: t.seedingTime,
    activeTime: t.activeTime,
    addedAt: t.addedAt,
    completedAt: t.completedAt,
    lastActivityAt: t.lastActivityAt,
    remaining: t.remaining,
    seedCount: t.seedCount,
    leechCount: t.leechCount,
    swarmSeeders: t.swarmSeeders,
    swarmLeechers: t.swarmLeechers,
    uploadSpeed: t.uploadSpeed,
    downloadSpeed: t.downloadSpeed,
    availability: t.availability,
    progress: t.progress,
  }
}

function makeEmptyAggregation() {
  return {
    stats: {
      torrentCount: 0,
      totalUploaded: 0,
      totalDownloaded: 0,
      avgRatio: 0,
      seedingCount: 0,
      leechingCount: 0,
      uploadSpeed: 0,
      downloadSpeed: 0,
      totalSize: 0,
    },
    ratioDistribution: [],
    seedTimeDistribution: [],
    crossSeed: { crossSeeded: 0, unique: 0, total: 0 },
    activityGrid: { data: [], maxCount: 0 },
    trackerHealth: [],
    storageByTrackerCategory: [],
    categoryBreakdown: [],
    crossSeedNetwork: { nodes: [], edges: [] },
    sizesByTracker: [],
    ageTimeline: [],
    categoryTimeline: [],
    ageBands: [],
  }
}

function makeKey(): Buffer {
  return Buffer.alloc(32, 0xab)
}

// ---------------------------------------------------------------------------
// DB mock helpers
// ---------------------------------------------------------------------------

// The coordinator makes multiple sequential db.select() calls per function.
// We need to control what each call returns based on invocation order.
// selectCallIndex tracks the call sequence; each test sets up the expected returns.

let selectReturns: unknown[][]
let selectCallIndex: number

/**
 * Set up sequential db.select() return values. Each entry in the array
 * corresponds to one db.select() invocation in call order.
 * Each entry is an array of row objects that the query chain resolves to.
 */
function setupDbReturns(returns: unknown[][]) {
  selectReturns = returns
  selectCallIndex = 0

  mockSelect.mockImplementation((..._args: unknown[]) => {
    const rows = selectReturns[selectCallIndex] ?? []
    selectCallIndex++

    const chain = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => {
          // Return rows directly (for queries without .limit())
          // AND as an object with .limit() (for queries that chain .limit())
          const result = Object.assign(Promise.resolve(rows), {
            limit: vi.fn().mockResolvedValue(rows),
          })
          return result
        }),
      }),
    }
    return chain
  })
}

// ---------------------------------------------------------------------------
// Tests: fetchFleetTorrents
// ---------------------------------------------------------------------------

describe("fetchFleetTorrents", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should query active trackers and enabled clients in parallel", async () => {
    const mergedResult = {
      torrents: [],
      crossSeedTags: [],
      clientErrors: [],
      clientCount: 0,
      sessionExpired: false,
    }
    vi.mocked(fetchAndMergeTorrents).mockResolvedValue(mergedResult)

    // Call 0: trackers query, Call 1: clients query (parallel via Promise.all)
    setupDbReturns([[{ qbtTag: "aither" }, { qbtTag: "blutopia" }], [makeFetchClient()]])

    await fetchFleetTorrents(makeKey())

    // db.select was called twice (once for trackers, once for clients)
    expect(mockSelect).toHaveBeenCalledTimes(2)
  })

  it("should collect and deduplicate tags from all active trackers", async () => {
    const mergedResult = {
      torrents: [],
      crossSeedTags: [],
      clientErrors: [],
      clientCount: 0,
      sessionExpired: false,
    }
    vi.mocked(fetchAndMergeTorrents).mockResolvedValue(mergedResult)

    setupDbReturns([
      [{ qbtTag: "aither" }, { qbtTag: "aither" }, { qbtTag: "blutopia" }],
      [makeFetchClient()],
    ])

    await fetchFleetTorrents(makeKey())

    // fetchAndMergeTorrents receives deduplicated tags
    expect(fetchAndMergeTorrents).toHaveBeenCalledWith(
      expect.any(Array),
      ["aither", "blutopia"], // deduplicated
      expect.any(Buffer),
      undefined
    )
  })

  it("should filter out null and empty tags", async () => {
    const mergedResult = {
      torrents: [],
      crossSeedTags: [],
      clientErrors: [],
      clientCount: 0,
      sessionExpired: false,
    }
    vi.mocked(fetchAndMergeTorrents).mockResolvedValue(mergedResult)

    setupDbReturns([
      [{ qbtTag: null }, { qbtTag: "" }, { qbtTag: "  " }, { qbtTag: "aither" }],
      [makeFetchClient()],
    ])

    await fetchFleetTorrents(makeKey())

    expect(fetchAndMergeTorrents).toHaveBeenCalledWith(
      expect.any(Array),
      ["aither"],
      expect.any(Buffer),
      undefined
    )
  })

  it("should trim whitespace from tags", async () => {
    const mergedResult = {
      torrents: [],
      crossSeedTags: [],
      clientErrors: [],
      clientCount: 0,
      sessionExpired: false,
    }
    vi.mocked(fetchAndMergeTorrents).mockResolvedValue(mergedResult)

    setupDbReturns([[{ qbtTag: "  aither  " }, { qbtTag: "blutopia " }], [makeFetchClient()]])

    await fetchFleetTorrents(makeKey())

    expect(fetchAndMergeTorrents).toHaveBeenCalledWith(
      expect.any(Array),
      ["aither", "blutopia"],
      expect.any(Buffer),
      undefined
    )
  })

  it("should pass the filter parameter through to fetchAndMergeTorrents", async () => {
    const mergedResult = {
      torrents: [],
      crossSeedTags: [],
      clientErrors: [],
      clientCount: 0,
      sessionExpired: false,
    }
    vi.mocked(fetchAndMergeTorrents).mockResolvedValue(mergedResult)

    setupDbReturns([[{ qbtTag: "aither" }], [makeFetchClient()]])

    await fetchFleetTorrents(makeKey(), "active")

    expect(fetchAndMergeTorrents).toHaveBeenCalledWith(
      expect.any(Array),
      ["aither"],
      expect.any(Buffer),
      "active"
    )
  })

  it("should pass all enabled clients to fetchAndMergeTorrents", async () => {
    const mergedResult = {
      torrents: [],
      crossSeedTags: [],
      clientErrors: [],
      clientCount: 2,
      sessionExpired: false,
    }
    vi.mocked(fetchAndMergeTorrents).mockResolvedValue(mergedResult)

    const client1 = makeFetchClient({ name: "Client A" })
    const client2 = makeFetchClient({ name: "Client B" })

    setupDbReturns([[{ qbtTag: "aither" }], [client1, client2]])

    await fetchFleetTorrents(makeKey())

    expect(fetchAndMergeTorrents).toHaveBeenCalledWith(
      [client1, client2],
      expect.any(Array),
      expect.any(Buffer),
      undefined
    )
  })

  it("should return the MergedResult from fetchAndMergeTorrents directly", async () => {
    const mergedResult = {
      torrents: [{ hash: "abc", clientName: "Home qBT" }],
      crossSeedTags: ["cross-seed"],
      clientErrors: [],
      clientCount: 1,
      sessionExpired: false,
    }
    vi.mocked(fetchAndMergeTorrents).mockResolvedValue(mergedResult as never)

    setupDbReturns([[{ qbtTag: "aither" }], [makeFetchClient()]])

    const result = await fetchFleetTorrents(makeKey())
    expect(result).toBe(mergedResult)
  })
})

// ---------------------------------------------------------------------------
// Tests: fetchTrackerTorrents
// ---------------------------------------------------------------------------

describe("fetchTrackerTorrents", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return 404 when tracker is not found", async () => {
    setupDbReturns([
      [], // tracker lookup returns nothing
    ])

    const result = await fetchTrackerTorrents(999, makeKey())

    expect(result).toEqual({ error: "Tracker not found", status: 404 })
  })

  it("should return 400 when tracker has no qbtTag", async () => {
    setupDbReturns([[{ qbtTag: null }]])

    const result = await fetchTrackerTorrents(1, makeKey())

    expect(result).toEqual({
      error: "No qBittorrent tag configured for this tracker",
      status: 400,
    })
  })

  it("should query enabled clients and call fetchAndMergeTorrents with the single tag", async () => {
    const mergedResult = {
      torrents: [],
      crossSeedTags: [],
      clientErrors: [],
      clientCount: 1,
      sessionExpired: false,
    }
    vi.mocked(fetchAndMergeTorrents).mockResolvedValue(mergedResult)

    const client = makeFetchClient()
    setupDbReturns([
      [{ qbtTag: "aither" }], // tracker lookup
      [client], // clients query
    ])

    const result = await fetchTrackerTorrents(1, makeKey())

    expect(fetchAndMergeTorrents).toHaveBeenCalledWith(
      [client],
      ["aither"],
      expect.any(Buffer),
      undefined
    )
    expect(result).toEqual({ result: mergedResult })
  })

  it("should trim the qbtTag before passing to fetchAndMergeTorrents", async () => {
    const mergedResult = {
      torrents: [],
      crossSeedTags: [],
      clientErrors: [],
      clientCount: 0,
      sessionExpired: false,
    }
    vi.mocked(fetchAndMergeTorrents).mockResolvedValue(mergedResult)

    setupDbReturns([[{ qbtTag: "  aither  " }], []])

    await fetchTrackerTorrents(1, makeKey())

    expect(fetchAndMergeTorrents).toHaveBeenCalledWith(
      expect.any(Array),
      ["aither"],
      expect.any(Buffer),
      undefined
    )
  })

  it("should pass the filter parameter through", async () => {
    const mergedResult = {
      torrents: [],
      crossSeedTags: [],
      clientErrors: [],
      clientCount: 0,
      sessionExpired: false,
    }
    vi.mocked(fetchAndMergeTorrents).mockResolvedValue(mergedResult)

    setupDbReturns([[{ qbtTag: "aither" }], [makeFetchClient()]])

    await fetchTrackerTorrents(1, makeKey(), "active")

    expect(fetchAndMergeTorrents).toHaveBeenCalledWith(
      expect.any(Array),
      ["aither"],
      expect.any(Buffer),
      "active"
    )
  })

  it("should wrap successful result in { result: ... }", async () => {
    const mergedResult = {
      torrents: [{ hash: "t1", clientName: "Home qBT" }],
      crossSeedTags: [],
      clientErrors: ["Client B: timeout"],
      clientCount: 2,
      sessionExpired: false,
    }
    vi.mocked(fetchAndMergeTorrents).mockResolvedValue(mergedResult as never)

    setupDbReturns([[{ qbtTag: "aither" }], [makeFetchClient()]])

    const result = await fetchTrackerTorrents(1, makeKey())

    expect(result).toEqual({ result: mergedResult })
    expect(result).not.toHaveProperty("error")
    expect(result).not.toHaveProperty("status")
  })
})

// ---------------------------------------------------------------------------
// Tests: fetchFleetAggregation
// ---------------------------------------------------------------------------

describe("fetchFleetAggregation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isStoreFresh).mockReturnValue(false)
    vi.mocked(getFilteredTorrents).mockReturnValue([])
    vi.mocked(parseCachedTorrents).mockReturnValue([])
  })

  it("should return empty aggregation with zero clientCount when no enabled clients", async () => {
    setupDbReturns([
      [], // clients query returns nothing
    ])

    const result = await fetchFleetAggregation()

    expect(computeFleetAggregation).toHaveBeenCalledWith([], [], [])
    expect(result.clientCount).toBe(0)
    expect(result.clientErrors).toEqual([])
    expect(result.cachedAt).toBeNull()
  })

  it("should query tracker tag metadata when clients exist", async () => {
    setupDbReturns([
      [makeCachedClient()], // clients
      [makeTracker({ qbtTag: "aither", name: "Aither", color: "#00d4ff" })], // trackerTagRows
      [{ cachedTorrents: null }], // DB fallback for client
    ])

    await fetchFleetAggregation()

    // At least 2 db.select calls: one for clients, one for trackerTagRows
    expect(mockSelect).toHaveBeenCalledTimes(3)
  })

  it("should use sync store fast path when store is fresh", async () => {
    vi.mocked(isStoreFresh).mockReturnValue(true)
    vi.mocked(getFilteredTorrents).mockReturnValue([])

    setupDbReturns([[makeCachedClient()], [makeTracker()]])

    await fetchFleetAggregation()

    expect(isStoreFresh).toHaveBeenCalledWith("http://localhost:8080", expect.any(Number))
    expect(getFilteredTorrents).toHaveBeenCalledWith("http://localhost:8080", expect.any(Function))
  })

  it("should fall back to Postgres JSONB when store is stale", async () => {
    vi.mocked(isStoreFresh).mockReturnValue(false)
    vi.mocked(parseCachedTorrents).mockReturnValue([])

    setupDbReturns([
      [makeCachedClient()],
      [makeTracker()],
      [{ cachedTorrents: "[]" }], // DB fallback query
    ])

    await fetchFleetAggregation()

    // parseCachedTorrents called for the DB fallback
    expect(parseCachedTorrents).toHaveBeenCalled()
    // getFilteredTorrents should NOT have been called (store is stale)
    expect(getFilteredTorrents).not.toHaveBeenCalled()
  })

  it("should slim torrents from sync store via slimTorrentForCache", async () => {
    const torrent = makeTorrent("h1", { tags: "aither" })
    vi.mocked(isStoreFresh).mockReturnValue(true)
    vi.mocked(getFilteredTorrents).mockReturnValue([torrent])

    setupDbReturns([[makeCachedClient()], [makeTracker()]])

    await fetchFleetAggregation()

    // slimTorrentForCache is called via .map(), so it receives (element, index, array)
    expect(slimTorrentForCache).toHaveBeenCalled()
    expect(vi.mocked(slimTorrentForCache).mock.calls[0][0]).toEqual(torrent)
  })

  it("should call mergeTorrentLists and stampClientNames with collected data", async () => {
    const torrent = makeTorrent("h1", { tags: "aither" })
    vi.mocked(isStoreFresh).mockReturnValue(true)
    vi.mocked(getFilteredTorrents).mockReturnValue([torrent])

    setupDbReturns([[makeCachedClient({ name: "My Client" })], [makeTracker()]])

    await fetchFleetAggregation()

    expect(mergeTorrentLists).toHaveBeenCalled()
    expect(stampClientNames).toHaveBeenCalled()
  })

  it("should pass trackerTagsWithMeta and crossSeedTags to computeFleetAggregation", async () => {
    vi.mocked(isStoreFresh).mockReturnValue(true)
    vi.mocked(getFilteredTorrents).mockReturnValue([])

    setupDbReturns([
      [makeCachedClient({ crossSeedTags: ["cross-seed"] })],
      [makeTracker({ qbtTag: "aither", name: "Aither", color: "#ff0000" })],
    ])

    await fetchFleetAggregation()

    expect(computeFleetAggregation).toHaveBeenCalledWith(
      expect.any(Array), // stamped torrents
      [{ tag: "aither", name: "Aither", color: "#ff0000" }],
      expect.any(Array) // crossSeedTags
    )
  })

  it("should use default color #01d4ff when tracker color is null", async () => {
    vi.mocked(isStoreFresh).mockReturnValue(true)
    vi.mocked(getFilteredTorrents).mockReturnValue([])

    setupDbReturns([
      [makeCachedClient()],
      [makeTracker({ qbtTag: "aither", name: "Aither", color: null as unknown as string })],
    ])

    await fetchFleetAggregation()

    expect(computeFleetAggregation).toHaveBeenCalledWith(
      expect.any(Array),
      [{ tag: "aither", name: "Aither", color: "#01d4ff" }],
      expect.any(Array)
    )
  })

  it("should return correct clientCount matching the number of enabled clients", async () => {
    vi.mocked(isStoreFresh).mockReturnValue(true)
    vi.mocked(getFilteredTorrents).mockReturnValue([])

    setupDbReturns([[makeCachedClient({ id: 1 }), makeCachedClient({ id: 2 })], [makeTracker()]])

    const result = await fetchFleetAggregation()

    expect(result.clientCount).toBe(2)
  })

  it("should track the oldest cachedTorrentsAt across clients", async () => {
    const olderDate = new Date("2026-03-01T12:00:00Z")
    const newerDate = new Date("2026-04-01T12:00:00Z")

    const torrent1 = makeTorrent("h1", { tags: "aither" })
    const torrent2 = makeTorrent("h2", { tags: "aither" })

    vi.mocked(isStoreFresh).mockReturnValue(true)

    // getFilteredTorrents will be called for each client; return a torrent each time
    // so the client contributes to clientTorrents (otherwise it's skipped)
    vi.mocked(getFilteredTorrents).mockReturnValueOnce([torrent1]).mockReturnValueOnce([torrent2])

    vi.mocked(buildBaseUrl)
      .mockReturnValueOnce("http://client1:8080")
      .mockReturnValueOnce("http://client2:8080")

    setupDbReturns([
      [
        makeCachedClient({ id: 1, name: "Old", host: "client1", cachedTorrentsAt: olderDate }),
        makeCachedClient({ id: 2, name: "New", host: "client2", cachedTorrentsAt: newerDate }),
      ],
      [makeTracker()],
    ])

    const result = await fetchFleetAggregation()

    expect(result.cachedAt).toBe(olderDate.toISOString())
  })

  it("should return null cachedAt when no client has cachedTorrentsAt", async () => {
    vi.mocked(isStoreFresh).mockReturnValue(true)
    vi.mocked(getFilteredTorrents).mockReturnValue([])

    setupDbReturns([[makeCachedClient({ cachedTorrentsAt: null })], [makeTracker()]])

    const result = await fetchFleetAggregation()

    expect(result.cachedAt).toBeNull()
  })

  it("should skip clients with zero torrents from the clientTorrents array", async () => {
    vi.mocked(isStoreFresh).mockReturnValue(true)
    vi.mocked(getFilteredTorrents).mockReturnValue([]) // no torrents

    setupDbReturns([[makeCachedClient()], [makeTracker()]])

    await fetchFleetAggregation()

    // mergeTorrentLists receives an empty array of lists (client was skipped)
    expect(mergeTorrentLists).toHaveBeenCalledWith([])
  })

  it("should report clientErrors when a client with cachedTorrentsAt returns 0 torrents", async () => {
    vi.mocked(isStoreFresh).mockReturnValue(true)
    vi.mocked(getFilteredTorrents).mockReturnValue([])

    setupDbReturns([[makeCachedClient()], [makeTracker()]])

    const result = await fetchFleetAggregation()

    expect(result.clientErrors).toEqual(["Home qBT: cached data unavailable or corrupt"])
  })

  it("should build the correct allTags set from trackers and crossSeedTags", async () => {
    vi.mocked(isStoreFresh).mockReturnValue(true)

    // The tag predicate uses allTags to filter. We can verify it works by
    // having getFilteredTorrents invoke the predicate.
    vi.mocked(getFilteredTorrents).mockImplementation(
      (_url: string, pred: (t: TorrentRecord) => boolean) => {
        const t1 = makeTorrent("h1", { tags: "aither" })
        const t2 = makeTorrent("h2", { tags: "cross-seed" })
        const t3 = makeTorrent("h3", { tags: "untracked" })
        return [t1, t2, t3].filter(pred)
      }
    )

    setupDbReturns([
      [makeCachedClient({ crossSeedTags: ["cross-seed"] })],
      [makeTracker({ qbtTag: "aither" })],
    ])

    await fetchFleetAggregation()

    // The predicate should match "aither" and "cross-seed" but not "untracked"
    // mergeTorrentLists should receive 2 torrents (h1 and h2)
    const mergeCall = vi.mocked(mergeTorrentLists).mock.calls[0]
    const flatTorrents = (mergeCall[0] as { hash: string }[][]).flat()
    const hashes = flatTorrents.map((t) => t.hash)
    expect(hashes).toContain("h1")
    expect(hashes).toContain("h2")
    expect(hashes).not.toContain("h3")
  })
})

// ---------------------------------------------------------------------------
// Tests: fetchTrackerTorrentsCached
// ---------------------------------------------------------------------------

describe("fetchTrackerTorrentsCached", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(parseCachedTorrents).mockReturnValue([])
  })

  it("should return 404 when tracker is not found", async () => {
    setupDbReturns([
      [], // tracker lookup returns nothing
    ])

    const result = await fetchTrackerTorrentsCached(999)

    expect(result).toEqual({ error: "Tracker not found", status: 404 })
  })

  it("should return 400 when tracker has no qbtTag", async () => {
    setupDbReturns([[{ qbtTag: null }]])

    const result = await fetchTrackerTorrentsCached(1)

    expect(result).toEqual({ error: "No qBittorrent tag configured", status: 400 })
  })

  it("should return empty result when no enabled clients exist", async () => {
    setupDbReturns([
      [{ qbtTag: "aither" }], // tracker found
      [], // no clients
    ])

    const result = await fetchTrackerTorrentsCached(1)

    expect(result).toEqual({
      result: {
        torrents: [],
        crossSeedTags: [],
        clientErrors: [],
        clientCount: 0,
        cachedAt: null,
      },
    })
  })

  it("should parse cached torrents from each client and filter by tracker tag", async () => {
    const matchTorrent = makeTorrent("match", { tags: "aither" })
    const noMatchTorrent = makeTorrent("nomatch", { tags: "blutopia" })
    vi.mocked(parseCachedTorrents).mockReturnValue([matchTorrent, noMatchTorrent])

    setupDbReturns([
      [{ qbtTag: "aither" }],
      [makeCachedClientFull({ cachedTorrents: "cached-json" })],
    ])

    const result = await fetchTrackerTorrentsCached(1)

    expect(parseCachedTorrents).toHaveBeenCalledWith("cached-json")
    expect(parseTorrentTags).toHaveBeenCalled()

    // Should only include the matching torrent
    expect("result" in result).toBe(true)
    if ("result" in result) {
      // The merge mock flattens; stampClientNames adds clientName;
      // stripSensitiveTorrentFields removes tracker/contentPath/savePath
      expect(result.result.torrents.length).toBeGreaterThanOrEqual(1)
      const hashes = result.result.torrents.map((t) => t.hash)
      expect(hashes).toContain("match")
      expect(hashes).not.toContain("nomatch")
    }
  })

  it("should trim and lowercase the qbtTag for case-insensitive matching", async () => {
    const torrent = makeTorrent("h1", { tags: "Aither" })
    vi.mocked(parseCachedTorrents).mockReturnValue([torrent])

    // parseTorrentTags returns lowercase tags (as the mock does)
    // The coordinator trims and lowercases the tag before comparing
    setupDbReturns([[{ qbtTag: "  Aither  " }], [makeCachedClientFull()]])

    const result = await fetchTrackerTorrentsCached(1)

    expect("result" in result).toBe(true)
    if ("result" in result) {
      expect(result.result.torrents.length).toBe(1)
    }
  })

  it("should skip clients whose cached torrents are all empty after parse", async () => {
    vi.mocked(parseCachedTorrents).mockReturnValue([])

    setupDbReturns([[{ qbtTag: "aither" }], [makeCachedClientFull()]])

    const result = await fetchTrackerTorrentsCached(1)

    // No clientTorrents contributed, so merge gets empty input
    expect(mergeTorrentLists).toHaveBeenCalledWith([])
    if ("result" in result) {
      expect(result.result.clientCount).toBe(1) // still counted
    }
  })

  it("should collect crossSeedTags from all clients with parsed torrents", async () => {
    const torrent = makeTorrent("h1", { tags: "aither" })
    vi.mocked(parseCachedTorrents).mockReturnValue([torrent])

    setupDbReturns([
      [{ qbtTag: "aither" }],
      [
        makeCachedClientFull({ id: 1, crossSeedTags: ["cross-seed-a"] }),
        makeCachedClientFull({ id: 2, crossSeedTags: ["cross-seed-b"] }),
      ],
    ])

    const result = await fetchTrackerTorrentsCached(1)

    expect(aggregateCrossSeedTags).toHaveBeenCalled()
    if ("result" in result) {
      expect(result.result.crossSeedTags).toEqual(
        expect.arrayContaining(["cross-seed-a", "cross-seed-b"])
      )
    }
  })

  it("should not expose tracker, contentPath, or savePath on returned torrents", async () => {
    // parseCachedTorrents returns SlimTorrent objects which were stripped of sensitive fields
    // at cache-write time. Use a slim fixture (no tracker/contentPath/savePath) to match
    // the real shape of what comes out of the JSONB cache.
    const slimTorrent = {
      hash: "h1",
      name: "Test.mkv",
      state: "uploading",
      tags: "aither",
      category: "movies",
      uploaded: 1000,
      downloaded: 500,
      ratio: 2.0,
      size: 1_000_000,
      seedingTime: 86400,
      activeTime: 86400,
      addedAt: 1700000000,
      completedAt: 1700001000,
      lastActivityAt: 1700002000,
      remaining: 0,
      seedCount: 5,
      leechCount: 1,
      swarmSeeders: 10,
      swarmLeechers: 2,
      uploadSpeed: 0,
      downloadSpeed: 0,
      availability: 1.0,
      progress: 1.0,
    }
    vi.mocked(parseCachedTorrents).mockReturnValue([slimTorrent] as never)

    setupDbReturns([[{ qbtTag: "aither" }], [makeCachedClientFull({ name: "Client A" })]])

    const result = await fetchTrackerTorrentsCached(1)

    if ("result" in result) {
      expect(result.result.torrents).toHaveLength(1)
      for (const t of result.result.torrents) {
        expect(t).not.toHaveProperty("tracker")
        expect(t).not.toHaveProperty("contentPath")
        expect(t).not.toHaveProperty("savePath")
        expect(t).toHaveProperty("hash", "h1")
      }
    }
  })

  it("should track the oldest cachedTorrentsAt across clients", async () => {
    const olderDate = new Date("2026-01-15T00:00:00Z")
    const newerDate = new Date("2026-04-01T00:00:00Z")

    const torrent = makeTorrent("h1", { tags: "aither" })
    vi.mocked(parseCachedTorrents).mockReturnValue([torrent])

    setupDbReturns([
      [{ qbtTag: "aither" }],
      [
        makeCachedClientFull({ id: 1, name: "Old", cachedTorrentsAt: olderDate }),
        makeCachedClientFull({ id: 2, name: "New", cachedTorrentsAt: newerDate }),
      ],
    ])

    const result = await fetchTrackerTorrentsCached(1)

    if ("result" in result) {
      expect(result.result.cachedAt).toBe(olderDate.toISOString())
    }
  })

  it("should return null cachedAt when no clients have cachedTorrentsAt", async () => {
    const torrent = makeTorrent("h1", { tags: "aither" })
    vi.mocked(parseCachedTorrents).mockReturnValue([torrent])

    setupDbReturns([[{ qbtTag: "aither" }], [makeCachedClientFull({ cachedTorrentsAt: null })]])

    const result = await fetchTrackerTorrentsCached(1)

    if ("result" in result) {
      expect(result.result.cachedAt).toBeNull()
    }
  })

  it("should set clientCount to the total number of enabled clients regardless of data", async () => {
    vi.mocked(parseCachedTorrents).mockReturnValue([]) // no data from any client

    setupDbReturns([
      [{ qbtTag: "aither" }],
      [
        makeCachedClientFull({ id: 1 }),
        makeCachedClientFull({ id: 2 }),
        makeCachedClientFull({ id: 3 }),
      ],
    ])

    const result = await fetchTrackerTorrentsCached(1)

    if ("result" in result) {
      expect(result.result.clientCount).toBe(3)
    }
  })

  it("should always return empty clientErrors array", async () => {
    vi.mocked(parseCachedTorrents).mockReturnValue([])

    setupDbReturns([[{ qbtTag: "aither" }], [makeCachedClientFull()]])

    const result = await fetchTrackerTorrentsCached(1)

    if ("result" in result) {
      expect(result.result.clientErrors).toEqual([])
    }
  })

  it("should include clientName on each returned torrent", async () => {
    const torrent = makeTorrent("h1", { tags: "aither" })
    vi.mocked(parseCachedTorrents).mockReturnValue([torrent])

    setupDbReturns([[{ qbtTag: "aither" }], [makeCachedClientFull({ name: "My qBT" })]])

    const result = await fetchTrackerTorrentsCached(1)

    if ("result" in result) {
      expect(result.result.torrents.length).toBe(1)
      expect(result.result.torrents[0].clientName).toBe("My qBT")
    }
  })
})
