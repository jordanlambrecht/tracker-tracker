// src/lib/download-clients/__tests__/fetch-merged.test.ts
//
// Functions:
//   makeClient  - Build a minimal DownloadClientRow for tests
//   makeTorrent - Build a minimal TorrentRecord for tests

import { beforeEach, describe, expect, it, vi } from "vitest"
import type { TorrentRecord } from "@/lib/download-clients"
import { fetchAndMergeTorrents } from "../fetch"
import type { DownloadClientRow } from "../types"

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("server-only", () => ({}))

const mockAdapter = {
  type: "qbittorrent" as const,
  baseUrl: "http://localhost:8080",
  testConnection: vi.fn(),
  getTorrents: vi.fn().mockResolvedValue([]),
  getTransferInfo: vi.fn().mockResolvedValue({ uploadSpeed: 0, downloadSpeed: 0 }),
  getDeltaSync: vi.fn(),
  dispose: vi.fn(),
}

vi.mock("@/lib/download-clients/factory", () => ({
  createAdapterForClient: vi.fn(() => mockAdapter),
}))

vi.mock("../qbt/transport", () => ({
  buildBaseUrl: vi.fn(() => "http://localhost:8080"),
}))

vi.mock("../transforms", () => ({
  parseCrossSeedTags: vi.fn((raw: string[] | null) => raw ?? []),
}))

vi.mock("../sync-store", () => ({
  STORE_MAX_AGE_MS: 10 * 60 * 1000,
  isStoreFresh: vi.fn(() => false),
  getFilteredTorrents: vi.fn(() => []),
}))

// ---------------------------------------------------------------------------
// Re-import mocked modules for assertions
// ---------------------------------------------------------------------------

import { createAdapterForClient } from "@/lib/download-clients/factory"
import { buildBaseUrl } from "../qbt/transport"
import { getFilteredTorrents, isStoreFresh } from "../sync-store"

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeClient(overrides: Partial<DownloadClientRow> = {}): DownloadClientRow {
  return {
    name: "Home qBT",
    host: "localhost",
    port: 8080,
    useSsl: false,
    encryptedUsername: "enc-admin",
    encryptedPassword: "enc-pass",
    crossSeedTags: null,
    type: "qbittorrent",
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

function makeKey(): Buffer {
  return Buffer.alloc(32, 0xab)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("fetchAndMergeTorrents — early-exit cases", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    // Re-establish defaults after resetAllMocks clears them
    vi.mocked(buildBaseUrl).mockReturnValue("http://localhost:8080")
    vi.mocked(isStoreFresh).mockReturnValue(false)
    vi.mocked(getFilteredTorrents).mockReturnValue([])

    vi.mocked(createAdapterForClient).mockReturnValue(mockAdapter)
    mockAdapter.getTorrents.mockResolvedValue([])
  })

  it("returns empty result when no clients are provided", async () => {
    const result = await fetchAndMergeTorrents([], ["aither"], makeKey())
    expect(result.torrents).toEqual([])
    expect(result.clientErrors).toEqual([])
    expect(result.clientCount).toBe(0)
    expect(createAdapterForClient).not.toHaveBeenCalled()
  })

  it("returns empty result when no tags are provided", async () => {
    const result = await fetchAndMergeTorrents([makeClient()], [], makeKey())
    expect(result.torrents).toEqual([])
    expect(result.clientErrors).toEqual([])
    expect(result.clientCount).toBe(0)
    expect(createAdapterForClient).not.toHaveBeenCalled()
  })
})

describe("fetchAndMergeTorrents — fast path (store is fresh, no filter)", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(buildBaseUrl).mockReturnValue("http://localhost:8080")

    vi.mocked(createAdapterForClient).mockReturnValue(mockAdapter)
    mockAdapter.getTorrents.mockResolvedValue([])
  })

  it("does NOT call createAdapterForClient when store is fresh and no filter is provided", async () => {
    vi.mocked(isStoreFresh).mockReturnValue(true)
    vi.mocked(getFilteredTorrents).mockReturnValue([])

    await fetchAndMergeTorrents([makeClient()], ["aither"], makeKey())

    expect(createAdapterForClient).not.toHaveBeenCalled()
  })

  it("serves torrents from the store when fast path is taken", async () => {
    const storedTorrents = [
      makeTorrent("abc1", { tags: "aither" }),
      makeTorrent("abc2", { tags: "aither" }),
    ]
    vi.mocked(isStoreFresh).mockReturnValue(true)
    vi.mocked(getFilteredTorrents).mockImplementation(
      (_url: string, pred: (t: TorrentRecord) => boolean) => storedTorrents.filter(pred)
    )

    const result = await fetchAndMergeTorrents([makeClient()], ["aither"], makeKey())

    expect(createAdapterForClient).not.toHaveBeenCalled()
    expect(result.torrents).toHaveLength(2)
    const hashes = result.torrents.map((t) => t.hash)
    expect(hashes).toContain("abc1")
    expect(hashes).toContain("abc2")
  })

  it("builds the base URL before checking store freshness", async () => {
    vi.mocked(isStoreFresh).mockReturnValue(true)
    vi.mocked(getFilteredTorrents).mockReturnValue([])

    await fetchAndMergeTorrents([makeClient()], ["aither"], makeKey())

    expect(buildBaseUrl).toHaveBeenCalledWith("localhost", 8080, false)
    expect(isStoreFresh).toHaveBeenCalledWith("http://localhost:8080", expect.any(Number))
  })

  it("reads stored torrents for the correct base URL", async () => {
    vi.mocked(isStoreFresh).mockReturnValue(true)
    vi.mocked(getFilteredTorrents).mockReturnValue([])

    await fetchAndMergeTorrents([makeClient()], ["aither"], makeKey())

    expect(getFilteredTorrents).toHaveBeenCalledWith("http://localhost:8080", expect.any(Function))
  })

  it("stamps each torrent with the originating client name", async () => {
    const stampTorrents = [makeTorrent("h1", { tags: "aither" })]
    vi.mocked(isStoreFresh).mockReturnValue(true)
    vi.mocked(getFilteredTorrents).mockImplementation(
      (_url: string, pred: (t: TorrentRecord) => boolean) => stampTorrents.filter(pred)
    )

    const result = await fetchAndMergeTorrents(
      [makeClient({ name: "My Client" })],
      ["aither"],
      makeKey()
    )

    expect(result.torrents[0].clientName).toBe("My Client")
  })

  it("reports correct clientCount", async () => {
    vi.mocked(isStoreFresh).mockReturnValue(true)
    vi.mocked(getFilteredTorrents).mockReturnValue([])

    const result = await fetchAndMergeTorrents(
      [makeClient(), makeClient({ name: "Second" })],
      ["aither"],
      makeKey()
    )

    expect(result.clientCount).toBe(2)
  })
})

describe("fetchAndMergeTorrents — fast path tag filtering", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(buildBaseUrl).mockReturnValue("http://localhost:8080")
    vi.mocked(isStoreFresh).mockReturnValue(true)

    vi.mocked(createAdapterForClient).mockReturnValue(mockAdapter)
    mockAdapter.getTorrents.mockResolvedValue([])
  })

  it("only returns torrents whose tags match the requested tags", async () => {
    const stored = [
      makeTorrent("match1", { tags: "aither" }),
      makeTorrent("match2", { tags: "blutopia" }),
      makeTorrent("no-match", { tags: "untracked-tag" }),
    ]
    vi.mocked(getFilteredTorrents).mockImplementation(
      (_url: string, pred: (t: TorrentRecord) => boolean) => stored.filter(pred)
    )

    const result = await fetchAndMergeTorrents([makeClient()], ["aither", "blutopia"], makeKey())

    expect(createAdapterForClient).not.toHaveBeenCalled()
    expect(result.torrents).toHaveLength(2)
    const hashes = result.torrents.map((t) => t.hash)
    expect(hashes).toContain("match1")
    expect(hashes).toContain("match2")
    expect(hashes).not.toContain("no-match")
  })

  it("excludes torrents that have no tags", async () => {
    const stored = [makeTorrent("has-tag", { tags: "aither" }), makeTorrent("no-tag", { tags: "" })]
    vi.mocked(getFilteredTorrents).mockImplementation(
      (_url: string, pred: (t: TorrentRecord) => boolean) => stored.filter(pred)
    )

    const result = await fetchAndMergeTorrents([makeClient()], ["aither"], makeKey())

    expect(result.torrents).toHaveLength(1)
    expect(result.torrents[0].hash).toBe("has-tag")
  })

  it("tag matching is case-insensitive", async () => {
    const stored = [makeTorrent("h1", { tags: "Aither" }), makeTorrent("h2", { tags: "BLUTOPIA" })]
    vi.mocked(getFilteredTorrents).mockImplementation(
      (_url: string, pred: (t: TorrentRecord) => boolean) => stored.filter(pred)
    )

    // Tags requested in lowercase — stored tags have mixed case
    const result = await fetchAndMergeTorrents([makeClient()], ["aither", "blutopia"], makeKey())

    expect(createAdapterForClient).not.toHaveBeenCalled()
    expect(result.torrents).toHaveLength(2)
  })

  it("includes torrents that match any one of multiple requested tags", async () => {
    const stored = [
      makeTorrent("only-aither", { tags: "aither" }),
      makeTorrent("only-blu", { tags: "blutopia" }),
      makeTorrent("both", { tags: "aither, blutopia" }),
    ]
    vi.mocked(getFilteredTorrents).mockImplementation(
      (_url: string, pred: (t: TorrentRecord) => boolean) => stored.filter(pred)
    )

    const result = await fetchAndMergeTorrents([makeClient()], ["aither", "blutopia"], makeKey())

    expect(result.torrents).toHaveLength(3)
  })

  it("returns no torrents when none match the tags", async () => {
    const stored = [makeTorrent("h1", { tags: "some-other-tag" })]
    vi.mocked(getFilteredTorrents).mockImplementation(
      (_url: string, pred: (t: TorrentRecord) => boolean) => stored.filter(pred)
    )

    const result = await fetchAndMergeTorrents([makeClient()], ["aither"], makeKey())

    expect(result.torrents).toHaveLength(0)
  })
})

describe("fetchAndMergeTorrents — fast path skipped when filter is present", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(buildBaseUrl).mockReturnValue("http://localhost:8080")
    vi.mocked(isStoreFresh).mockReturnValue(true)
    const filterBeforeEachData = [makeTorrent("h1", { tags: "aither" })]
    vi.mocked(getFilteredTorrents).mockImplementation(
      (_url: string, pred: (t: TorrentRecord) => boolean) => filterBeforeEachData.filter(pred)
    )

    vi.mocked(createAdapterForClient).mockReturnValue(mockAdapter)
    mockAdapter.getTorrents.mockResolvedValue([])
  })

  it("calls createAdapterForClient instead of reading the store when filter is provided", async () => {
    // Store is fresh but filter is present — must fall back to live fetch
    await fetchAndMergeTorrents([makeClient()], ["aither"], makeKey(), "active")

    expect(createAdapterForClient).toHaveBeenCalled()
  })

  it("does NOT read from getFilteredTorrents when filter bypasses the fast path", async () => {
    await fetchAndMergeTorrents([makeClient()], ["aither"], makeKey(), "active")

    // getFilteredTorrents should never be called when filter forces the cold path
    expect(getFilteredTorrents).not.toHaveBeenCalled()
  })

  it("passes the filter to getTorrents on the cold path for single-tag requests", async () => {
    mockAdapter.getTorrents.mockResolvedValue([])

    await fetchAndMergeTorrents([makeClient()], ["aither"], makeKey(), "active")

    expect(mockAdapter.getTorrents).toHaveBeenCalledWith({ tag: "aither", filter: "active" })
  })
})

describe("fetchAndMergeTorrents — fast path skipped when store is stale", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(buildBaseUrl).mockReturnValue("http://localhost:8080")

    vi.mocked(createAdapterForClient).mockReturnValue(mockAdapter)
    mockAdapter.getTorrents.mockResolvedValue([])
  })

  it("calls createAdapterForClient when the store is stale (isStoreFresh returns false)", async () => {
    vi.mocked(isStoreFresh).mockReturnValue(false)

    await fetchAndMergeTorrents([makeClient()], ["aither"], makeKey())

    expect(createAdapterForClient).toHaveBeenCalled()
  })

  it("does NOT call getFilteredTorrents when store is stale", async () => {
    vi.mocked(isStoreFresh).mockReturnValue(false)

    await fetchAndMergeTorrents([makeClient()], ["aither"], makeKey())

    expect(getFilteredTorrents).not.toHaveBeenCalled()
  })

  it("falls back to per-tag live fetch for a single tag", async () => {
    vi.mocked(isStoreFresh).mockReturnValue(false)
    mockAdapter.getTorrents.mockResolvedValue([makeTorrent("live1", { tags: "aither" })])

    const result = await fetchAndMergeTorrents([makeClient()], ["aither"], makeKey())

    expect(mockAdapter.getTorrents).toHaveBeenCalledWith({ tag: "aither" })
    expect(result.torrents).toHaveLength(1)
    expect(result.torrents[0].hash).toBe("live1")
  })

  it("falls back to parallel per-tag live fetch for multiple tags", async () => {
    vi.mocked(isStoreFresh).mockReturnValue(false)
    mockAdapter.getTorrents
      .mockResolvedValueOnce([makeTorrent("a1", { tags: "aither" })])
      .mockResolvedValueOnce([makeTorrent("b1", { tags: "blutopia" })])

    const result = await fetchAndMergeTorrents([makeClient()], ["aither", "blutopia"], makeKey())

    // Two tags → two getTorrents calls (no filter passed)
    expect(mockAdapter.getTorrents).toHaveBeenCalledTimes(2)
    expect(result.torrents).toHaveLength(2)
  })
})

describe("fetchAndMergeTorrents — fast path skipped when store is uninitialized", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(buildBaseUrl).mockReturnValue("http://localhost:8080")

    vi.mocked(createAdapterForClient).mockReturnValue(mockAdapter)
    mockAdapter.getTorrents.mockResolvedValue([])
  })

  it("calls createAdapterForClient when store has never been initialized (isStoreFresh returns false)", async () => {
    // isStoreFresh returns false for both stale AND uninitialized stores
    vi.mocked(isStoreFresh).mockReturnValue(false)

    await fetchAndMergeTorrents([makeClient()], ["aither"], makeKey())

    expect(createAdapterForClient).toHaveBeenCalled()
    expect(getFilteredTorrents).not.toHaveBeenCalled()
  })
})

describe("fetchAndMergeTorrents — error handling", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(buildBaseUrl).mockReturnValue("http://localhost:8080")
    vi.mocked(isStoreFresh).mockReturnValue(false)
    vi.mocked(getFilteredTorrents).mockReturnValue([])

    vi.mocked(createAdapterForClient).mockReturnValue(mockAdapter)
    mockAdapter.getTorrents.mockResolvedValue([])
  })

  it("records a client error and does not throw when getTorrents rejects", async () => {
    mockAdapter.getTorrents.mockRejectedValue(new Error("connect ECONNREFUSED"))

    const result = await fetchAndMergeTorrents([makeClient()], ["aither"], makeKey())

    expect(result.clientErrors).toHaveLength(1)
    expect(result.torrents).toEqual([])
  })

  it("records errors per failing client while succeeding clients still contribute", async () => {
    const goodTorrent = makeTorrent("good", { tags: "aither" })

    // First call (Bad Client) fails, second call (Good Client) succeeds
    mockAdapter.getTorrents
      .mockRejectedValueOnce(new Error("refused"))
      .mockResolvedValueOnce([goodTorrent])

    const failClient = makeClient({ name: "Bad Client" })
    const goodClient = makeClient({ name: "Good Client" })
    const result = await fetchAndMergeTorrents([failClient, goodClient], ["aither"], makeKey())

    expect(result.clientErrors).toHaveLength(1)
    expect(result.clientErrors[0]).toMatch(/Bad Client/)
    expect(result.torrents).toHaveLength(1)
    expect(result.torrents[0].hash).toBe("good")
  })

  it("sets sessionExpired when all clients fail with decryption errors", async () => {
    vi.mocked(createAdapterForClient).mockImplementation(() => {
      throw new Error("decrypt credentials failed for client")
    })

    const result = await fetchAndMergeTorrents([makeClient()], ["aither"], makeKey())

    expect(result.sessionExpired).toBe(true)
    expect(result.torrents).toEqual([])
  })

  it("does not set sessionExpired when only some clients have decryption failures", async () => {
    vi.mocked(createAdapterForClient)
      .mockImplementationOnce(() => {
        throw new Error("decrypt credentials failed for client")
      })
      .mockReturnValueOnce(mockAdapter)

    mockAdapter.getTorrents.mockResolvedValue([])

    const result = await fetchAndMergeTorrents(
      [makeClient({ name: "Failing" }), makeClient({ name: "Working" })],
      ["aither"],
      makeKey()
    )

    expect(result.sessionExpired).toBe(false)
  })
})

describe("fetchAndMergeTorrents — sensitive field stripping", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(buildBaseUrl).mockReturnValue("http://localhost:8080")
    vi.mocked(isStoreFresh).mockReturnValue(true)

    vi.mocked(createAdapterForClient).mockReturnValue(mockAdapter)
    mockAdapter.getTorrents.mockResolvedValue([])
  })

  it("strips tracker, contentPath, and savePath from fast-path results", async () => {
    const stripTorrents = [
      makeTorrent("h1", {
        tags: "aither",
        tracker: "https://aither.cc/announce?passkey=SECRET",
        contentPath: "/data/Secret.mkv",
        savePath: "/data",
      }),
    ]
    vi.mocked(getFilteredTorrents).mockImplementation(
      (_url: string, pred: (t: TorrentRecord) => boolean) => stripTorrents.filter(pred)
    )

    const result = await fetchAndMergeTorrents([makeClient()], ["aither"], makeKey())

    expect(result.torrents).toHaveLength(1)
    expect(result.torrents[0]).not.toHaveProperty("tracker")
    expect(result.torrents[0]).not.toHaveProperty("contentPath")
    expect(result.torrents[0]).not.toHaveProperty("savePath")
    expect(result.torrents[0]).toHaveProperty("hash", "h1")
  })
})
