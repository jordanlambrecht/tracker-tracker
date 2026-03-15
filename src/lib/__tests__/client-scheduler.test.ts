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
import { aggregateByTag, getTorrents, getTransferInfo, withSessionRetry } from "@/lib/qbt"

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
  // getTorrents/getTransferInfo mocks still fire normally. Individual tests that
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
  getTorrents: vi.fn(),
  getTransferInfo: vi.fn(),
  aggregateByTag: vi.fn(),
  filterAndDedup: vi.fn(),
  parseCrossSeedTags: vi.fn((raw: string) => { try { return JSON.parse(raw) as string[] } catch { return [] } }),
  stripSensitiveTorrentFields: vi.fn((t: Record<string, unknown>) => { const { tracker: _t, content_path: _cp, save_path: _sp, ...rest } = t; return rest }),
  pushSpeedSnapshot: vi.fn(),
  clearSpeedCache: vi.fn(),
  clearAllSessions: vi.fn(),
}))

// Prevent node-cron from spinning up real timers
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
  crossSeedTags: '["cross-seed"]',
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEncryptionKey(): Buffer {
  return Buffer.alloc(32, 0xab)
}

/**
 * Builds the db.select chain for pollClient's two sequential queries:
 *   1. db.select().from(downloadClients).where(...).limit(1) → client row
 *   2. db.select({ qbtTag }).from(trackers).where(isNotNull(...)) → tag rows
 *
 * Uses mockReturnValueOnce so each call in sequence gets the right data.
 */
function mockDbSelectSequence(
  client: typeof MOCK_CLIENT | null,
  trackerTags: string[]
) {
  // First call: downloadClients lookup
  const clientMockLimit = vi.fn().mockResolvedValue(client ? [client] : [])
  const clientMockWhere = vi.fn().mockReturnValue({ limit: clientMockLimit })
  const clientMockFrom = vi.fn().mockReturnValue({ where: clientMockWhere })

  // Second call: trackers qbtTag lookup
  const tagRows = trackerTags.map((t) => ({ qbtTag: t }))
  const tagMockWhere = vi.fn().mockResolvedValue(tagRows)
  const tagMockFrom = vi.fn().mockReturnValue({ where: tagMockWhere })

  ;(db.select as ReturnType<typeof vi.fn>)
    .mockReturnValueOnce({ from: clientMockFrom })
    .mockReturnValueOnce({ from: tagMockFrom })
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
 * Wires all mocks for a successful deepPollClient run with the given tracker tags.
 * crossSeedTags come from MOCK_CLIENT.crossSeedTags = '["cross-seed"]'.
 * getTorrents returns an empty array per-tag by default (sufficient for happy-path assertions).
 */
function setupFullHappyPathMocks(trackerTags: string[]) {
  mockDbSelectSequence(MOCK_CLIENT, trackerTags)
  ;(decrypt as ReturnType<typeof vi.fn>)
    .mockReturnValueOnce("admin")
    .mockReturnValueOnce("secret")
  // getTorrents is called once per tag (parallel per-tag fetching)
  ;(getTorrents as ReturnType<typeof vi.fn>).mockResolvedValue([])
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

  it("calls getTorrents once per tag in parallel", async () => {
    setupFullHappyPathMocks(["aither", "blutopia"])

    await deepPollClient(1, makeEncryptionKey())

    const getTorrentsCalls = (getTorrents as ReturnType<typeof vi.fn>).mock.calls
    // 2 tracker tags + 1 cross-seed tag = 3 calls
    expect(getTorrentsCalls).toHaveLength(3)
    // Each call passes a tag argument
    const tags = getTorrentsCalls.map((c: unknown[]) => c[2])
    expect(tags).toContain("aither")
    expect(tags).toContain("blutopia")
    expect(tags).toContain("cross-seed")
  })

  it("deduplicates overlapping tracker and cross-seed tags", async () => {
    // ["aither","shared-tag"] ∪ ["cross-seed","shared-tag"] = 3 unique tags = 3 getTorrents calls
    const clientWithOverlap = {
      ...MOCK_CLIENT,
      crossSeedTags: '["cross-seed", "shared-tag"]',
    }
    mockDbSelectSequence(clientWithOverlap, ["aither", "shared-tag"])
    ;(decrypt as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce("admin")
      .mockReturnValueOnce("secret")
    ;(getTorrents as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(getTransferInfo as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_TRANSFER_INFO)
    ;(aggregateByTag as ReturnType<typeof vi.fn>).mockReturnValue(MOCK_STATS)
    mockDbInsertSnapshot()
    mockDbUpdateClient()

    await deepPollClient(1, makeEncryptionKey())

    // 3 unique tags = 3 parallel getTorrents calls
    const getTorrentsCalls = (getTorrents as ReturnType<typeof vi.fn>).mock.calls
    expect(getTorrentsCalls).toHaveLength(3)
    const tags = getTorrentsCalls.map((c: unknown[]) => c[2])
    expect(new Set(tags).size).toBe(3)
  })

  // -------------------------------------------------------------------------
  // Empty tags — zero getTorrents calls, but getTransferInfo still runs
  // -------------------------------------------------------------------------

  it("handles zero configured tags gracefully", async () => {
    const clientNoTags = { ...MOCK_CLIENT, crossSeedTags: "[]" }
    mockDbSelectSequence(clientNoTags, [])
    ;(decrypt as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce("admin")
      .mockReturnValueOnce("secret")
    ;(getTorrents as ReturnType<typeof vi.fn>).mockResolvedValue([])
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

    await deepPollClient(1, makeEncryptionKey())

    // Zero tags = zero getTorrents calls
    expect(getTorrents as ReturnType<typeof vi.fn>).not.toHaveBeenCalled()
    // getTransferInfo still runs for speed data
    expect(getTransferInfo as ReturnType<typeof vi.fn>).toHaveBeenCalledOnce()
    // The snapshot insert should still happen
    expect(db.insert as ReturnType<typeof vi.fn>).toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // Result filtering
  // -------------------------------------------------------------------------

  it("passes deduped per-tag results to aggregateByTag", async () => {
    const aitherTorrents = [
      { hash: "a1", state: "uploading", tags: "aither", upspeed: 100, dlspeed: 0, isPrivate: true },
      { hash: "a2", state: "uploading", tags: "aither", upspeed: 100, dlspeed: 0, isPrivate: true },
    ]
    const crossTorrents = [
      { hash: "c1", state: "uploading", tags: "cross-seed", upspeed: 100, dlspeed: 0, isPrivate: true },
      { hash: "c2", state: "uploading", tags: "cross-seed", upspeed: 100, dlspeed: 0, isPrivate: true },
      { hash: "c3", state: "uploading", tags: "cross-seed", upspeed: 100, dlspeed: 0, isPrivate: true },
    ]

    mockDbSelectSequence(MOCK_CLIENT, ["aither"])
    ;(decrypt as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce("admin")
      .mockReturnValueOnce("secret")
    // Per-tag: first call returns aither torrents, second returns cross-seed torrents
    ;(getTorrents as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(aitherTorrents)
      .mockResolvedValueOnce(crossTorrents)
    ;(getTransferInfo as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_TRANSFER_INFO)
    ;(aggregateByTag as ReturnType<typeof vi.fn>).mockReturnValue(MOCK_STATS)
    mockDbInsertSnapshot()
    mockDbUpdateClient()

    await deepPollClient(1, makeEncryptionKey())

    const aggregateCalls = (aggregateByTag as ReturnType<typeof vi.fn>).mock.calls
    expect(aggregateCalls).toHaveLength(1)
    const passedTorrents = aggregateCalls[0][0]
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

    await deepPollClient(1, makeEncryptionKey())

    expect(withSessionRetry as ReturnType<typeof vi.fn>).not.toHaveBeenCalled()
    expect(getTorrents as ReturnType<typeof vi.fn>).not.toHaveBeenCalled()
  })

  it("returns without error for a non-existent client ID", async () => {
    // DB returns empty array for the client lookup
    const clientMockLimit = vi.fn().mockResolvedValue([])
    const clientMockWhere = vi.fn().mockReturnValue({ limit: clientMockLimit })
    const clientMockFrom = vi.fn().mockReturnValue({ where: clientMockWhere })
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({ from: clientMockFrom })

    // Must not throw
    await expect(deepPollClient(999, makeEncryptionKey())).resolves.toBeUndefined()
    expect(withSessionRetry as ReturnType<typeof vi.fn>).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // Error recording
  // -------------------------------------------------------------------------

  it("records sanitized error to DB when qBT login fails and does not re-throw", async () => {
    mockDbSelectSequence(MOCK_CLIENT, ["aither"])
    ;(decrypt as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce("admin")
      .mockReturnValueOnce("secret")
    ;(withSessionRetry as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("connect ECONNREFUSED 192.168.1.100:8080")
    )
    const { mockSet } = mockDbUpdateClient()

    await expect(deepPollClient(1, makeEncryptionKey())).resolves.toBeUndefined()

    // Raw error is sanitized — IP and port stripped, generic message stored
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ lastError: "Connection refused" })
    )
  })

  it("records a generic message when the thrown value is not an Error instance", async () => {
    mockDbSelectSequence(MOCK_CLIENT, ["aither"])
    ;(decrypt as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce("admin")
      .mockReturnValueOnce("secret")
    ;(withSessionRetry as ReturnType<typeof vi.fn>).mockRejectedValue("plain string rejection")
    const { mockSet } = mockDbUpdateClient()

    await expect(deepPollClient(1, makeEncryptionKey())).resolves.toBeUndefined()

    // Non-Error throws are sanitized to the generic fallback
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ lastError: "Connection failed" })
    )
  })

  // -------------------------------------------------------------------------
  // Success recording
  // -------------------------------------------------------------------------

  it("clears lastError and sets lastPolledAt on successful poll", async () => {
    setupFullHappyPathMocks(["aither"])

    // Re-wire update mock so we can inspect the set() argument
    const { mockSet } = mockDbUpdateClient()

    await deepPollClient(1, makeEncryptionKey())

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
    setupFullHappyPathMocks(["aither"])
    // Re-wire insert mock to capture the values
    const mockValues = mockDbInsertSnapshot()

    await deepPollClient(1, makeEncryptionKey())

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
      { hash: "a1", name: "Movie.mkv", state: "uploading", tags: "aither", upspeed: 100, dlspeed: 0, isPrivate: true },
      { hash: "a2", name: "Show.mkv", state: "uploading", tags: "aither", upspeed: 200, dlspeed: 0, isPrivate: true },
    ]

    mockDbSelectSequence(MOCK_CLIENT, ["aither"])
    ;(decrypt as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce("admin")
      .mockReturnValueOnce("secret")
    ;(getTorrents as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(getTransferInfo as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_TRANSFER_INFO)
    ;(getTorrents as ReturnType<typeof vi.fn>).mockResolvedValue(filteredTorrents)
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

    await deepPollClient(1, makeEncryptionKey())

    // One of the update calls should contain the cached torrents
    const cacheUpdate = updateCalls.find((c) => "cachedTorrents" in c)
    expect(cacheUpdate).toBeDefined()
    expect(cacheUpdate?.cachedTorrents).toBe(JSON.stringify(filteredTorrents))
    expect(cacheUpdate?.cachedTorrentsAt).toBeInstanceOf(Date)
  })

  it("strips tracker, content_path, and save_path from cached torrents", async () => {
    const torrentsWithSensitiveFields = [
      {
        hash: "a1", name: "Movie.mkv", state: "uploading", tags: "aither",
        upspeed: 100, dlspeed: 0, isPrivate: true,
        tracker: "https://aither.cc/announce?passkey=SECRET123",
        content_path: "/data/torrents/Movie.mkv",
        save_path: "/data/torrents",
      },
    ]

    mockDbSelectSequence(MOCK_CLIENT, ["aither"])
    ;(decrypt as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce("admin")
      .mockReturnValueOnce("secret")
    ;(getTorrents as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(getTransferInfo as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_TRANSFER_INFO)
    ;(getTorrents as ReturnType<typeof vi.fn>).mockResolvedValue(torrentsWithSensitiveFields)
    ;(aggregateByTag as ReturnType<typeof vi.fn>).mockReturnValue(MOCK_STATS)
    mockDbInsertSnapshot()

    const updateCalls: Record<string, unknown>[] = []
    const mockWhere = vi.fn().mockResolvedValue(undefined)
    const mockSet = vi.fn().mockImplementation((values: Record<string, unknown>) => {
      updateCalls.push(values)
      return { where: mockWhere }
    })
    ;(db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: mockSet })

    await deepPollClient(1, makeEncryptionKey())

    const cacheUpdate = updateCalls.find((c) => "cachedTorrents" in c)
    expect(cacheUpdate).toBeDefined()

    const cached = JSON.parse(cacheUpdate?.cachedTorrents as string) as Record<string, unknown>[]
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
  // Credential flow
  // -------------------------------------------------------------------------

  it("passes decrypted credentials to withSessionRetry", async () => {
    mockDbSelectSequence(MOCK_CLIENT, ["aither"])
    ;(decrypt as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce("decrypted-user")
      .mockReturnValueOnce("decrypted-pass")
    ;(getTorrents as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(getTransferInfo as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_TRANSFER_INFO)
    ;(getTorrents as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(aggregateByTag as ReturnType<typeof vi.fn>).mockReturnValue(MOCK_STATS)
    mockDbInsertSnapshot()
    mockDbUpdateClient()

    await deepPollClient(1, makeEncryptionKey())

    // withSessionRetry(host, port, ssl, username, password, op) — username is index 3, password is 4
    const retryCalls = (withSessionRetry as ReturnType<typeof vi.fn>).mock.calls
    expect(retryCalls).toHaveLength(1)
    expect(retryCalls[0][3]).toBe("decrypted-user")
    expect(retryCalls[0][4]).toBe("decrypted-pass")
  })
})
