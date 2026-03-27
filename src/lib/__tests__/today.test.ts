// src/lib/__tests__/today.test.ts
//
// Tests for computeTodayAtAGlance() in src/lib/today.ts.
// The DB layer is mocked via vi.mock. Because vi.mock factories are hoisted to
// the top of the file before any variable declarations, the mock factories use
// inline string sentinels that match the schema mock values exactly.

import { beforeEach, describe, expect, it, vi } from "vitest"

// ---------------------------------------------------------------------------
// Per-test data store — populated by seedStore() in each test
// ---------------------------------------------------------------------------

// These string values must match the values returned by the schema mock below.
// "T_" prefix is just a local naming convention; the actual values are what matter.
const SENT_TRACKERS = "SENT_trackers"
const SENT_SNAPSHOTS = "SENT_snapshots"
const SENT_TRACKER_CP = "SENT_tracker_cp" // single merged query for both checkpoint dates
const SENT_TORRENT_CP = "SENT_torrent_cp"
const SENT_CLIENTS = "SENT_clients"

// The store is read by the mock's .from() handler
const store: Record<string, unknown[]> = {
  [SENT_TRACKERS]: [],
  [SENT_SNAPSHOTS]: [],
  [SENT_TRACKER_CP]: [],
  [SENT_TORRENT_CP]: [],
  [SENT_CLIENTS]: [],
}

function seedStore(
  trackers: unknown[] = [],
  snapshots: unknown[] = [],
  yesterdayCps: unknown[] = [],
  dayBeforeCps: unknown[] = [],
  torrentCps: unknown[] = [],
  clients: unknown[] = []
) {
  store[SENT_TRACKERS] = trackers
  store[SENT_SNAPSHOTS] = snapshots
  // Both date ranges are now fetched in one inArray query; combine them here
  store[SENT_TRACKER_CP] = [...yesterdayCps, ...dayBeforeCps]
  store[SENT_TORRENT_CP] = torrentCps
  store[SENT_CLIENTS] = clients
}

// ---------------------------------------------------------------------------
// DB mock — vi.mock factory is hoisted; use ONLY inline literals here
// ---------------------------------------------------------------------------

vi.mock("@/lib/db", () => {
  // NOTE: Cannot reference outer variables here — this factory is hoisted.
  // The store/storeDayBefore variables are module-level so they ARE accessible
  // after hoisting as long as we reference them by closure (not by value at
  // declaration time). Vitest hoists vi.mock but the factory closure still
  // has access to module-level mutable state.
  return {
    db: {
      select: vi.fn(() => ({
        from: vi.fn((table: string) => ({
          where: vi.fn((_cond: unknown) => {
            // todaySnapshots has .orderBy() after .where()
            if (table === "SENT_snapshots") {
              return {
                orderBy: vi.fn(() => Promise.resolve(store.SENT_snapshots ?? [])),
              }
            }
            // trackerDailyCheckpoints is fetched in a single inArray query
            if (table === "SENT_tracker_cp") {
              return Promise.resolve(store.SENT_tracker_cp ?? [])
            }
            if (table === "SENT_torrent_cp") {
              return Promise.resolve(store.SENT_torrent_cp ?? [])
            }
            if (table === "SENT_clients") {
              return Promise.resolve(store.SENT_clients ?? [])
            }
            if (table === "SENT_trackers") {
              return Promise.resolve(store.SENT_trackers ?? [])
            }
            return Promise.resolve([])
          }),
        })),
      })),
    },
  }
})

// Schema mock — each table is a string sentinel matching the from() dispatch above
vi.mock("@/lib/db/schema", () => ({
  trackers: "SENT_trackers",
  trackerSnapshots: "SENT_snapshots",
  trackerDailyCheckpoints: "SENT_tracker_cp",
  torrentDailyCheckpoints: "SENT_torrent_cp",
  downloadClients: "SENT_clients",
}))

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col: unknown, _val: unknown) => ({ type: "eq" })),
  gte: vi.fn((_col: unknown, _val: unknown) => ({ type: "gte" })),
  inArray: vi.fn((_col: unknown, _vals: unknown) => ({ type: "inArray" })),
  sql: vi.fn(() => ({ type: "sql" })),
}))

// ---------------------------------------------------------------------------
// Import under test (after mocks)
// ---------------------------------------------------------------------------

import { localDateStr } from "@/lib/formatters"
import { computeTodayAtAGlance } from "@/lib/today"

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeTracker(
  id: number,
  overrides: { qbtTag?: string | null; color?: string | null } = {}
) {
  return {
    id,
    name: `Tracker ${id}`,
    color: overrides.color ?? null,
    qbtTag: overrides.qbtTag ?? null,
  }
}

function makeSnapshot(
  trackerId: number,
  polledAt: Date,
  uploadedBytes: string,
  downloadedBytes: string,
  bufferBytes: string | null = null,
  ratio: number | null = null,
  seedbonus: number | null = null
) {
  return {
    id: Math.random(),
    trackerId,
    polledAt,
    uploadedBytes,
    downloadedBytes,
    bufferBytes,
    ratio,
    seedbonus,
    seedingCount: null,
    leechingCount: null,
    hitAndRuns: null,
    warned: null,
    freeleechTokens: null,
    shareScore: null,
    username: null,
    group: null,
  }
}

function makeTrackerCheckpoint(
  trackerId: number,
  checkpointDate: string,
  uploadedBytesEnd: string,
  downloadedBytesEnd: string,
  bufferBytesEnd: string | null = null
) {
  return {
    id: Math.random(),
    trackerId,
    checkpointDate,
    uploadedBytesEnd,
    downloadedBytesEnd,
    bufferBytesEnd,
    ratioEnd: null,
    seedbonusEnd: null,
    snapshotCount: 1,
  }
}

function makeTorrent(
  hash: string,
  name: string,
  tags: string,
  uploaded: number,
  downloaded: number,
  addedOn = 0,
  completionOn = -1
) {
  return {
    hash,
    name,
    state: "uploading",
    tags,
    category: "",
    upspeed: 0,
    dlspeed: 0,
    uploaded,
    downloaded,
    ratio: 1.0,
    size: downloaded || 1,
    num_seeds: 5,
    num_leechs: 0,
    num_complete: 5,
    num_incomplete: 0,
    tracker: "",
    added_on: addedOn,
    completion_on: completionOn,
    last_activity: 0,
    seeding_time: 0,
    time_active: 0,
    seen_complete: 0,
    availability: 1,
    amount_left: 0,
    progress: 1,
    content_path: "",
    save_path: "",
  }
}

function makeTorrentCheckpoint(
  clientId: number,
  hash: string,
  uploadedStart: string,
  downloadedStart: string
) {
  return {
    id: Math.random(),
    clientId,
    hash,
    checkpointDate: localDateStr(),
    uploadedStart,
    downloadedStart,
  }
}

// ---------------------------------------------------------------------------
// beforeEach resets store to empty state
// ---------------------------------------------------------------------------

beforeEach(() => {
  seedStore()
})

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

describe("computeTodayAtAGlance — empty state", () => {
  it("returns zero fleet upload delta when there are no trackers", async () => {
    const result = await computeTodayAtAGlance()
    expect(result.fleet.uploadDelta).toBe("0")
  })

  it("returns zero fleet download delta when there are no trackers", async () => {
    const result = await computeTodayAtAGlance()
    expect(result.fleet.downloadDelta).toBe("0")
  })

  it("returns zero fleet buffer delta when there are no trackers", async () => {
    const result = await computeTodayAtAGlance()
    expect(result.fleet.bufferDelta).toBe("0")
  })

  it("returns null ratioChange when there is no upload activity", async () => {
    const result = await computeTodayAtAGlance()
    expect(result.fleet.ratioChange).toBeNull()
  })

  it("returns null yesterday delta values when no checkpoints exist", async () => {
    const result = await computeTodayAtAGlance()
    expect(result.fleet.uploadDeltaYesterday).toBeNull()
    expect(result.fleet.downloadDeltaYesterday).toBeNull()
    expect(result.fleet.bufferDeltaYesterday).toBeNull()
  })

  it("returns empty trackers array", async () => {
    const result = await computeTodayAtAGlance()
    expect(result.trackers).toEqual([])
  })

  it("returns zero activity counts", async () => {
    const result = await computeTodayAtAGlance()
    expect(result.activity.addedToday).toBe(0)
    expect(result.activity.completedToday).toBe(0)
  })

  it("returns empty movers arrays", async () => {
    const result = await computeTodayAtAGlance()
    expect(result.movers.topUploaders).toHaveLength(0)
    expect(result.movers.topDownloaders).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Single tracker, two snapshots today
// ---------------------------------------------------------------------------

describe("computeTodayAtAGlance — single tracker two snapshots today", () => {
  const GiB = 1024 * 1024 * 1024

  beforeEach(() => {
    const now = new Date()
    const tracker = makeTracker(1)
    const earliest = makeSnapshot(
      1,
      new Date(now.getTime() - 3600000),
      String(10n * BigInt(GiB)),
      String(5n * BigInt(GiB))
    )
    const latest = makeSnapshot(
      1,
      now,
      String(11n * BigInt(GiB)),
      String(5n * BigInt(GiB) + 512n * 1024n * 1024n)
    )
    seedStore([tracker], [earliest, latest])
  })

  it("computes upload delta as last minus first snapshot value", async () => {
    const result = await computeTodayAtAGlance()
    expect(BigInt(result.fleet.uploadDelta)).toBe(BigInt(GiB))
  })

  it("computes download delta correctly", async () => {
    const result = await computeTodayAtAGlance()
    expect(BigInt(result.fleet.downloadDelta)).toBe(512n * 1024n * 1024n)
  })

  it("exposes the tracker entry with the correct upload delta", async () => {
    const result = await computeTodayAtAGlance()
    expect(result.trackers).toHaveLength(1)
    expect(result.trackers[0].id).toBe(1)
    expect(BigInt(result.trackers[0].uploadDelta)).toBe(BigInt(GiB))
  })
})

// ---------------------------------------------------------------------------
// Fewer than 2 snapshots
// ---------------------------------------------------------------------------

describe("computeTodayAtAGlance — tracker with only one snapshot today", () => {
  beforeEach(() => {
    const tracker = makeTracker(1)
    const snap = makeSnapshot(1, new Date(), "1000000000", "500000000")
    seedStore([tracker], [snap])
  })

  it("returns zero deltas when tracker has fewer than 2 snapshots today", async () => {
    const result = await computeTodayAtAGlance()
    expect(result.trackers[0].uploadDelta).toBe("0")
    expect(result.trackers[0].downloadDelta).toBe("0")
  })
})

// ---------------------------------------------------------------------------
// Null bufferBytes handling
// ---------------------------------------------------------------------------

describe("computeTodayAtAGlance — null bufferBytes on both snapshots", () => {
  beforeEach(() => {
    const tracker = makeTracker(1)
    const earliest = makeSnapshot(
      1,
      new Date(Date.now() - 3600000),
      "1000000000",
      "500000000",
      null
    )
    const latest = makeSnapshot(1, new Date(), "2000000000", "600000000", null)
    seedStore([tracker], [earliest, latest])
  })

  it("does not crash when bufferBytes is null and returns 0 buffer delta", async () => {
    const result = await computeTodayAtAGlance()
    expect(result.fleet.bufferDelta).toBe("0")
    expect(result.trackers[0].bufferDelta).toBe("0")
  })
})

describe("computeTodayAtAGlance — null bufferBytes on earliest, value on latest", () => {
  beforeEach(() => {
    const tracker = makeTracker(1)
    const earliest = makeSnapshot(
      1,
      new Date(Date.now() - 3600000),
      "1000000000",
      "500000000",
      null
    )
    const latest = makeSnapshot(1, new Date(), "2000000000", "600000000", "1073741824")
    seedStore([tracker], [earliest, latest])
  })

  it("treats null bufferBytes as 0n so delta equals the latest buffer value", async () => {
    const result = await computeTodayAtAGlance()
    expect(BigInt(result.trackers[0].bufferDelta)).toBe(1073741824n)
  })
})

// ---------------------------------------------------------------------------
// Yesterday comparison via checkpoint pairs
// ---------------------------------------------------------------------------

describe("computeTodayAtAGlance — yesterday comparison", () => {
  const yesterdayStr = localDateStr(Date.now() - 86400000)
  const dayBeforeStr = localDateStr(Date.now() - 172800000)

  it("computes fleet upload and download deltas for yesterday", async () => {
    const tracker = makeTracker(1)
    const snap1 = makeSnapshot(1, new Date(Date.now() - 3600000), "2000000000", "1000000000")
    const snap2 = makeSnapshot(1, new Date(), "3000000000", "1500000000")
    // Yesterday ended at 2G upload, day-before ended at 1G → delta = 1G
    const yestCp = makeTrackerCheckpoint(1, yesterdayStr, "2000000000", "1000000000")
    const dayBeforeCp = makeTrackerCheckpoint(1, dayBeforeStr, "1000000000", "500000000")
    seedStore([tracker], [snap1, snap2], [yestCp], [dayBeforeCp])

    const result = await computeTodayAtAGlance()
    expect(result.fleet.uploadDeltaYesterday).toBe("1000000000")
    expect(result.fleet.downloadDeltaYesterday).toBe("500000000")
  })

  it("returns null when yesterday checkpoint exists but no day-before checkpoint", async () => {
    const tracker = makeTracker(1)
    const snap = makeSnapshot(1, new Date(), "2000000000", "1000000000")
    const yestCp = makeTrackerCheckpoint(1, yesterdayStr, "2000000000", "1000000000")
    seedStore([tracker], [snap], [yestCp], [])

    const result = await computeTodayAtAGlance()
    expect(result.fleet.uploadDeltaYesterday).toBeNull()
    expect(result.fleet.downloadDeltaYesterday).toBeNull()
  })

  it("returns null when checkpoints exist for a different tracker id", async () => {
    const tracker = makeTracker(1)
    const snap = makeSnapshot(1, new Date(), "2000000000", "1000000000")
    // trackerId 99 does not match tracker 1
    const yestCp = makeTrackerCheckpoint(99, yesterdayStr, "2000000000", "1000000000")
    const dayBeforeCp = makeTrackerCheckpoint(99, dayBeforeStr, "1000000000", "500000000")
    seedStore([tracker], [snap], [yestCp], [dayBeforeCp])

    const result = await computeTodayAtAGlance()
    expect(result.fleet.uploadDeltaYesterday).toBeNull()
  })

  it("treats null bufferBytesEnd as 0n in yesterday buffer delta", async () => {
    const tracker = makeTracker(1)
    const snap1 = makeSnapshot(1, new Date(Date.now() - 3600000), "1000000000", "500000000")
    const snap2 = makeSnapshot(1, new Date(), "2000000000", "1000000000")
    const yestCp = makeTrackerCheckpoint(1, yesterdayStr, "2000000000", "1000000000", null)
    const dayBeforeCp = makeTrackerCheckpoint(1, dayBeforeStr, "1000000000", "500000000", null)
    seedStore([tracker], [snap1, snap2], [yestCp], [dayBeforeCp])

    const result = await computeTodayAtAGlance()
    expect(result.fleet.bufferDeltaYesterday).toBe("0")
  })
})

// ---------------------------------------------------------------------------
// Torrent movers tag filtering
// ---------------------------------------------------------------------------

describe("computeTodayAtAGlance — torrent movers tag filtering", () => {
  it("excludes torrents whose tags do not match any tracker qbtTag", async () => {
    const tracker = makeTracker(1, { qbtTag: "aither" })
    const snap1 = makeSnapshot(1, new Date(Date.now() - 3600000), "1000000000", "500000000")
    const snap2 = makeSnapshot(1, new Date(), "2000000000", "1000000000")
    const torrent = makeTorrent("hash1", "Some Movie", "other-tracker", 5000000000, 3000000000)
    const cp = makeTorrentCheckpoint(1, "hash1", "0", "0")
    const client = { id: 1, name: "qBit", cachedTorrents: JSON.stringify([torrent]) }
    seedStore([tracker], [snap1, snap2], [], [], [cp], [client])

    const result = await computeTodayAtAGlance()
    expect(result.movers.topUploaders).toHaveLength(0)
    expect(result.movers.topDownloaders).toHaveLength(0)
  })

  it("includes torrents whose tags match a tracker's qbtTag", async () => {
    const tracker = makeTracker(1, { qbtTag: "aither" })
    const snap1 = makeSnapshot(1, new Date(Date.now() - 3600000), "1000000000", "500000000")
    const snap2 = makeSnapshot(1, new Date(), "2000000000", "1000000000")
    const torrent = makeTorrent("hash1", "Some Movie", "aither", 5000000000, 3000000000)
    const cp = makeTorrentCheckpoint(1, "hash1", "0", "0")
    const client = { id: 1, name: "qBit", cachedTorrents: JSON.stringify([torrent]) }
    seedStore([tracker], [snap1, snap2], [], [], [cp], [client])

    const result = await computeTodayAtAGlance()
    expect(result.movers.topUploaders).toHaveLength(1)
    expect(result.movers.topUploaders[0].hash).toBe("hash1")
    expect(result.movers.topUploaders[0].qbtTag).toBe("aither")
  })

  it("excludes torrents with zero upload delta from topUploaders", async () => {
    const tracker = makeTracker(1, { qbtTag: "aither" })
    const snap1 = makeSnapshot(1, new Date(Date.now() - 3600000), "1000000000", "500000000")
    const snap2 = makeSnapshot(1, new Date(), "2000000000", "1000000000")
    // uploaded matches checkpoint start → upload delta = 0
    const torrent = makeTorrent("hash1", "Stalled Movie", "aither", 1000000000, 3000000000)
    const cp = makeTorrentCheckpoint(1, "hash1", "1000000000", "0")
    const client = { id: 1, name: "qBit", cachedTorrents: JSON.stringify([torrent]) }
    seedStore([tracker], [snap1, snap2], [], [], [cp], [client])

    const result = await computeTodayAtAGlance()
    expect(result.movers.topUploaders).toHaveLength(0)
  })

  it("excludes torrents with zero download delta from topDownloaders", async () => {
    const tracker = makeTracker(1, { qbtTag: "aither" })
    const snap1 = makeSnapshot(1, new Date(Date.now() - 3600000), "1000000000", "500000000")
    const snap2 = makeSnapshot(1, new Date(), "2000000000", "1000000000")
    // downloaded matches checkpoint start → download delta = 0
    const torrent = makeTorrent("hash1", "Completed Movie", "aither", 5000000000, 3000000000)
    const cp = makeTorrentCheckpoint(1, "hash1", "0", "3000000000")
    const client = { id: 1, name: "qBit", cachedTorrents: JSON.stringify([torrent]) }
    seedStore([tracker], [snap1, snap2], [], [], [cp], [client])

    const result = await computeTodayAtAGlance()
    expect(result.movers.topDownloaders).toHaveLength(0)
  })

  it("caps topUploaders and topDownloaders at 5 entries each", async () => {
    const tracker = makeTracker(1, { qbtTag: "aither" })
    const snap1 = makeSnapshot(1, new Date(Date.now() - 3600000), "1000000000", "500000000")
    const snap2 = makeSnapshot(1, new Date(), "2000000000", "1000000000")
    const torrents = Array.from({ length: 8 }, (_, i) =>
      makeTorrent(`hash${i}`, `Movie ${i}`, "aither", (i + 1) * 1000000000, (i + 1) * 500000000)
    )
    const cps = torrents.map((t) => makeTorrentCheckpoint(1, t.hash, "0", "0"))
    const client = { id: 1, name: "qBit", cachedTorrents: JSON.stringify(torrents) }
    seedStore([tracker], [snap1, snap2], [], [], cps, [client])

    const result = await computeTodayAtAGlance()
    expect(result.movers.topUploaders.length).toBeLessThanOrEqual(5)
    expect(result.movers.topDownloaders.length).toBeLessThanOrEqual(5)
  })

  it("excludes torrents that have no matching torrent checkpoint entry", async () => {
    const tracker = makeTracker(1, { qbtTag: "aither" })
    const snap1 = makeSnapshot(1, new Date(Date.now() - 3600000), "1000000000", "500000000")
    const snap2 = makeSnapshot(1, new Date(), "2000000000", "1000000000")
    const torrent = makeTorrent(
      "hash-no-cp",
      "No Checkpoint Movie",
      "aither",
      5000000000,
      3000000000
    )
    const client = { id: 1, name: "qBit", cachedTorrents: JSON.stringify([torrent]) }
    // No checkpoint in torrent CP list
    seedStore([tracker], [snap1, snap2], [], [], [], [client])

    const result = await computeTodayAtAGlance()
    expect(result.movers.topUploaders).toHaveLength(0)
  })

  it("attaches tracker color to matched mover entries", async () => {
    const tracker = makeTracker(1, { qbtTag: "aither", color: "#00d4ff" })
    const snap1 = makeSnapshot(1, new Date(Date.now() - 3600000), "1000000000", "500000000")
    const snap2 = makeSnapshot(1, new Date(), "2000000000", "1000000000")
    const torrent = makeTorrent("hash1", "Colored Movie", "aither", 5000000000, 3000000000)
    const cp = makeTorrentCheckpoint(1, "hash1", "0", "0")
    const client = { id: 1, name: "qBit", cachedTorrents: JSON.stringify([torrent]) }
    seedStore([tracker], [snap1, snap2], [], [], [cp], [client])

    const result = await computeTodayAtAGlance()
    expect(result.movers.topUploaders[0].trackerColor).toBe("#00d4ff")
  })
})

// ---------------------------------------------------------------------------
// Fleet aggregation — multiple trackers
// ---------------------------------------------------------------------------

describe("computeTodayAtAGlance — fleet aggregation with multiple trackers", () => {
  it("sums upload deltas across all trackers", async () => {
    const tracker1 = makeTracker(1)
    const tracker2 = makeTracker(2)
    const now = Date.now()
    // tracker1: 3G - 1G = 2G; tracker2: 4G - 2G = 2G; total = 4G
    const snaps = [
      makeSnapshot(1, new Date(now - 3600000), "1000000000", "500000000"),
      makeSnapshot(2, new Date(now - 3600000), "2000000000", "1000000000"),
      makeSnapshot(1, new Date(now), "3000000000", "600000000"),
      makeSnapshot(2, new Date(now), "4000000000", "1200000000"),
    ]
    seedStore([tracker1, tracker2], snaps)

    const result = await computeTodayAtAGlance()
    expect(BigInt(result.fleet.uploadDelta)).toBe(4000000000n)
  })

  it("sums download deltas across all trackers", async () => {
    const tracker1 = makeTracker(1)
    const tracker2 = makeTracker(2)
    const now = Date.now()
    // tracker1 dl: 700M - 500M = 200M; tracker2 dl: 500M - 200M = 300M; total = 500M
    const snaps = [
      makeSnapshot(1, new Date(now - 3600000), "1000000000", "500000000"),
      makeSnapshot(2, new Date(now - 3600000), "1000000000", "200000000"),
      makeSnapshot(1, new Date(now), "2000000000", "700000000"),
      makeSnapshot(2, new Date(now), "2000000000", "500000000"),
    ]
    seedStore([tracker1, tracker2], snaps)

    const result = await computeTodayAtAGlance()
    expect(BigInt(result.fleet.downloadDelta)).toBe(500000000n)
  })

  it("tracker with no snapshots contributes zero and still appears in trackers array", async () => {
    const tracker1 = makeTracker(1)
    const tracker2 = makeTracker(2) // no snapshots
    const now = Date.now()
    const snaps = [
      makeSnapshot(1, new Date(now - 3600000), "1000000000", "500000000"),
      makeSnapshot(1, new Date(now), "2000000000", "600000000"),
    ]
    seedStore([tracker1, tracker2], snaps)

    const result = await computeTodayAtAGlance()
    expect(BigInt(result.fleet.uploadDelta)).toBe(1000000000n)
    expect(result.trackers).toHaveLength(2)
    expect(result.trackers.find((t) => t.id === 2)?.uploadDelta).toBe("0")
  })
})

// ---------------------------------------------------------------------------
// Ratio weighted average
// ---------------------------------------------------------------------------

describe("computeTodayAtAGlance — ratio weighted average", () => {
  it("weights ratio change by upload volume — more upload means more weight", async () => {
    const tracker1 = makeTracker(1)
    const tracker2 = makeTracker(2)
    const now = Date.now()
    // tracker1: +2G upload, ratio +0.1; tracker2: +0.5G upload, ratio +1.0
    // weighted avg = (0.1 * 2G + 1.0 * 0.5G) / (2G + 0.5G)
    //             = (0.2G + 0.5G) / 2.5G = 0.7 / 2.5 = 0.28
    const snaps = [
      makeSnapshot(1, new Date(now - 3600000), "2000000000", "2000000000", null, 1.0),
      makeSnapshot(2, new Date(now - 3600000), "500000000", "500000000", null, 1.0),
      makeSnapshot(1, new Date(now), "4000000000", "2000000000", null, 1.1),
      makeSnapshot(2, new Date(now), "1000000000", "500000000", null, 2.0),
    ]
    seedStore([tracker1, tracker2], snaps)

    const result = await computeTodayAtAGlance()
    expect(result.fleet.ratioChange).not.toBeNull()
    expect(result.fleet.ratioChange as number).toBeCloseTo(0.28, 5)
  })

  it("returns null ratioChange when all upload deltas are zero (no progress this session)", async () => {
    const tracker = makeTracker(1)
    // Both snapshots have same uploaded bytes — delta = 0, weight = 0
    const snap1 = makeSnapshot(
      1,
      new Date(Date.now() - 3600000),
      "1000000000",
      "500000000",
      null,
      1.0
    )
    const snap2 = makeSnapshot(1, new Date(), "1000000000", "500000000", null, 1.5)
    seedStore([tracker], [snap1, snap2])

    const result = await computeTodayAtAGlance()
    expect(result.fleet.ratioChange).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Activity counts
// ---------------------------------------------------------------------------

describe("computeTodayAtAGlance — activity counts", () => {
  it("counts torrents whose added_on unix timestamp falls on today", async () => {
    const tracker = makeTracker(1, { qbtTag: "aither" })
    const snap1 = makeSnapshot(1, new Date(Date.now() - 3600000), "1000000000", "500000000")
    const snap2 = makeSnapshot(1, new Date(), "2000000000", "1000000000")

    const todayNoon = new Date()
    todayNoon.setHours(12, 0, 0, 0)
    const torrent = makeTorrent(
      "h1",
      "New Movie",
      "aither",
      0,
      0,
      Math.floor(todayNoon.getTime() / 1000),
      -1
    )
    const client = { id: 1, name: "qBit", cachedTorrents: JSON.stringify([torrent]) }
    seedStore([tracker], [snap1, snap2], [], [], [], [client])

    const result = await computeTodayAtAGlance()
    expect(result.activity.addedToday).toBe(1)
  })

  it("does not count torrents with added_on of 0 (unix epoch, not today)", async () => {
    const tracker = makeTracker(1, { qbtTag: "aither" })
    const snap1 = makeSnapshot(1, new Date(Date.now() - 3600000), "1000000000", "500000000")
    const snap2 = makeSnapshot(1, new Date(), "2000000000", "1000000000")
    const torrent = makeTorrent("h1", "Old Movie", "aither", 0, 0, 0, -1)
    const client = { id: 1, name: "qBit", cachedTorrents: JSON.stringify([torrent]) }
    seedStore([tracker], [snap1, snap2], [], [], [], [client])

    const result = await computeTodayAtAGlance()
    expect(result.activity.addedToday).toBe(0)
  })

  it("counts torrents whose completion_on unix timestamp falls on today", async () => {
    const tracker = makeTracker(1, { qbtTag: "aither" })
    const snap1 = makeSnapshot(1, new Date(Date.now() - 3600000), "1000000000", "500000000")
    const snap2 = makeSnapshot(1, new Date(), "2000000000", "1000000000")

    const todayNoon = new Date()
    todayNoon.setHours(12, 0, 0, 0)
    const torrent = makeTorrent(
      "h1",
      "Done Movie",
      "aither",
      0,
      5000000000,
      0,
      Math.floor(todayNoon.getTime() / 1000)
    )
    const client = { id: 1, name: "qBit", cachedTorrents: JSON.stringify([torrent]) }
    seedStore([tracker], [snap1, snap2], [], [], [], [client])

    const result = await computeTodayAtAGlance()
    expect(result.activity.completedToday).toBe(1)
  })

  it("ignores completion_on of -1 (torrent is still downloading)", async () => {
    const tracker = makeTracker(1, { qbtTag: "aither" })
    const snap1 = makeSnapshot(1, new Date(Date.now() - 3600000), "1000000000", "500000000")
    const snap2 = makeSnapshot(1, new Date(), "2000000000", "1000000000")
    const torrent = makeTorrent("h1", "Seeding Movie", "aither", 5000000000, 5000000000, 0, -1)
    const client = { id: 1, name: "qBit", cachedTorrents: JSON.stringify([torrent]) }
    seedStore([tracker], [snap1, snap2], [], [], [], [client])

    const result = await computeTodayAtAGlance()
    expect(result.activity.completedToday).toBe(0)
  })

  it("ignores completion_on of 0 (qBittorrent sentinel for 'not completed')", async () => {
    const tracker = makeTracker(1, { qbtTag: "aither" })
    const snap1 = makeSnapshot(1, new Date(Date.now() - 3600000), "1000000000", "500000000")
    const snap2 = makeSnapshot(1, new Date(), "2000000000", "1000000000")
    const torrent = makeTorrent("h1", "Seeding Movie", "aither", 5000000000, 5000000000, 0, 0)
    const client = { id: 1, name: "qBit", cachedTorrents: JSON.stringify([torrent]) }
    seedStore([tracker], [snap1, snap2], [], [], [], [client])

    const result = await computeTodayAtAGlance()
    expect(result.activity.completedToday).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Output shape invariants
// ---------------------------------------------------------------------------

describe("computeTodayAtAGlance — output shape", () => {
  it("fleet object has all required keys", async () => {
    const result = await computeTodayAtAGlance()
    expect(result.fleet).toHaveProperty("uploadDelta")
    expect(result.fleet).toHaveProperty("downloadDelta")
    expect(result.fleet).toHaveProperty("bufferDelta")
    expect(result.fleet).toHaveProperty("ratioChange")
    expect(result.fleet).toHaveProperty("seedbonusChange")
    expect(result.fleet).toHaveProperty("uploadDeltaYesterday")
    expect(result.fleet).toHaveProperty("downloadDeltaYesterday")
    expect(result.fleet).toHaveProperty("bufferDeltaYesterday")
  })

  it("fleet delta values are strings (bigints serialized for JSON safety)", async () => {
    const result = await computeTodayAtAGlance()
    expect(typeof result.fleet.uploadDelta).toBe("string")
    expect(typeof result.fleet.downloadDelta).toBe("string")
    expect(typeof result.fleet.bufferDelta).toBe("string")
  })

  it("movers has topUploaders and topDownloaders as arrays", async () => {
    const result = await computeTodayAtAGlance()
    expect(Array.isArray(result.movers.topUploaders)).toBe(true)
    expect(Array.isArray(result.movers.topDownloaders)).toBe(true)
  })

  it("each tracker entry has id, name, color, uploadDelta, downloadDelta, bufferDelta", async () => {
    const tracker = makeTracker(1)
    const snap1 = makeSnapshot(1, new Date(Date.now() - 3600000), "1000000000", "500000000")
    const snap2 = makeSnapshot(1, new Date(), "2000000000", "600000000")
    seedStore([tracker], [snap1, snap2])

    const result = await computeTodayAtAGlance()
    const t = result.trackers[0]
    expect(t).toHaveProperty("id")
    expect(t).toHaveProperty("name")
    expect(t).toHaveProperty("color")
    expect(t).toHaveProperty("uploadDelta")
    expect(t).toHaveProperty("downloadDelta")
    expect(t).toHaveProperty("bufferDelta")
  })
})
