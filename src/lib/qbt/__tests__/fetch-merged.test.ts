// src/lib/qbt/__tests__/fetch-merged.test.ts
//
// Functions:
//   makeClient  - Build a minimal ClientRow for tests
//   makeTorrent - Build a minimal QbtTorrent for tests

import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ClientRow } from "../fetch-merged"
import { fetchAndMergeTorrents } from "../fetch-merged"
import type { QbtTorrent } from "../types"

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("server-only", () => ({}))

vi.mock("@/lib/qbt", () => ({
  buildBaseUrl: vi.fn(() => "http://localhost:8080"),
  getTorrents: vi.fn(),
  withSessionRetry: vi.fn(
    async (
      _h: string,
      _p: number,
      _s: boolean,
      _u: string,
      _pw: string,
      op: (baseUrl: string, sid: string) => Promise<unknown>
    ) => op("http://localhost:8080", "test-sid")
  ),
  parseCrossSeedTags: vi.fn((raw: string[] | null) => raw ?? []),
  stripSensitiveTorrentFields: vi.fn((t: Record<string, unknown>) => {
    const { tracker: _t, content_path: _cp, save_path: _sp, ...rest } = t
    return rest
  }),
  // sync-store re-exports — controlled per-test
  isStoreFresh: vi.fn(() => false),
  getStoredTorrents: vi.fn(() => []),
}))

vi.mock("@/lib/qbt/merge", () => ({
  mergeTorrentLists: vi.fn(),
  aggregateCrossSeedTags: vi.fn(() => []),
}))

vi.mock("@/lib/client-decrypt", () => ({
  decryptClientCredentials: vi.fn(() => ({ username: "admin", password: "pass" })),
}))

// ---------------------------------------------------------------------------
// Re-import mocked modules for assertions
// ---------------------------------------------------------------------------

import { decryptClientCredentials } from "@/lib/client-decrypt"
import {
  buildBaseUrl,
  getStoredTorrents,
  getTorrents,
  isStoreFresh,
  withSessionRetry,
} from "@/lib/qbt"
import { mergeTorrentLists, type RawTorrent } from "@/lib/qbt/merge"

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeClient(overrides: Partial<ClientRow> = {}): ClientRow {
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

function makeTorrent(hash: string, overrides: Partial<QbtTorrent> = {}): QbtTorrent {
  return {
    hash,
    name: `Torrent ${hash}`,
    state: "stalledUP",
    tags: "aither",
    category: "movies",
    upspeed: 0,
    dlspeed: 0,
    uploaded: 1000,
    downloaded: 500,
    ratio: 2.0,
    size: 1_000_000,
    num_seeds: 5,
    num_leechs: 1,
    num_complete: 10,
    num_incomplete: 2,
    tracker: "https://tracker.example.com/announce",
    added_on: 1700000000,
    completion_on: 1700001000,
    last_activity: 1700002000,
    seeding_time: 86400,
    time_active: 86400,
    seen_complete: 1700001500,
    availability: 1.0,
    amount_left: 0,
    progress: 1.0,
    content_path: "/data/movies/torrent",
    save_path: "/data/movies",
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
    vi.mocked(getStoredTorrents).mockReturnValue([])
    vi.mocked(mergeTorrentLists).mockImplementation((lists: RawTorrent[][]) => lists.flat())
    vi.mocked(decryptClientCredentials).mockReturnValue({ username: "admin", password: "pass" })
    vi.mocked(withSessionRetry).mockImplementation(async (_h, _p, _s, _u, _pw, op) =>
      op("http://localhost:8080", "test-sid")
    )
    vi.mocked(getTorrents).mockResolvedValue([])
  })

  it("returns empty result when no clients are provided", async () => {
    const result = await fetchAndMergeTorrents([], ["aither"], makeKey())
    expect(result.torrents).toEqual([])
    expect(result.clientErrors).toEqual([])
    expect(result.clientCount).toBe(0)
    expect(withSessionRetry).not.toHaveBeenCalled()
  })

  it("returns empty result when no tags are provided", async () => {
    const result = await fetchAndMergeTorrents([makeClient()], [], makeKey())
    expect(result.torrents).toEqual([])
    expect(result.clientErrors).toEqual([])
    expect(result.clientCount).toBe(0)
    expect(withSessionRetry).not.toHaveBeenCalled()
  })
})

describe("fetchAndMergeTorrents — fast path (store is fresh, no filter)", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(buildBaseUrl).mockReturnValue("http://localhost:8080")
    vi.mocked(mergeTorrentLists).mockImplementation((lists: RawTorrent[][]) => lists.flat())
    vi.mocked(decryptClientCredentials).mockReturnValue({ username: "admin", password: "pass" })
    vi.mocked(withSessionRetry).mockImplementation(async (_h, _p, _s, _u, _pw, op) =>
      op("http://localhost:8080", "test-sid")
    )
    vi.mocked(getTorrents).mockResolvedValue([])
  })

  it("does NOT call withSessionRetry when store is fresh and no filter is provided", async () => {
    vi.mocked(isStoreFresh).mockReturnValue(true)
    vi.mocked(getStoredTorrents).mockReturnValue([])

    await fetchAndMergeTorrents([makeClient()], ["aither"], makeKey())

    expect(withSessionRetry).not.toHaveBeenCalled()
  })

  it("serves torrents from the store when fast path is taken", async () => {
    const storedTorrents = [
      makeTorrent("abc1", { tags: "aither" }),
      makeTorrent("abc2", { tags: "aither" }),
    ]
    vi.mocked(isStoreFresh).mockReturnValue(true)
    vi.mocked(getStoredTorrents).mockReturnValue(storedTorrents)

    const result = await fetchAndMergeTorrents([makeClient()], ["aither"], makeKey())

    expect(withSessionRetry).not.toHaveBeenCalled()
    expect(result.torrents).toHaveLength(2)
    const hashes = result.torrents.map((t) => t.hash)
    expect(hashes).toContain("abc1")
    expect(hashes).toContain("abc2")
  })

  it("builds the base URL before checking store freshness", async () => {
    vi.mocked(isStoreFresh).mockReturnValue(true)
    vi.mocked(getStoredTorrents).mockReturnValue([])

    await fetchAndMergeTorrents([makeClient()], ["aither"], makeKey())

    expect(buildBaseUrl).toHaveBeenCalledWith("localhost", 8080, false)
    expect(isStoreFresh).toHaveBeenCalledWith("http://localhost:8080", expect.any(Number))
  })

  it("reads stored torrents for the correct base URL", async () => {
    vi.mocked(isStoreFresh).mockReturnValue(true)
    vi.mocked(getStoredTorrents).mockReturnValue([])

    await fetchAndMergeTorrents([makeClient()], ["aither"], makeKey())

    expect(getStoredTorrents).toHaveBeenCalledWith("http://localhost:8080")
  })

  it("stamps each torrent with the originating client name", async () => {
    vi.mocked(isStoreFresh).mockReturnValue(true)
    vi.mocked(getStoredTorrents).mockReturnValue([makeTorrent("h1", { tags: "aither" })])

    const result = await fetchAndMergeTorrents(
      [makeClient({ name: "My Client" })],
      ["aither"],
      makeKey()
    )

    expect(result.torrents[0].client_name).toBe("My Client")
  })

  it("reports correct clientCount", async () => {
    vi.mocked(isStoreFresh).mockReturnValue(true)
    vi.mocked(getStoredTorrents).mockReturnValue([])

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
    vi.mocked(mergeTorrentLists).mockImplementation((lists: RawTorrent[][]) => lists.flat())
    vi.mocked(decryptClientCredentials).mockReturnValue({ username: "admin", password: "pass" })
    vi.mocked(withSessionRetry).mockImplementation(async (_h, _p, _s, _u, _pw, op) =>
      op("http://localhost:8080", "test-sid")
    )
    vi.mocked(getTorrents).mockResolvedValue([])
  })

  it("only returns torrents whose tags match the requested tags", async () => {
    const stored = [
      makeTorrent("match1", { tags: "aither" }),
      makeTorrent("match2", { tags: "blutopia" }),
      makeTorrent("no-match", { tags: "untracked-tag" }),
    ]
    vi.mocked(getStoredTorrents).mockReturnValue(stored)

    const result = await fetchAndMergeTorrents([makeClient()], ["aither", "blutopia"], makeKey())

    expect(withSessionRetry).not.toHaveBeenCalled()
    expect(result.torrents).toHaveLength(2)
    const hashes = result.torrents.map((t) => t.hash)
    expect(hashes).toContain("match1")
    expect(hashes).toContain("match2")
    expect(hashes).not.toContain("no-match")
  })

  it("excludes torrents that have no tags", async () => {
    const stored = [makeTorrent("has-tag", { tags: "aither" }), makeTorrent("no-tag", { tags: "" })]
    vi.mocked(getStoredTorrents).mockReturnValue(stored)

    const result = await fetchAndMergeTorrents([makeClient()], ["aither"], makeKey())

    expect(result.torrents).toHaveLength(1)
    expect(result.torrents[0].hash).toBe("has-tag")
  })

  it("tag matching is case-insensitive", async () => {
    const stored = [makeTorrent("h1", { tags: "Aither" }), makeTorrent("h2", { tags: "BLUTOPIA" })]
    vi.mocked(getStoredTorrents).mockReturnValue(stored)

    // Tags requested in lowercase — stored tags have mixed case
    const result = await fetchAndMergeTorrents([makeClient()], ["aither", "blutopia"], makeKey())

    expect(withSessionRetry).not.toHaveBeenCalled()
    expect(result.torrents).toHaveLength(2)
  })

  it("includes torrents that match any one of multiple requested tags", async () => {
    const stored = [
      makeTorrent("only-aither", { tags: "aither" }),
      makeTorrent("only-blu", { tags: "blutopia" }),
      makeTorrent("both", { tags: "aither, blutopia" }),
    ]
    vi.mocked(getStoredTorrents).mockReturnValue(stored)

    const result = await fetchAndMergeTorrents([makeClient()], ["aither", "blutopia"], makeKey())

    expect(result.torrents).toHaveLength(3)
  })

  it("returns no torrents when none match the tags", async () => {
    const stored = [makeTorrent("h1", { tags: "some-other-tag" })]
    vi.mocked(getStoredTorrents).mockReturnValue(stored)

    const result = await fetchAndMergeTorrents([makeClient()], ["aither"], makeKey())

    expect(result.torrents).toHaveLength(0)
  })
})

describe("fetchAndMergeTorrents — fast path skipped when filter is present", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(buildBaseUrl).mockReturnValue("http://localhost:8080")
    vi.mocked(isStoreFresh).mockReturnValue(true)
    vi.mocked(getStoredTorrents).mockReturnValue([makeTorrent("h1", { tags: "aither" })])
    vi.mocked(mergeTorrentLists).mockImplementation((lists: RawTorrent[][]) => lists.flat())
    vi.mocked(decryptClientCredentials).mockReturnValue({ username: "admin", password: "pass" })
    vi.mocked(withSessionRetry).mockImplementation(async (_h, _p, _s, _u, _pw, op) =>
      op("http://localhost:8080", "test-sid")
    )
    vi.mocked(getTorrents).mockResolvedValue([])
  })

  it("calls withSessionRetry instead of reading the store when filter is provided", async () => {
    // Store is fresh but filter is present — must fall back to live fetch
    await fetchAndMergeTorrents([makeClient()], ["aither"], makeKey(), "active")

    expect(withSessionRetry).toHaveBeenCalledOnce()
  })

  it("does NOT read from getStoredTorrents when filter bypasses the fast path", async () => {
    await fetchAndMergeTorrents([makeClient()], ["aither"], makeKey(), "active")

    // getStoredTorrents should never be called when filter forces the cold path
    expect(getStoredTorrents).not.toHaveBeenCalled()
  })

  it("passes the filter to getTorrents on the cold path for single-tag requests", async () => {
    vi.mocked(getTorrents).mockResolvedValue([])

    await fetchAndMergeTorrents([makeClient()], ["aither"], makeKey(), "active")

    expect(getTorrents).toHaveBeenCalledWith(
      "http://localhost:8080",
      "test-sid",
      "aither",
      "active"
    )
  })
})

describe("fetchAndMergeTorrents — fast path skipped when store is stale", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(buildBaseUrl).mockReturnValue("http://localhost:8080")
    vi.mocked(mergeTorrentLists).mockImplementation((lists: RawTorrent[][]) => lists.flat())
    vi.mocked(decryptClientCredentials).mockReturnValue({ username: "admin", password: "pass" })
    vi.mocked(withSessionRetry).mockImplementation(async (_h, _p, _s, _u, _pw, op) =>
      op("http://localhost:8080", "test-sid")
    )
    vi.mocked(getTorrents).mockResolvedValue([])
  })

  it("calls withSessionRetry when the store is stale (isStoreFresh returns false)", async () => {
    vi.mocked(isStoreFresh).mockReturnValue(false)

    await fetchAndMergeTorrents([makeClient()], ["aither"], makeKey())

    expect(withSessionRetry).toHaveBeenCalledOnce()
  })

  it("does NOT call getStoredTorrents when store is stale", async () => {
    vi.mocked(isStoreFresh).mockReturnValue(false)

    await fetchAndMergeTorrents([makeClient()], ["aither"], makeKey())

    expect(getStoredTorrents).not.toHaveBeenCalled()
  })

  it("falls back to per-tag live fetch for a single tag", async () => {
    vi.mocked(isStoreFresh).mockReturnValue(false)
    vi.mocked(getTorrents).mockResolvedValue([makeTorrent("live1", { tags: "aither" })])

    const result = await fetchAndMergeTorrents([makeClient()], ["aither"], makeKey())

    expect(getTorrents).toHaveBeenCalledWith(
      "http://localhost:8080",
      "test-sid",
      "aither",
      undefined
    )
    expect(result.torrents).toHaveLength(1)
    expect(result.torrents[0].hash).toBe("live1")
  })

  it("falls back to parallel per-tag live fetch for multiple tags", async () => {
    vi.mocked(isStoreFresh).mockReturnValue(false)
    vi.mocked(getTorrents)
      .mockResolvedValueOnce([makeTorrent("a1", { tags: "aither" })])
      .mockResolvedValueOnce([makeTorrent("b1", { tags: "blutopia" })])

    const result = await fetchAndMergeTorrents([makeClient()], ["aither", "blutopia"], makeKey())

    // Two tags → two getTorrents calls (no filter passed)
    expect(getTorrents).toHaveBeenCalledTimes(2)
    expect(result.torrents).toHaveLength(2)
  })
})

describe("fetchAndMergeTorrents — fast path skipped when store is uninitialized", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(buildBaseUrl).mockReturnValue("http://localhost:8080")
    vi.mocked(mergeTorrentLists).mockImplementation((lists: RawTorrent[][]) => lists.flat())
    vi.mocked(decryptClientCredentials).mockReturnValue({ username: "admin", password: "pass" })
    vi.mocked(withSessionRetry).mockImplementation(async (_h, _p, _s, _u, _pw, op) =>
      op("http://localhost:8080", "test-sid")
    )
    vi.mocked(getTorrents).mockResolvedValue([])
  })

  it("calls withSessionRetry when store has never been initialized (isStoreFresh returns false)", async () => {
    // isStoreFresh returns false for both stale AND uninitialized stores
    vi.mocked(isStoreFresh).mockReturnValue(false)

    await fetchAndMergeTorrents([makeClient()], ["aither"], makeKey())

    expect(withSessionRetry).toHaveBeenCalledOnce()
    expect(getStoredTorrents).not.toHaveBeenCalled()
  })
})

describe("fetchAndMergeTorrents — error handling", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(buildBaseUrl).mockReturnValue("http://localhost:8080")
    vi.mocked(isStoreFresh).mockReturnValue(false)
    vi.mocked(getStoredTorrents).mockReturnValue([])
    vi.mocked(mergeTorrentLists).mockImplementation((lists: RawTorrent[][]) => lists.flat())
    vi.mocked(decryptClientCredentials).mockReturnValue({ username: "admin", password: "pass" })
    vi.mocked(getTorrents).mockResolvedValue([])
  })

  it("records a client error and does not throw when withSessionRetry rejects", async () => {
    vi.mocked(withSessionRetry).mockRejectedValue(new Error("connect ECONNREFUSED"))

    const result = await fetchAndMergeTorrents([makeClient()], ["aither"], makeKey())

    expect(result.clientErrors).toHaveLength(1)
    expect(result.torrents).toEqual([])
  })

  it("records errors per failing client while succeeding clients still contribute", async () => {
    const goodTorrent = makeTorrent("good", { tags: "aither" })
    vi.mocked(withSessionRetry)
      .mockRejectedValueOnce(new Error("refused"))
      .mockImplementationOnce(async (_h, _p, _s, _u, _pw, op) =>
        op("http://localhost:8080", "test-sid")
      )
    vi.mocked(getTorrents).mockResolvedValue([goodTorrent])

    const failClient = makeClient({ name: "Bad Client" })
    const goodClient = makeClient({ name: "Good Client" })
    const result = await fetchAndMergeTorrents([failClient, goodClient], ["aither"], makeKey())

    expect(result.clientErrors).toHaveLength(1)
    expect(result.clientErrors[0]).toMatch(/Bad Client/)
    expect(result.torrents).toHaveLength(1)
    expect(result.torrents[0].hash).toBe("good")
  })

  it("sets sessionExpired when all clients fail with decryption errors", async () => {
    vi.mocked(decryptClientCredentials).mockImplementation(() => {
      throw new Error("decrypt credentials failed for client")
    })

    const result = await fetchAndMergeTorrents([makeClient()], ["aither"], makeKey())

    expect(result.sessionExpired).toBe(true)
    expect(result.torrents).toEqual([])
  })

  it("does not set sessionExpired when only some clients have decryption failures", async () => {
    vi.mocked(decryptClientCredentials)
      .mockImplementationOnce(() => {
        throw new Error("decrypt credentials failed for client")
      })
      .mockReturnValueOnce({ username: "admin", password: "pass" })
    vi.mocked(withSessionRetry).mockImplementationOnce(async (_h, _p, _s, _u, _pw, op) =>
      op("http://localhost:8080", "test-sid")
    )
    vi.mocked(getTorrents).mockResolvedValue([])

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
    vi.mocked(mergeTorrentLists).mockImplementation((lists: RawTorrent[][]) => lists.flat())
    vi.mocked(decryptClientCredentials).mockReturnValue({ username: "admin", password: "pass" })
    vi.mocked(withSessionRetry).mockImplementation(async (_h, _p, _s, _u, _pw, op) =>
      op("http://localhost:8080", "test-sid")
    )
    vi.mocked(getTorrents).mockResolvedValue([])
  })

  it("strips tracker, content_path, and save_path from fast-path results", async () => {
    vi.mocked(getStoredTorrents).mockReturnValue([
      makeTorrent("h1", {
        tags: "aither",
        tracker: "https://aither.cc/announce?passkey=SECRET",
        content_path: "/data/Secret.mkv",
        save_path: "/data",
      }),
    ])

    const result = await fetchAndMergeTorrents([makeClient()], ["aither"], makeKey())

    expect(result.torrents).toHaveLength(1)
    expect(result.torrents[0]).not.toHaveProperty("tracker")
    expect(result.torrents[0]).not.toHaveProperty("content_path")
    expect(result.torrents[0]).not.toHaveProperty("save_path")
    expect(result.torrents[0]).toHaveProperty("hash", "h1")
  })
})
