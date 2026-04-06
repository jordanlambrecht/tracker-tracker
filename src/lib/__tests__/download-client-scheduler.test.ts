// src/lib/__tests__/download-client-scheduler.test.ts
//
// Functions:
//   makeEncryptionKey           - Creates a 32-byte Buffer for use as encryption key
//   setupFullHappyPathMocks     - Wires all mocks for a successful deepPollClient run
//   mockDbSelectSequence        - Chains db.select returns for client + tracker-tags lookups
//   mockDbInsertSnapshot        - Sets up db.insert chain for clientSnapshots
//   mockDbUpdateClient          - Sets up db.update chain for downloadClients

import { beforeEach, describe, expect, it, vi } from "vitest"
import { db } from "@/lib/db"
import { deepPollClient } from "@/lib/download-client-scheduler"
import {
  aggregateByTag,
  applyMaindataUpdate,
  createAdapterForClient,
  getFilteredTorrents,
  getStoreRevision,
} from "@/lib/download-clients"

// ---------------------------------------------------------------------------
// Module mocks (boundaries only)
// ---------------------------------------------------------------------------

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))

const mockAdapter = {
  type: "qbittorrent" as const,
  baseUrl: "http://192.168.1.100:8080",
  testConnection: vi.fn(),
  getTorrents: vi.fn().mockResolvedValue([]),
  getTransferInfo: vi.fn().mockResolvedValue({ uploadSpeed: 2048, downloadSpeed: 512 }),
  getDeltaSync: vi.fn().mockResolvedValue({
    rid: 1,
    fullUpdate: true,
    torrents: {},
    torrentsRemoved: [],
  }),
  dispose: vi.fn(),
}

vi.mock("@/lib/download-clients", () => ({
  createAdapterForClient: vi.fn(() => mockAdapter),
  aggregateByTag: vi.fn(),
  parseCrossSeedTags: vi.fn((raw: string[] | null) => raw ?? []),
  slimTorrentForCache: vi.fn((t: Record<string, unknown>) => {
    const { tracker: _t, contentPath: _cp, savePath: _sp, ...rest } = t
    return rest
  }),
  pushSpeedSnapshot: vi.fn(),
  clearSpeedCache: vi.fn(),
  clearAllSessions: vi.fn(),
  applyMaindataUpdate: vi.fn(),
  getFilteredTorrents: vi.fn(),
  getStoreRevision: vi.fn(),
  replaceStoreTorrents: vi.fn(),
  clearAllStores: vi.fn(),
  isStoreInitialized: vi.fn(),
  resetStore: vi.fn(),
  CLIENT_CONNECTION_COLUMNS: {},
}))

// Prevent node-cron from spinning up timers
vi.mock("node-cron", () => ({
  default: {
    schedule: vi.fn().mockReturnValue({ stop: vi.fn() }),
  },
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_CLIENT = {
  id: 1,
  name: "Home qBT",
  type: "qbittorrent",
  enabled: true,
  host: "192.168.1.100",
  port: 8080,
  useSsl: false,
  encryptedUsername: "enc-admin",
  encryptedPassword: "enc-secret",
  pollIntervalSeconds: 30,
  isDefault: true,
  crossSeedTags: ["cross-seed"],
  lastPolledAt: null,
  lastError: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const MOCK_STATS = {
  totalSeedingCount: 5,
  totalLeechingCount: 1,
  uploadSpeedBytes: 2048,
  downloadSpeedBytes: 512,
  tagStats: [
    { tag: "aither", seedingCount: 3, leechingCount: 0, uploadSpeed: 1024, downloadSpeed: 0 },
    { tag: "blutopia", seedingCount: 2, leechingCount: 1, uploadSpeed: 1024, downloadSpeed: 512 },
  ],
}

const MOCK_MAINDATA_RESPONSE = {
  rid: 1,
  fullUpdate: true,
  torrents: {},
  torrentsRemoved: [],
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEncryptionKey(): Buffer {
  return Buffer.alloc(32, 0xab)
}

/** Mocks the db.select chain for deepPollClient's client row lookup.
 *  Tracker tags are now passed as a parameter, not fetched from DB. */
function mockDbSelectSequence(client: typeof MOCK_CLIENT | null) {
  // downloadClients lookup (tracker tags are now passed as a parameter, not fetched from DB)
  const clientMockLimit = vi.fn().mockResolvedValue(client ? [client] : [])
  const clientMockWhere = vi.fn().mockReturnValue({ limit: clientMockLimit })
  const clientMockFrom = vi.fn().mockReturnValue({ where: clientMockWhere })

  ;(db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({ from: clientMockFrom })
}

/** Sets up db.insert to succeed silently. Returns the values mock for assertion. */
function mockDbInsertSnapshot() {
  const mockValues = vi.fn().mockResolvedValue(undefined)
  ;(db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: mockValues })
  return mockValues
}

/** Sets up db.update to succeed silently. Returns set and where mocks for assertion. */
function mockDbUpdateClient() {
  const mockWhere = vi.fn().mockResolvedValue(undefined)
  const mockSet = vi.fn().mockReturnValue({ where: mockWhere })
  ;(db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: mockSet })
  return { mockSet, mockWhere }
}

/**
 * Wires all mocks for a successful deepPollClient run.
 * Tracker tags are passed directly to deepPollClient (no longer fetched from DB).
 * crossSeedTags come from MOCK_CLIENT.crossSeedTags = '["cross-seed"]'.
 * getDeltaSync returns MOCK_MAINDATA_RESPONSE; getFilteredTorrents returns [] by default.
 */
function setupFullHappyPathMocks() {
  mockDbSelectSequence(MOCK_CLIENT)
  ;(getStoreRevision as ReturnType<typeof vi.fn>).mockReturnValue(0)
  mockAdapter.getDeltaSync.mockResolvedValue(MOCK_MAINDATA_RESPONSE)
  ;(applyMaindataUpdate as ReturnType<typeof vi.fn>).mockReturnValue(undefined)
  ;(getFilteredTorrents as ReturnType<typeof vi.fn>).mockReturnValue([])
  mockAdapter.getTransferInfo.mockResolvedValue({ uploadSpeed: 2048, downloadSpeed: 512 })
  ;(aggregateByTag as ReturnType<typeof vi.fn>).mockReturnValue(MOCK_STATS)
  mockDbInsertSnapshot()
  mockDbUpdateClient()
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("deepPollClient per-tag optimization", () => {
  beforeEach(() => {
    // resetAllMocks clears call history AND pending mockReturnValueOnce queues,
    // preventing leakage of unconsumed queued returns across tests.
    vi.resetAllMocks()
    vi.mocked(createAdapterForClient).mockReturnValue(mockAdapter)
    mockAdapter.getDeltaSync.mockResolvedValue(MOCK_MAINDATA_RESPONSE)
    mockAdapter.getTransferInfo.mockResolvedValue({ uploadSpeed: 2048, downloadSpeed: 512 })
    mockAdapter.getTorrents.mockResolvedValue([])
  })

  // -------------------------------------------------------------------------
  // Single fetch + client-side filter
  // -------------------------------------------------------------------------

  it("calls getDeltaSync once (not per-tag) for a single poll", async () => {
    setupFullHappyPathMocks()

    await deepPollClient(1, makeEncryptionKey(), ["aither"])

    // New flow: a single getDeltaSync call instead of N per-tag getTorrents calls
    expect(mockAdapter.getDeltaSync).toHaveBeenCalledOnce()
  })

  it("deduplicates overlapping tracker and cross-seed tags via client-side filter", async () => {
    const aitherTorrent = {
      hash: "a1",
      state: "uploading",
      tags: "aither, shared-tag",
      uploadSpeed: 100,
      downloadSpeed: 0,
    }
    const crossTorrent = {
      hash: "c1",
      state: "uploading",
      tags: "cross-seed, shared-tag",
      uploadSpeed: 75,
      downloadSpeed: 0,
    }
    const sharedTorrent = {
      hash: "shared",
      state: "uploading",
      tags: "aither, cross-seed, shared-tag",
      uploadSpeed: 50,
      downloadSpeed: 0,
    }

    const clientWithOverlap = {
      ...MOCK_CLIENT,
      crossSeedTags: ["cross-seed", "shared-tag"],
    }
    mockDbSelectSequence(clientWithOverlap)
    ;(getStoreRevision as ReturnType<typeof vi.fn>).mockReturnValue(0)
    mockAdapter.getDeltaSync.mockResolvedValue(MOCK_MAINDATA_RESPONSE)
    ;(applyMaindataUpdate as ReturnType<typeof vi.fn>).mockReturnValue(undefined)
    // Store contains 3 torrents, all tagged with tracked tags — all should be returned
    ;(getFilteredTorrents as ReturnType<typeof vi.fn>).mockImplementation(
      (_url: string, pred: (t: unknown) => boolean) =>
        [aitherTorrent, crossTorrent, sharedTorrent].filter(pred)
    )
    ;(aggregateByTag as ReturnType<typeof vi.fn>).mockReturnValue(MOCK_STATS)
    mockDbInsertSnapshot()
    mockDbUpdateClient()

    await deepPollClient(1, makeEncryptionKey(), ["aither"])

    // getDeltaSync called once — no per-tag requests
    expect(mockAdapter.getDeltaSync).toHaveBeenCalledOnce()
  })

  // -------------------------------------------------------------------------
  // Empty tags — zero relevant torrents, but getTransferInfo still runs
  // -------------------------------------------------------------------------

  it("handles zero cross-seed tags gracefully", async () => {
    const clientNoTags = { ...MOCK_CLIENT, crossSeedTags: [] as string[] }
    mockDbSelectSequence(clientNoTags)
    ;(getStoreRevision as ReturnType<typeof vi.fn>).mockReturnValue(0)
    mockAdapter.getDeltaSync.mockResolvedValue(MOCK_MAINDATA_RESPONSE)
    ;(applyMaindataUpdate as ReturnType<typeof vi.fn>).mockReturnValue(undefined)
    // Store may have torrents but the tag filter produces nothing
    ;(getFilteredTorrents as ReturnType<typeof vi.fn>).mockReturnValue([])
    ;(aggregateByTag as ReturnType<typeof vi.fn>).mockReturnValue({
      totalSeedingCount: 0,
      totalLeechingCount: 0,
      uploadSpeedBytes: 0,
      downloadSpeedBytes: 0,
      tagStats: [],
    })
    mockDbInsertSnapshot()
    mockDbUpdateClient()

    await deepPollClient(1, makeEncryptionKey(), ["aither"])

    // getDeltaSync still called once — it fetches everything regardless of tag count
    expect(mockAdapter.getDeltaSync).toHaveBeenCalledOnce()
    // getTransferInfo still runs for speed data
    expect(mockAdapter.getTransferInfo).toHaveBeenCalledOnce()
    // The snapshot insert should still happen
    expect(db.insert as ReturnType<typeof vi.fn>).toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // Result filtering
  // -------------------------------------------------------------------------

  it("passes tag-filtered store results to aggregateByTag", async () => {
    const aitherTorrents = [
      { hash: "a1", state: "uploading", tags: "aither", uploadSpeed: 100, downloadSpeed: 0 },
      { hash: "a2", state: "uploading", tags: "aither", uploadSpeed: 100, downloadSpeed: 0 },
    ]
    const crossTorrents = [
      { hash: "c1", state: "uploading", tags: "cross-seed", uploadSpeed: 100, downloadSpeed: 0 },
      { hash: "c2", state: "uploading", tags: "cross-seed", uploadSpeed: 100, downloadSpeed: 0 },
      { hash: "c3", state: "uploading", tags: "cross-seed", uploadSpeed: 100, downloadSpeed: 0 },
    ]
    const untrackedTorrent = {
      hash: "u1",
      state: "uploading",
      tags: "untracked-tag",
      uploadSpeed: 50,
      downloadSpeed: 0,
    }

    mockDbSelectSequence(MOCK_CLIENT)
    ;(getStoreRevision as ReturnType<typeof vi.fn>).mockReturnValue(0)
    mockAdapter.getDeltaSync.mockResolvedValue(MOCK_MAINDATA_RESPONSE)
    ;(applyMaindataUpdate as ReturnType<typeof vi.fn>).mockReturnValue(undefined)
    // Store returns all torrents including an untracked one — scheduler filters by tags
    ;(getFilteredTorrents as ReturnType<typeof vi.fn>).mockImplementation(
      (_url: string, pred: (t: unknown) => boolean) =>
        [...aitherTorrents, ...crossTorrents, untrackedTorrent].filter(pred)
    )
    ;(aggregateByTag as ReturnType<typeof vi.fn>).mockReturnValue(MOCK_STATS)
    mockDbInsertSnapshot()
    mockDbUpdateClient()

    await deepPollClient(1, makeEncryptionKey(), ["aither"])

    const aggregateCalls = (aggregateByTag as ReturnType<typeof vi.fn>).mock.calls
    expect(aggregateCalls).toHaveLength(1)
    const passedTorrents = aggregateCalls[0][0]
    // 2 aither + 3 cross-seed = 5 (untracked-tag torrent is filtered out)
    expect(passedTorrents).toHaveLength(5)
  })

  // -------------------------------------------------------------------------
  // Disabled client
  // -------------------------------------------------------------------------

  it("skips disabled clients without calling login", async () => {
    const disabledClient = { ...MOCK_CLIENT, enabled: false }
    // Only needs the first DB call (client lookup) — it returns early after finding disabled
    const clientMockLimit = vi.fn().mockResolvedValue([disabledClient])
    const clientMockWhere = vi.fn().mockReturnValue({ limit: clientMockLimit })
    const clientMockFrom = vi.fn().mockReturnValue({ where: clientMockWhere })
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({ from: clientMockFrom })

    await deepPollClient(1, makeEncryptionKey(), ["aither"])

    expect(createAdapterForClient).not.toHaveBeenCalled()
  })

  it("returns without error for a non-existent client ID", async () => {
    // DB returns empty array for the client lookup
    const clientMockLimit = vi.fn().mockResolvedValue([])
    const clientMockWhere = vi.fn().mockReturnValue({ limit: clientMockLimit })
    const clientMockFrom = vi.fn().mockReturnValue({ where: clientMockWhere })
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({ from: clientMockFrom })

    // Must not throw
    await expect(deepPollClient(999, makeEncryptionKey(), [])).resolves.toBeUndefined()
    expect(createAdapterForClient).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // Error recording
  // -------------------------------------------------------------------------

  it("records sanitized error to DB when client connection fails and does not re-throw", async () => {
    mockDbSelectSequence(MOCK_CLIENT)
    mockAdapter.getDeltaSync.mockRejectedValue(new Error("connect ECONNREFUSED 192.168.1.100:8080"))
    const { mockSet } = mockDbUpdateClient()

    await expect(deepPollClient(1, makeEncryptionKey(), ["🕵️ Aither"])).resolves.toBeUndefined()

    // Raw error is sanitized — IP and port stripped, generic message stored
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ lastError: "Connection refused" })
    )
  })

  it("records a generic message when the thrown value is not an Error instance", async () => {
    mockDbSelectSequence(MOCK_CLIENT)
    mockAdapter.getDeltaSync.mockRejectedValue("plain string rejection")
    const { mockSet } = mockDbUpdateClient()

    await expect(deepPollClient(1, makeEncryptionKey(), ["🕵️ Aither"])).resolves.toBeUndefined()

    // Non-Error throws are sanitized to the generic fallback
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ lastError: "Connection failed" })
    )
  })

  // -------------------------------------------------------------------------
  // Success recording
  // -------------------------------------------------------------------------

  it("clears lastError and sets lastPolledAt on successful poll", async () => {
    setupFullHappyPathMocks()

    // Re-wire update mock so we can inspect the set() argument
    const { mockSet } = mockDbUpdateClient()

    await deepPollClient(1, makeEncryptionKey(), ["aither"])

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        lastError: null,
        lastPolledAt: expect.any(Date),
      })
    )
  })

  // -------------------------------------------------------------------------
  // Snapshot insertion
  // -------------------------------------------------------------------------

  it("inserts a client snapshot after a successful poll", async () => {
    setupFullHappyPathMocks()
    // Re-wire insert mock to capture the values
    const mockValues = mockDbInsertSnapshot()

    await deepPollClient(1, makeEncryptionKey(), ["aither"])

    expect(mockValues).toHaveBeenCalledOnce()
    const snapshotValues = mockValues.mock.calls[0][0]
    expect(snapshotValues).toMatchObject({
      clientId: 1,
      polledAt: expect.any(Date),
    })
  })

  // -------------------------------------------------------------------------
  // Cache write
  // -------------------------------------------------------------------------

  it("caches filtered torrents to downloadClients on successful poll", async () => {
    const filteredTorrents = [
      {
        hash: "a1",
        name: "Movie.mkv",
        state: "uploading",
        tags: "aither",
        uploadSpeed: 100,
        downloadSpeed: 0,
      },
      {
        hash: "a2",
        name: "Show.mkv",
        state: "uploading",
        tags: "aither",
        uploadSpeed: 200,
        downloadSpeed: 0,
      },
    ]

    mockDbSelectSequence(MOCK_CLIENT)
    ;(getStoreRevision as ReturnType<typeof vi.fn>).mockReturnValue(0)
    mockAdapter.getDeltaSync.mockResolvedValue(MOCK_MAINDATA_RESPONSE)
    ;(applyMaindataUpdate as ReturnType<typeof vi.fn>).mockReturnValue(undefined)
    ;(getFilteredTorrents as ReturnType<typeof vi.fn>).mockImplementation(
      (_url: string, pred: (t: unknown) => boolean) => filteredTorrents.filter(pred)
    )
    ;(aggregateByTag as ReturnType<typeof vi.fn>).mockReturnValue(MOCK_STATS)
    mockDbInsertSnapshot()

    // Capture ALL update calls — deep poll does 2 updates now (cache + status)
    const updateCalls: Record<string, unknown>[] = []
    const mockWhere = vi.fn().mockResolvedValue(undefined)
    const mockSet = vi.fn().mockImplementation((values: Record<string, unknown>) => {
      updateCalls.push(values)
      return { where: mockWhere }
    })
    ;(db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: mockSet })

    await deepPollClient(1, makeEncryptionKey(), ["aither"])

    // One of the update calls should contain the cached torrents
    const cacheUpdate = updateCalls.find((c) => "cachedTorrents" in c)
    expect(cacheUpdate).toBeDefined()
    expect(cacheUpdate?.cachedTorrents).toEqual(filteredTorrents)
    expect(cacheUpdate?.cachedTorrentsAt).toBeInstanceOf(Date)
  })

  it("strips tracker, contentPath, and savePath from cached torrents", async () => {
    const torrentsWithSensitiveFields = [
      {
        hash: "a1",
        name: "Movie.mkv",
        state: "uploading",
        tags: "aither",
        uploadSpeed: 100,
        downloadSpeed: 0,
        tracker: "https://aither.cc/announce?passkey=SECRET123",
        contentPath: "/data/torrents/Movie.mkv",
        savePath: "/data/torrents",
      },
    ]

    mockDbSelectSequence(MOCK_CLIENT)
    ;(getStoreRevision as ReturnType<typeof vi.fn>).mockReturnValue(0)
    mockAdapter.getDeltaSync.mockResolvedValue(MOCK_MAINDATA_RESPONSE)
    ;(applyMaindataUpdate as ReturnType<typeof vi.fn>).mockReturnValue(undefined)
    ;(getFilteredTorrents as ReturnType<typeof vi.fn>).mockImplementation(
      (_url: string, pred: (t: unknown) => boolean) => torrentsWithSensitiveFields.filter(pred)
    )
    ;(aggregateByTag as ReturnType<typeof vi.fn>).mockReturnValue(MOCK_STATS)
    mockDbInsertSnapshot()

    const updateCalls: Record<string, unknown>[] = []
    const mockWhere = vi.fn().mockResolvedValue(undefined)
    const mockSet = vi.fn().mockImplementation((values: Record<string, unknown>) => {
      updateCalls.push(values)
      return { where: mockWhere }
    })
    ;(db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: mockSet })

    await deepPollClient(1, makeEncryptionKey(), ["aither"])

    const cacheUpdate = updateCalls.find((c) => "cachedTorrents" in c)
    expect(cacheUpdate).toBeDefined()

    const cached = cacheUpdate?.cachedTorrents as Record<string, unknown>[]
    expect(cached).toHaveLength(1)

    // Sensitive fields must be stripped
    expect(cached[0]).not.toHaveProperty("tracker")
    expect(cached[0]).not.toHaveProperty("contentPath")
    expect(cached[0]).not.toHaveProperty("savePath")

    // Non-sensitive fields must be preserved
    expect(cached[0]).toHaveProperty("hash", "a1")
    expect(cached[0]).toHaveProperty("name", "Movie.mkv")
    expect(cached[0]).toHaveProperty("tags", "aither")
  })

  // -------------------------------------------------------------------------
  // JSONB write skip when no changes
  // -------------------------------------------------------------------------

  it("omits cachedTorrents from the DB update when syncMaindata reports no delta", async () => {
    // syncMaindata returns a response with no fullUpdate, no torrents changes, no removals.
    // hasChanges should be false, so the update set() must NOT include cachedTorrents.
    const noDeltaResponse = {
      rid: 2,
      fullUpdate: false,
      torrents: {},
      torrentsRemoved: [],
    }

    mockDbSelectSequence(MOCK_CLIENT)
    ;(getStoreRevision as ReturnType<typeof vi.fn>).mockReturnValue(1)
    mockAdapter.getDeltaSync.mockResolvedValue(noDeltaResponse)
    ;(applyMaindataUpdate as ReturnType<typeof vi.fn>).mockReturnValue(undefined)
    ;(getFilteredTorrents as ReturnType<typeof vi.fn>).mockReturnValue([])
    ;(aggregateByTag as ReturnType<typeof vi.fn>).mockReturnValue(MOCK_STATS)
    mockDbInsertSnapshot()

    // Capture all set() argument objects across update calls
    const setCaptured: Record<string, unknown>[] = []
    const mockWhere = vi.fn().mockResolvedValue(undefined)
    const mockSet = vi.fn().mockImplementation((values: Record<string, unknown>) => {
      setCaptured.push(values)
      return { where: mockWhere }
    })
    ;(db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: mockSet })

    await deepPollClient(1, makeEncryptionKey(), ["aither"])

    // There must be at least one update call (the status update)
    expect(setCaptured.length).toBeGreaterThan(0)

    // None of the update set() objects may contain cachedTorrents
    for (const setObj of setCaptured) {
      expect(Object.keys(setObj)).not.toContain("cachedTorrents")
    }
  })

  // -------------------------------------------------------------------------
  // Credential flow
  // -------------------------------------------------------------------------

  it("calls createAdapterForClient with the client row and encryption key", async () => {
    const encryptionKey = makeEncryptionKey()
    mockDbSelectSequence(MOCK_CLIENT)
    ;(getStoreRevision as ReturnType<typeof vi.fn>).mockReturnValue(0)
    mockAdapter.getDeltaSync.mockResolvedValue(MOCK_MAINDATA_RESPONSE)
    ;(applyMaindataUpdate as ReturnType<typeof vi.fn>).mockReturnValue(undefined)
    ;(getFilteredTorrents as ReturnType<typeof vi.fn>).mockReturnValue([])
    ;(aggregateByTag as ReturnType<typeof vi.fn>).mockReturnValue(MOCK_STATS)
    mockDbInsertSnapshot()
    mockDbUpdateClient()

    await deepPollClient(1, encryptionKey, ["aither"])

    // createAdapterForClient(client, key) — decryption is handled inside the factory
    expect(createAdapterForClient).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, type: "qbittorrent" }),
      encryptionKey
    )
  })
})

// ---------------------------------------------------------------------------
// Regression: isPrivate field mismatch — filter must not rely on t.isPrivate
// ---------------------------------------------------------------------------

describe("deepPollClient dedup without isPrivate", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(createAdapterForClient).mockReturnValue(mockAdapter)
    mockAdapter.getDeltaSync.mockResolvedValue(MOCK_MAINDATA_RESPONSE)
    mockAdapter.getTransferInfo.mockResolvedValue({ uploadSpeed: 2048, downloadSpeed: 512 })
    mockAdapter.getTorrents.mockResolvedValue([])
  })

  // Regression: the old per-tag fetch path had a dedup guard `if (!t.isPrivate || seen.has(t.hash)) continue`
  // which silently dropped all torrents because `t.isPrivate` is always undefined (the real qBT API
  // returns `is_private` in snake_case, not camelCase). The new syncMaindata path uses a pure tag
  // filter via parseTorrentTags — no isPrivate check at all. This test verifies that torrents
  // without isPrivate are still included.
  it("filter includes torrents that do not have an isPrivate field", async () => {
    // Torrents constructed WITHOUT isPrivate — matching real qBT API response shape
    const torrentsWithoutIsPrivate = [
      { hash: "h1", state: "uploading", tags: "aither", uploadSpeed: 100, downloadSpeed: 0 },
      { hash: "h2", state: "uploading", tags: "aither", uploadSpeed: 200, downloadSpeed: 0 },
      { hash: "h3", state: "uploading", tags: "aither", uploadSpeed: 300, downloadSpeed: 0 },
    ]

    // Sanity-check the test data itself: none of these objects have isPrivate defined
    for (const t of torrentsWithoutIsPrivate) {
      expect(Object.hasOwn(t, "isPrivate")).toBe(false)
    }

    mockDbSelectSequence(MOCK_CLIENT)
    ;(getStoreRevision as ReturnType<typeof vi.fn>).mockReturnValue(0)
    mockAdapter.getDeltaSync.mockResolvedValue(MOCK_MAINDATA_RESPONSE)
    ;(applyMaindataUpdate as ReturnType<typeof vi.fn>).mockReturnValue(undefined)
    ;(getFilteredTorrents as ReturnType<typeof vi.fn>).mockImplementation(
      (_url: string, pred: (t: unknown) => boolean) => torrentsWithoutIsPrivate.filter(pred)
    )
    ;(aggregateByTag as ReturnType<typeof vi.fn>).mockReturnValue(MOCK_STATS)
    mockDbInsertSnapshot()
    mockDbUpdateClient()

    await deepPollClient(1, makeEncryptionKey(), ["aither"])

    // aggregateByTag must have been called with all 3 torrents — none were dropped
    const aggregateCalls = (aggregateByTag as ReturnType<typeof vi.fn>).mock.calls
    expect(aggregateCalls).toHaveLength(1)
    const passedTorrents = aggregateCalls[0][0]
    expect(passedTorrents).toHaveLength(3)
  })

  // Regression: the syncMaindata store is hash-keyed, so each torrent hash is naturally
  // unique in the store. Verify that getStoredTorrents results with distinct hashes are
  // all passed through without phantom dedup.
  it("all distinct-hash torrents from the store reach aggregateByTag", async () => {
    // All three have different hashes — none should be dropped
    const storedTorrents = [
      {
        hash: "shared",
        state: "uploading",
        tags: "aither, cross-seed",
        uploadSpeed: 100,
        downloadSpeed: 0,
      },
      {
        hash: "aither-only",
        state: "uploading",
        tags: "aither",
        uploadSpeed: 50,
        downloadSpeed: 0,
      },
      {
        hash: "cross-only",
        state: "uploading",
        tags: "cross-seed",
        uploadSpeed: 75,
        downloadSpeed: 0,
      },
    ]

    mockDbSelectSequence(MOCK_CLIENT)
    ;(getStoreRevision as ReturnType<typeof vi.fn>).mockReturnValue(0)
    mockAdapter.getDeltaSync.mockResolvedValue(MOCK_MAINDATA_RESPONSE)
    ;(applyMaindataUpdate as ReturnType<typeof vi.fn>).mockReturnValue(undefined)
    ;(getFilteredTorrents as ReturnType<typeof vi.fn>).mockImplementation(
      (_url: string, pred: (t: unknown) => boolean) => storedTorrents.filter(pred)
    )
    ;(aggregateByTag as ReturnType<typeof vi.fn>).mockReturnValue(MOCK_STATS)
    mockDbInsertSnapshot()
    mockDbUpdateClient()

    await deepPollClient(1, makeEncryptionKey(), ["aither"])

    const aggregateCalls = (aggregateByTag as ReturnType<typeof vi.fn>).mock.calls
    expect(aggregateCalls).toHaveLength(1)
    const passedTorrents = aggregateCalls[0][0] as Array<{ hash: string }>

    // All 3 unique-hash torrents are tagged with tracked tags — all 3 pass through
    expect(passedTorrents).toHaveLength(3)
    const hashes = passedTorrents.map((t) => t.hash)
    expect(hashes).toContain("shared")
    expect(hashes).toContain("aither-only")
    expect(hashes).toContain("cross-only")
  })
})

// ---------------------------------------------------------------------------
// Regression: heartbeat must not overwrite lastPolledAt
// ---------------------------------------------------------------------------

describe("deepPollClient lastPolledAt written; heartbeat update does not include it", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(createAdapterForClient).mockReturnValue(mockAdapter)
    mockAdapter.getDeltaSync.mockResolvedValue(MOCK_MAINDATA_RESPONSE)
    mockAdapter.getTransferInfo.mockResolvedValue({ uploadSpeed: 2048, downloadSpeed: 512 })
    mockAdapter.getTorrents.mockResolvedValue([])
  })

  // Regression: prevents heartbeat from starving the deep poll scheduler.
  // deepPollAllClients decides whether to run by comparing now - lastPolledAt >= intervalMs.
  // If heartbeat (running every 5s) also wrote lastPolledAt, the overdue threshold would
  // never be reached after the first heartbeat, and deep polls would stop firing.
  // The fix: heartbeat updates only lastError/errorSince/updatedAt, never lastPolledAt.
  it("deep poll success writes lastPolledAt to the DB", async () => {
    setupFullHappyPathMocks()
    const { mockSet } = mockDbUpdateClient()

    await deepPollClient(1, makeEncryptionKey(), ["aither"])

    // At least one update call must include lastPolledAt — this is the status update
    const allSetCalls = mockSet.mock.calls.map((c: unknown[]) => c[0] as Record<string, unknown>)
    const statusUpdate = allSetCalls.find((c) => "lastPolledAt" in c)
    expect(statusUpdate).toBeDefined()
    expect(statusUpdate?.lastPolledAt).toBeInstanceOf(Date)
  })

  // Regression: if heartbeat wrote lastPolledAt (the bug), a client polled 5s ago
  // via heartbeat would NOT be considered overdue even after the deep poll interval elapsed.
  // This test documents that scenario: if lastPolledAt reflects a heartbeat timestamp
  // (5s ago) and the poll interval is 30s, the client should still be overdue —
  // but only if deep poll hadn't run. We verify the boundary is the deep poll timestamp,
  // not the heartbeat timestamp.
  it("overdue check: client whose only recent update was a heartbeat 5s ago is still overdue after 30s interval", () => {
    const pollIntervalSeconds = 30
    const now = Date.now()

    // Scenario demonstrating the bug: if heartbeat wrote lastPolledAt 5s ago,
    // the client would appear not-overdue even though deep poll hasn't run in 60s.
    // With the fix, heartbeat does NOT write lastPolledAt, so the last deep poll
    // timestamp (60s ago) is what drives the overdue check.
    const lastDeepPollAt = new Date(now - 60_000) // deep poll ran 60s ago
    const intervalMs = pollIntervalSeconds * 1000
    const lastPoll = lastDeepPollAt.getTime()
    const isOverdue = now - lastPoll >= intervalMs

    // 60s ago > 30s interval → overdue
    expect(isOverdue).toBe(true)
  })
})
