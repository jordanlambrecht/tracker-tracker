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
import { aggregateByTag, filterAndDedup, getTorrents, getTransferInfo, withSessionRetry } from "@/lib/qbt"

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
 * filterAndDedup returns an empty array by default (sufficient for happy-path assertions).
 */
function setupFullHappyPathMocks(trackerTags: string[]) {
  mockDbSelectSequence(MOCK_CLIENT, trackerTags)
  ;(decrypt as ReturnType<typeof vi.fn>)
    .mockReturnValueOnce("admin")
    .mockReturnValueOnce("secret")
  ;(getTorrents as ReturnType<typeof vi.fn>).mockResolvedValue([])
  ;(getTransferInfo as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_TRANSFER_INFO)
  ;(filterAndDedup as ReturnType<typeof vi.fn>).mockReturnValue([])
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

  it("calls getTorrents exactly once with no tag argument", async () => {
    setupFullHappyPathMocks(["aither", "blutopia"])

    await deepPollClient(1, makeEncryptionKey())

    const getTorrentsCalls = (getTorrents as ReturnType<typeof vi.fn>).mock.calls
    expect(getTorrentsCalls).toHaveLength(1)
    // No tag argument — second arg is sid, third must be absent or undefined
    expect(getTorrentsCalls[0][2]).toBeUndefined()
  })

  it("deduplicates overlapping tracker and cross-seed tags", async () => {
    // allTags deduplication is validated by verifying filterAndDedup receives
    // the correct knownTags array. ["aither","shared-tag"] ∪ ["cross-seed","shared-tag"] = 3 unique
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
    ;(filterAndDedup as ReturnType<typeof vi.fn>).mockReturnValue([])
    ;(aggregateByTag as ReturnType<typeof vi.fn>).mockReturnValue(MOCK_STATS)
    mockDbInsertSnapshot()
    mockDbUpdateClient()

    await deepPollClient(1, makeEncryptionKey())

    // Still only one getTorrents call
    expect((getTorrents as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1)

    // filterAndDedup should receive 3 unique tags
    const filterCalls = (filterAndDedup as ReturnType<typeof vi.fn>).mock.calls
    expect(filterCalls).toHaveLength(1)
    const passedTags: string[] = filterCalls[0][1]
    expect(new Set(passedTags).size).toBe(passedTags.length) // no duplicates
    expect(passedTags).toHaveLength(3)
  })

  // -------------------------------------------------------------------------
  // Empty tags — still calls getTorrents once, but filterAndDedup returns []
  // -------------------------------------------------------------------------

  it("handles zero configured tags gracefully", async () => {
    const clientNoTags = { ...MOCK_CLIENT, crossSeedTags: "[]" }
    mockDbSelectSequence(clientNoTags, [])
    ;(decrypt as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce("admin")
      .mockReturnValueOnce("secret")
    ;(getTorrents as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(getTransferInfo as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_TRANSFER_INFO)
    ;(filterAndDedup as ReturnType<typeof vi.fn>).mockReturnValue([])
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

    // getTorrents is still called once (single fetch regardless of tag count)
    expect(getTorrents as ReturnType<typeof vi.fn>).toHaveBeenCalledOnce()
    // getTransferInfo runs in parallel and should still be called
    expect(getTransferInfo as ReturnType<typeof vi.fn>).toHaveBeenCalledOnce()
    // The snapshot insert should still happen
    expect(db.insert as ReturnType<typeof vi.fn>).toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // Result filtering
  // -------------------------------------------------------------------------

  it("passes filterAndDedup result to aggregateByTag", async () => {
    const aitherTorrents = [
      { hash: "a1", state: "uploading", tags: "aither", upspeed: 100, dlspeed: 0 },
      { hash: "a2", state: "uploading", tags: "aither", upspeed: 100, dlspeed: 0 },
    ]
    const crossTorrents = [
      { hash: "c1", state: "uploading", tags: "cross-seed", upspeed: 100, dlspeed: 0 },
      { hash: "c2", state: "uploading", tags: "cross-seed", upspeed: 100, dlspeed: 0 },
      { hash: "c3", state: "uploading", tags: "cross-seed", upspeed: 100, dlspeed: 0 },
    ]
    const allRaw = [...aitherTorrents, ...crossTorrents]

    mockDbSelectSequence(MOCK_CLIENT, ["aither"])
    ;(decrypt as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce("admin")
      .mockReturnValueOnce("secret")
    ;(getTorrents as ReturnType<typeof vi.fn>).mockResolvedValue(allRaw)
    ;(getTransferInfo as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_TRANSFER_INFO)
    // filterAndDedup returns the combined 5 torrents
    ;(filterAndDedup as ReturnType<typeof vi.fn>).mockReturnValue(allRaw)
    ;(aggregateByTag as ReturnType<typeof vi.fn>).mockReturnValue(MOCK_STATS)
    mockDbInsertSnapshot()
    mockDbUpdateClient()

    await deepPollClient(1, makeEncryptionKey())

    // aggregateByTag must receive the filterAndDedup output
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

  it("records error to DB when qBT login fails and does not re-throw", async () => {
    mockDbSelectSequence(MOCK_CLIENT, ["aither"])
    ;(decrypt as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce("admin")
      .mockReturnValueOnce("secret")
    ;(withSessionRetry as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Connection refused")
    )
    const { mockSet } = mockDbUpdateClient()

    // Must not throw — errors are caught and recorded
    await expect(deepPollClient(1, makeEncryptionKey())).resolves.toBeUndefined()

    // The error message must be written to lastError
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

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ lastError: "Unknown error" })
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
  // Credential flow
  // -------------------------------------------------------------------------

  it("passes decrypted credentials to withSessionRetry", async () => {
    mockDbSelectSequence(MOCK_CLIENT, ["aither"])
    ;(decrypt as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce("decrypted-user")
      .mockReturnValueOnce("decrypted-pass")
    ;(getTorrents as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(getTransferInfo as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_TRANSFER_INFO)
    ;(filterAndDedup as ReturnType<typeof vi.fn>).mockReturnValue([])
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
