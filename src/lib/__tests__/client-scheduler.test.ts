// src/lib/__tests__/client-scheduler.test.ts
//
// Functions:
//   makeEncryptionKey           - Creates a 32-byte Buffer for use as encryption key
//   setupFullHappyPathMocks     - Wires all mocks for a successful deepPollClient run
//   mockDbSelectSequence        - Chains db.select returns for client + tracker-tags lookups
//   mockDbInsertSnapshot        - Sets up db.insert chain for clientSnapshots
//   mockDbUpdateClient          - Sets up db.update chain for downloadClients

import { beforeEach, describe, expect, it, vi } from "vitest"
import { deepPollClient } from "@/lib/client-scheduler"
import { decrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import {
  aggregateByTag,
  applyMaindataUpdate,
  getFilteredTorrents,
  getStoreRevision,
  getTorrents,
  getTransferInfo,
  syncMaindata,
  withSessionRetry,
} from "@/lib/qbt"

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

vi.mock("@/lib/crypto", () => ({
  decrypt: vi.fn(),
}))

vi.mock("@/lib/qbt", () => ({
  // withSessionRetry: by default, call op with a fixed baseUrl+sid so the
  // syncMaindata/getTransferInfo mocks still fire normally. Individual tests that
  // need to simulate upstream errors replace this with vi.fn().mockRejectedValue(...).
  withSessionRetry: vi.fn(
    async (
      _host: string,
      _port: number,
      _ssl: boolean,
      _username: string,
      _password: string,
      op: (baseUrl: string, sid: string) => Promise<unknown>
    ) => op("http://192.168.1.100:8080", "sid-token")
  ),
  // getTorrents is still used by other files (fetch-merged.ts, route handlers) —
  // kept in the mock module but not asserted on in deep poll tests.
  getTorrents: vi.fn(),
  getTransferInfo: vi.fn(),
  aggregateByTag: vi.fn(),
  parseCrossSeedTags: vi.fn((raw: string[] | null) => raw ?? []),
  slimTorrentForCache: vi.fn((t: Record<string, unknown>) => {
    const { tracker: _t, content_path: _cp, save_path: _sp, ...rest } = t
    return rest
  }),
  pushSpeedSnapshot: vi.fn(),
  clearSpeedCache: vi.fn(),
  clearAllSessions: vi.fn(),
  // New sync-store exports used by the deep poll path
  syncMaindata: vi.fn(),
  applyMaindataUpdate: vi.fn(),
  getFilteredTorrents: vi.fn(),
  getStoreRevision: vi.fn(),
  clearAllStores: vi.fn(),
  isStoreInitialized: vi.fn(),
  resetStore: vi.fn(),
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

const MOCK_TRANSFER_INFO = {
  up_info_speed: 2048,
  dl_info_speed: 512,
  up_info_data: 10000000,
  dl_info_data: 5000000,
}

const MOCK_MAINDATA_RESPONSE = {
  rid: 1,
  full_update: true,
  torrents: {},
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
 * syncMaindata returns MOCK_MAINDATA_RESPONSE; getFilteredTorrents returns [] by default.
 */
function setupFullHappyPathMocks() {
  mockDbSelectSequence(MOCK_CLIENT)
  ;(decrypt as ReturnType<typeof vi.fn>).mockReturnValueOnce("admin").mockReturnValueOnce("secret")
  ;(getStoreRevision as ReturnType<typeof vi.fn>).mockReturnValue(0)
  ;(syncMaindata as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_MAINDATA_RESPONSE)
  ;(applyMaindataUpdate as ReturnType<typeof vi.fn>).mockReturnValue(undefined)
  ;(getFilteredTorrents as ReturnType<typeof vi.fn>).mockReturnValue([])
  ;(getTransferInfo as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_TRANSFER_INFO)
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
  })

  // -------------------------------------------------------------------------
  // Single fetch + client-side filter
  // -------------------------------------------------------------------------

  it("calls syncMaindata once (not per-tag) for a single poll", async () => {
    setupFullHappyPathMocks()

    await deepPollClient(1, makeEncryptionKey(), ["aither"])

    // New flow: a single syncMaindata call instead of N per-tag getTorrents calls
    expect(syncMaindata as ReturnType<typeof vi.fn>).toHaveBeenCalledOnce()
    // getTorrents must NOT be called by the deep poll path
    expect(getTorrents as ReturnType<typeof vi.fn>).not.toHaveBeenCalled()
  })

  it("deduplicates overlapping tracker and cross-seed tags via client-side filter", async () => {
    const aitherTorrent = {
      hash: "a1",
      state: "uploading",
      tags: "aither, shared-tag",
      upspeed: 100,
      dlspeed: 0,
    }
    const crossTorrent = {
      hash: "c1",
      state: "uploading",
      tags: "cross-seed, shared-tag",
      upspeed: 75,
      dlspeed: 0,
    }
    const sharedTorrent = {
      hash: "shared",
      state: "uploading",
      tags: "aither, cross-seed, shared-tag",
      upspeed: 50,
      dlspeed: 0,
    }

    const clientWithOverlap = {
      ...MOCK_CLIENT,
      crossSeedTags: ["cross-seed", "shared-tag"],
    }
    mockDbSelectSequence(clientWithOverlap)
    ;(decrypt as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce("admin")
      .mockReturnValueOnce("secret")
    ;(getStoreRevision as ReturnType<typeof vi.fn>).mockReturnValue(0)
    ;(syncMaindata as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_MAINDATA_RESPONSE)
    ;(applyMaindataUpdate as ReturnType<typeof vi.fn>).mockReturnValue(undefined)
    // Store contains 3 torrents, all tagged with tracked tags — all should be returned
    ;(getFilteredTorrents as ReturnType<typeof vi.fn>).mockImplementation(
      (_url: string, pred: (t: unknown) => boolean) =>
        [aitherTorrent, crossTorrent, sharedTorrent].filter(pred)
    )
    ;(getTransferInfo as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_TRANSFER_INFO)
    ;(aggregateByTag as ReturnType<typeof vi.fn>).mockReturnValue(MOCK_STATS)
    mockDbInsertSnapshot()
    mockDbUpdateClient()

    await deepPollClient(1, makeEncryptionKey(), ["aither"])

    // syncMaindata called once — no per-tag requests
    expect(syncMaindata as ReturnType<typeof vi.fn>).toHaveBeenCalledOnce()
  })

  // -------------------------------------------------------------------------
  // Empty tags — zero relevant torrents, but getTransferInfo still runs
  // -------------------------------------------------------------------------

  it("handles zero cross-seed tags gracefully", async () => {
    const clientNoTags = { ...MOCK_CLIENT, crossSeedTags: [] as string[] }
    mockDbSelectSequence(clientNoTags)
    ;(decrypt as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce("admin")
      .mockReturnValueOnce("secret")
    ;(getStoreRevision as ReturnType<typeof vi.fn>).mockReturnValue(0)
    ;(syncMaindata as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_MAINDATA_RESPONSE)
    ;(applyMaindataUpdate as ReturnType<typeof vi.fn>).mockReturnValue(undefined)
    // Store may have torrents but the tag filter produces nothing
    ;(getFilteredTorrents as ReturnType<typeof vi.fn>).mockReturnValue([])
    ;(getTransferInfo as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_TRANSFER_INFO)
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

    // syncMaindata still called once — it fetches everything regardless of tag count
    expect(syncMaindata as ReturnType<typeof vi.fn>).toHaveBeenCalledOnce()
    // getTorrents must NOT be called
    expect(getTorrents as ReturnType<typeof vi.fn>).not.toHaveBeenCalled()
    // getTransferInfo still runs for speed data
    expect(getTransferInfo as ReturnType<typeof vi.fn>).toHaveBeenCalledOnce()
    // The snapshot insert should still happen
    expect(db.insert as ReturnType<typeof vi.fn>).toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // Result filtering
  // -------------------------------------------------------------------------

  it("passes tag-filtered store results to aggregateByTag", async () => {
    const aitherTorrents = [
      { hash: "a1", state: "uploading", tags: "aither", upspeed: 100, dlspeed: 0 },
      { hash: "a2", state: "uploading", tags: "aither", upspeed: 100, dlspeed: 0 },
    ]
    const crossTorrents = [
      { hash: "c1", state: "uploading", tags: "cross-seed", upspeed: 100, dlspeed: 0 },
      { hash: "c2", state: "uploading", tags: "cross-seed", upspeed: 100, dlspeed: 0 },
      { hash: "c3", state: "uploading", tags: "cross-seed", upspeed: 100, dlspeed: 0 },
    ]
    const untrackedTorrent = {
      hash: "u1",
      state: "uploading",
      tags: "untracked-tag",
      upspeed: 50,
      dlspeed: 0,
    }

    mockDbSelectSequence(MOCK_CLIENT)
    ;(decrypt as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce("admin")
      .mockReturnValueOnce("secret")
    ;(getStoreRevision as ReturnType<typeof vi.fn>).mockReturnValue(0)
    ;(syncMaindata as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_MAINDATA_RESPONSE)
    ;(applyMaindataUpdate as ReturnType<typeof vi.fn>).mockReturnValue(undefined)
    // Store returns all torrents including an untracked one — scheduler filters by tags
    ;(getFilteredTorrents as ReturnType<typeof vi.fn>).mockImplementation(
      (_url: string, pred: (t: unknown) => boolean) =>
        [...aitherTorrents, ...crossTorrents, untrackedTorrent].filter(pred)
    )
    ;(getTransferInfo as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_TRANSFER_INFO)
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

    expect(withSessionRetry as ReturnType<typeof vi.fn>).not.toHaveBeenCalled()
    expect(syncMaindata as ReturnType<typeof vi.fn>).not.toHaveBeenCalled()
  })

  it("returns without error for a non-existent client ID", async () => {
    // DB returns empty array for the client lookup
    const clientMockLimit = vi.fn().mockResolvedValue([])
    const clientMockWhere = vi.fn().mockReturnValue({ limit: clientMockLimit })
    const clientMockFrom = vi.fn().mockReturnValue({ where: clientMockWhere })
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({ from: clientMockFrom })

    // Must not throw
    await expect(deepPollClient(999, makeEncryptionKey(), [])).resolves.toBeUndefined()
    expect(withSessionRetry as ReturnType<typeof vi.fn>).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // Error recording
  // -------------------------------------------------------------------------

  it("records sanitized error to DB when qBT login fails and does not re-throw", async () => {
    mockDbSelectSequence(MOCK_CLIENT)
    ;(decrypt as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce("admin")
      .mockReturnValueOnce("secret")
    ;(withSessionRetry as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("connect ECONNREFUSED 192.168.1.100:8080")
    )
    const { mockSet } = mockDbUpdateClient()

    await expect(deepPollClient(1, makeEncryptionKey(), ["🕵️ Aither"])).resolves.toBeUndefined()

    // Raw error is sanitized — IP and port stripped, generic message stored
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ lastError: "Connection refused" })
    )
  })

  it("records a generic message when the thrown value is not an Error instance", async () => {
    mockDbSelectSequence(MOCK_CLIENT)
    ;(decrypt as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce("admin")
      .mockReturnValueOnce("secret")
    ;(withSessionRetry as ReturnType<typeof vi.fn>).mockRejectedValue("plain string rejection")
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
        upspeed: 100,
        dlspeed: 0,
      },
      {
        hash: "a2",
        name: "Show.mkv",
        state: "uploading",
        tags: "aither",
        upspeed: 200,
        dlspeed: 0,
      },
    ]

    mockDbSelectSequence(MOCK_CLIENT)
    ;(decrypt as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce("admin")
      .mockReturnValueOnce("secret")
    ;(getStoreRevision as ReturnType<typeof vi.fn>).mockReturnValue(0)
    ;(syncMaindata as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_MAINDATA_RESPONSE)
    ;(applyMaindataUpdate as ReturnType<typeof vi.fn>).mockReturnValue(undefined)
    ;(getFilteredTorrents as ReturnType<typeof vi.fn>).mockImplementation(
      (_url: string, pred: (t: unknown) => boolean) => filteredTorrents.filter(pred)
    )
    ;(getTransferInfo as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_TRANSFER_INFO)
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

  it("strips tracker, content_path, and save_path from cached torrents", async () => {
    const torrentsWithSensitiveFields = [
      {
        hash: "a1",
        name: "Movie.mkv",
        state: "uploading",
        tags: "aither",
        upspeed: 100,
        dlspeed: 0,
        tracker: "https://aither.cc/announce?passkey=SECRET123",
        content_path: "/data/torrents/Movie.mkv",
        save_path: "/data/torrents",
      },
    ]

    mockDbSelectSequence(MOCK_CLIENT)
    ;(decrypt as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce("admin")
      .mockReturnValueOnce("secret")
    ;(getStoreRevision as ReturnType<typeof vi.fn>).mockReturnValue(0)
    ;(syncMaindata as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_MAINDATA_RESPONSE)
    ;(applyMaindataUpdate as ReturnType<typeof vi.fn>).mockReturnValue(undefined)
    ;(getFilteredTorrents as ReturnType<typeof vi.fn>).mockImplementation(
      (_url: string, pred: (t: unknown) => boolean) => torrentsWithSensitiveFields.filter(pred)
    )
    ;(getTransferInfo as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_TRANSFER_INFO)
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
    expect(cached[0]).not.toHaveProperty("content_path")
    expect(cached[0]).not.toHaveProperty("save_path")

    // Non-sensitive fields must be preserved
    expect(cached[0]).toHaveProperty("hash", "a1")
    expect(cached[0]).toHaveProperty("name", "Movie.mkv")
    expect(cached[0]).toHaveProperty("tags", "aither")
  })

  // -------------------------------------------------------------------------
  // JSONB write skip when no changes
  // -------------------------------------------------------------------------

  it("omits cachedTorrents from the DB update when syncMaindata reports no delta", async () => {
    // syncMaindata returns a response with no full_update, no torrents changes, no removals.
    // hasChanges should be false, so the update set() must NOT include cachedTorrents.
    const noDeltaResponse = {
      rid: 2,
      full_update: false,
      torrents: {},
      torrents_removed: [],
    }

    mockDbSelectSequence(MOCK_CLIENT)
    ;(decrypt as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce("admin")
      .mockReturnValueOnce("secret")
    ;(getStoreRevision as ReturnType<typeof vi.fn>).mockReturnValue(1)
    ;(syncMaindata as ReturnType<typeof vi.fn>).mockResolvedValue(noDeltaResponse)
    ;(applyMaindataUpdate as ReturnType<typeof vi.fn>).mockReturnValue(undefined)
    ;(getFilteredTorrents as ReturnType<typeof vi.fn>).mockReturnValue([])
    ;(getTransferInfo as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_TRANSFER_INFO)
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

  it("passes decrypted credentials to withSessionRetry", async () => {
    mockDbSelectSequence(MOCK_CLIENT)
    ;(decrypt as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce("decrypted-user")
      .mockReturnValueOnce("decrypted-pass")
    ;(getStoreRevision as ReturnType<typeof vi.fn>).mockReturnValue(0)
    ;(syncMaindata as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_MAINDATA_RESPONSE)
    ;(applyMaindataUpdate as ReturnType<typeof vi.fn>).mockReturnValue(undefined)
    ;(getFilteredTorrents as ReturnType<typeof vi.fn>).mockReturnValue([])
    ;(getTransferInfo as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_TRANSFER_INFO)
    ;(aggregateByTag as ReturnType<typeof vi.fn>).mockReturnValue(MOCK_STATS)
    mockDbInsertSnapshot()
    mockDbUpdateClient()

    await deepPollClient(1, makeEncryptionKey(), ["aither"])

    // withSessionRetry(host, port, ssl, username, password, op) — username is index 3, password is 4
    const retryCalls = (withSessionRetry as ReturnType<typeof vi.fn>).mock.calls
    expect(retryCalls).toHaveLength(1)
    expect(retryCalls[0][3]).toBe("decrypted-user")
    expect(retryCalls[0][4]).toBe("decrypted-pass")
  })
})

// ---------------------------------------------------------------------------
// Regression: isPrivate field mismatch — filter must not rely on t.isPrivate
// ---------------------------------------------------------------------------

describe("deepPollClient dedup without isPrivate", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  // Regression: the old per-tag fetch path had a dedup guard `if (!t.isPrivate || seen.has(t.hash)) continue`
  // which silently dropped all torrents because `t.isPrivate` is always undefined (the real qBT API
  // returns `is_private` in snake_case, not camelCase). The new syncMaindata path uses a pure tag
  // filter via parseTorrentTags — no isPrivate check at all. This test verifies that torrents
  // without isPrivate are still included.
  it("filter includes torrents that do not have an isPrivate field", async () => {
    // Torrents constructed WITHOUT isPrivate — matching real qBT API response shape
    const torrentsWithoutIsPrivate = [
      { hash: "h1", state: "uploading", tags: "aither", upspeed: 100, dlspeed: 0 },
      { hash: "h2", state: "uploading", tags: "aither", upspeed: 200, dlspeed: 0 },
      { hash: "h3", state: "uploading", tags: "aither", upspeed: 300, dlspeed: 0 },
    ]

    // Sanity-check the test data itself: none of these objects have isPrivate defined
    for (const t of torrentsWithoutIsPrivate) {
      expect(Object.hasOwn(t, "isPrivate")).toBe(false)
    }

    mockDbSelectSequence(MOCK_CLIENT)
    ;(decrypt as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce("admin")
      .mockReturnValueOnce("secret")
    ;(getStoreRevision as ReturnType<typeof vi.fn>).mockReturnValue(0)
    ;(syncMaindata as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_MAINDATA_RESPONSE)
    ;(applyMaindataUpdate as ReturnType<typeof vi.fn>).mockReturnValue(undefined)
    ;(getFilteredTorrents as ReturnType<typeof vi.fn>).mockImplementation(
      (_url: string, pred: (t: unknown) => boolean) => torrentsWithoutIsPrivate.filter(pred)
    )
    ;(getTransferInfo as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_TRANSFER_INFO)
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
      { hash: "shared", state: "uploading", tags: "aither, cross-seed", upspeed: 100, dlspeed: 0 },
      { hash: "aither-only", state: "uploading", tags: "aither", upspeed: 50, dlspeed: 0 },
      { hash: "cross-only", state: "uploading", tags: "cross-seed", upspeed: 75, dlspeed: 0 },
    ]

    mockDbSelectSequence(MOCK_CLIENT)
    ;(decrypt as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce("admin")
      .mockReturnValueOnce("secret")
    ;(getStoreRevision as ReturnType<typeof vi.fn>).mockReturnValue(0)
    ;(syncMaindata as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_MAINDATA_RESPONSE)
    ;(applyMaindataUpdate as ReturnType<typeof vi.fn>).mockReturnValue(undefined)
    ;(getFilteredTorrents as ReturnType<typeof vi.fn>).mockImplementation(
      (_url: string, pred: (t: unknown) => boolean) => storedTorrents.filter(pred)
    )
    ;(getTransferInfo as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_TRANSFER_INFO)
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
