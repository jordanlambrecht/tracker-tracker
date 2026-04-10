// src/lib/__tests__/fleet-aggregation.test.ts

import { describe, expect, it } from "vitest"
import type { TorrentRaw, TrackerTag } from "@/lib/fleet"
import { computeFleetAggregation } from "@/lib/fleet-aggregation"

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TRACKER_TAGS: TrackerTag[] = [
  { tag: "aither", name: "Aither", color: "#01d4ff" },
  { tag: "blutopia", name: "Blutopia", color: "#3b82f6" },
]

const CROSS_SEED_TAGS = ["cross-seed"]

// Stable base time: 2024-06-15 00:00:00 UTC (Saturday, hour 0)
// day-of-week = 6, hour = 0
const BASE_SEC = 1718409600 // 2024-06-15T00:00:00Z

function makeTorrent(overrides: Partial<TorrentRaw> & { hash: string }): TorrentRaw {
  return {
    hash: overrides.hash,
    name: overrides.name ?? `Torrent-${overrides.hash}`,
    state: overrides.state ?? "uploading",
    tags: overrides.tags ?? "aither",
    category: overrides.category ?? "movies",
    uploaded: overrides.uploaded ?? 1_000_000,
    downloaded: overrides.downloaded ?? 500_000,
    ratio: overrides.ratio ?? 2.0,
    size: overrides.size ?? 5_000_000_000,
    seedingTime: overrides.seedingTime ?? 86_400,
    activeTime: overrides.activeTime ?? 90_000,
    addedAt: overrides.addedAt ?? BASE_SEC - 86_400 * 15,
    completedAt: overrides.completedAt ?? BASE_SEC - 86_400 * 14,
    lastActivityAt: overrides.lastActivityAt ?? BASE_SEC - 3_600,
    remaining: overrides.remaining ?? 0,
    seedCount: overrides.seedCount ?? 10,
    leechCount: overrides.leechCount ?? 2,
    swarmSeeders: overrides.swarmSeeders ?? 50,
    swarmLeechers: overrides.swarmLeechers ?? 5,
    uploadSpeed: overrides.uploadSpeed ?? 102_400,
    downloadSpeed: overrides.downloadSpeed ?? 0,
    availability: overrides.availability ?? 1.0,
    progress: overrides.progress ?? 1.0,
    clientName: overrides.clientName ?? "qbt-1",
  }
}

// ---------------------------------------------------------------------------
// Test torrents
// ---------------------------------------------------------------------------

// T1: Aither, seeding, ratio 2.0, movies, 15 days ago, recently active
const T1 = makeTorrent({
  hash: "t1",
  name: "Movie.A.2024.mkv",
  state: "uploading",
  tags: "aither",
  category: "movies",
  ratio: 2.0,
  size: 5_000_000_000,
  seedingTime: 86_400,
  uploadSpeed: 102_400,
  addedAt: BASE_SEC - 86_400 * 15,
  lastActivityAt: BASE_SEC - 3_600, // fresh (1 hour ago)
})

// T2: Blutopia, seeding, ratio 0.3 (under 0.5 bucket), tv, 60 days ago, stale
const T2 = makeTorrent({
  hash: "t2",
  name: "Show.B.S01.mkv",
  state: "uploading",
  tags: "blutopia",
  category: "tv",
  ratio: 0.3,
  size: 2_000_000_000,
  seedingTime: 604_800 * 2, // 14 days
  uploadSpeed: 50_000,
  addedAt: BASE_SEC - 86_400 * 60,
  lastActivityAt: BASE_SEC - 86_400 * 35, // stale (>30 days)
})

// T3: Aither, leeching, ratio 0.0
const T3 = makeTorrent({
  hash: "t3",
  name: "Movie.C.2023.mkv",
  state: "downloading",
  tags: "aither",
  category: "movies",
  ratio: 0.0,
  size: 8_000_000_000,
  seedingTime: 0,
  uploadSpeed: 0,
  downloadSpeed: 512_000,
  addedAt: BASE_SEC - 86_400 * 5,
  lastActivityAt: BASE_SEC - 600,
})

// T4: Aither + Blutopia (cross-seeded by name), no cross-seed tag
const T4_AITHER = makeTorrent({
  hash: "t4a",
  name: "Shared.Movie.2024.mkv",
  state: "uploading",
  tags: "aither",
  category: "movies",
  ratio: 1.5,
  size: 4_000_000_000,
  uploadSpeed: 20_000,
  addedAt: BASE_SEC - 86_400 * 10,
  lastActivityAt: BASE_SEC - 7_200,
})

const T4_BLUTOPIA = makeTorrent({
  hash: "t4b",
  name: "Shared.Movie.2024.mkv",
  state: "uploading",
  tags: "blutopia",
  category: "movies",
  ratio: 1.8,
  size: 4_000_000_000,
  uploadSpeed: 30_000,
  addedAt: BASE_SEC - 86_400 * 10,
  lastActivityAt: BASE_SEC - 7_200,
})

// T5: cross-seed tag present
const T5 = makeTorrent({
  hash: "t5",
  name: "Movie.A.2024.mkv",
  state: "uploading",
  tags: "aither, cross-seed",
  category: "movies",
  ratio: 5.5,
  size: 5_000_000_000,
  uploadSpeed: 10_000,
  addedAt: BASE_SEC - 86_400 * 20,
  lastActivityAt: BASE_SEC - 1_800,
})

const ALL_TORRENTS: TorrentRaw[] = [T1, T2, T3, T4_AITHER, T4_BLUTOPIA, T5]

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("computeFleetAggregation", () => {
  // 1. Empty array
  describe("empty input", () => {
    it("returns zero-valued stats for empty torrent array", () => {
      const result = computeFleetAggregation([], TRACKER_TAGS, CROSS_SEED_TAGS)
      expect(result.stats.torrentCount).toBe(0)
      expect(result.stats.totalSeeding).toBe(0)
      expect(result.stats.totalLeeching).toBe(0)
      expect(result.stats.fleetUploadSpeed).toBe(0)
      expect(result.stats.fleetDownloadSpeed).toBe(0)
      expect(result.stats.totalLibrarySize).toBe(0)
      expect(result.stats.crossSeedPercent).toBe(0)
      expect(result.stats.staleCount).toBe(0)
    })

    it("returns empty arrays for empty torrent array", () => {
      const result = computeFleetAggregation([], TRACKER_TAGS, CROSS_SEED_TAGS)
      expect(result.trackerHealth).toHaveLength(0)
      expect(result.ageBands).toHaveLength(0)
      expect(result.ageTimeline).toHaveLength(0)
      expect(result.sizesByTracker).toHaveLength(0)
      expect(result.crossSeedNetwork.nodes).toHaveLength(0)
      expect(result.crossSeedNetwork.edges).toHaveLength(0)
    })

    it("returns empty ratio distribution counts for empty array", () => {
      const result = computeFleetAggregation([], TRACKER_TAGS, CROSS_SEED_TAGS)
      for (const bucket of result.ratioDistribution) {
        expect(bucket.count).toBe(0)
      }
    })
  })

  // 2. Ratio distribution
  describe("ratioDistribution", () => {
    it("buckets torrents into correct ratio ranges", () => {
      const result = computeFleetAggregation(ALL_TORRENTS, TRACKER_TAGS, CROSS_SEED_TAGS)
      // T3: 0.0 -> <0.5; T2: 0.3 -> <0.5
      const under05 = result.ratioDistribution.find((b) => b.label === "<0.5")
      expect(under05?.count).toBe(2)
      // T4a: 1.5, T4b: 1.8 -> 1-2
      const oneToTwo = result.ratioDistribution.find((b) => b.label === "1-2")
      expect(oneToTwo?.count).toBe(2)
      // T1: 2.0 -> 2-5
      const twoToFive = result.ratioDistribution.find((b) => b.label === "2-5")
      expect(twoToFive?.count).toBe(1)
      // T5: 5.5 -> 5-10
      const fiveToTen = result.ratioDistribution.find((b) => b.label === "5-10")
      expect(fiveToTen?.count).toBe(1)
    })

    it("exposes correct min/max on each bucket", () => {
      const result = computeFleetAggregation([], TRACKER_TAGS, CROSS_SEED_TAGS)
      const first = result.ratioDistribution[0]
      expect(first.min).toBe(0)
      expect(first.max).toBe(0.5)
      const second = result.ratioDistribution[1]
      expect(second.min).toBe(0.5)
      expect(second.max).toBe(1)
    })
  })

  // 3. Seed time distribution (seeding only)
  describe("seedTimeDistribution", () => {
    it("only counts seeding torrents", () => {
      // T3 is leeching (state=downloading), should not appear in seed time buckets
      const result = computeFleetAggregation(ALL_TORRENTS, TRACKER_TAGS, CROSS_SEED_TAGS)
      const total = result.seedTimeDistribution.reduce((sum, b) => sum + b.count, 0)
      // 5 seeding: T1, T2, T4a, T4b, T5
      expect(total).toBe(5)
    })

    it("buckets seeding torrents by seedingTime", () => {
      // T1 has seedingTime=86400 (exactly 1d) -> 1-7d bucket (max=604800, not <86400)
      const result = computeFleetAggregation([T1], TRACKER_TAGS, CROSS_SEED_TAGS)
      const under1d = result.seedTimeDistribution.find((b) => b.label === "<1d")
      const one7d = result.seedTimeDistribution.find((b) => b.label === "1-7d")
      expect(under1d?.count).toBe(0)
      expect(one7d?.count).toBe(1)
    })

    it("seed time distribution has color from SEED_TIME_BUCKETS", () => {
      const result = computeFleetAggregation([T1], TRACKER_TAGS, CROSS_SEED_TAGS)
      for (const bucket of result.seedTimeDistribution) {
        expect(bucket.color).toBeTruthy()
        expect(typeof bucket.color).toBe("string")
      }
    })
  })

  // 4. Cross-seed detection
  describe("crossSeed", () => {
    it("counts torrents with cross-seed tag", () => {
      // T5 has "cross-seed" tag
      const result = computeFleetAggregation(ALL_TORRENTS, TRACKER_TAGS, CROSS_SEED_TAGS)
      expect(result.crossSeed.crossSeeded).toBe(1)
    })

    it("computes unique as total minus crossSeeded", () => {
      const result = computeFleetAggregation(ALL_TORRENTS, TRACKER_TAGS, CROSS_SEED_TAGS)
      expect(result.crossSeed.unique).toBe(result.crossSeed.total - result.crossSeed.crossSeeded)
    })

    it("returns zero crossSeeded when no cross-seed tags configured", () => {
      const result = computeFleetAggregation(ALL_TORRENTS, TRACKER_TAGS, [])
      expect(result.crossSeed.crossSeeded).toBe(0)
    })

    it("crossSeedPercent reflects cross-seed ratio", () => {
      // 1 out of 6 = ~16.67%
      const result = computeFleetAggregation(ALL_TORRENTS, TRACKER_TAGS, CROSS_SEED_TAGS)
      expect(result.stats.crossSeedPercent).toBeCloseTo((1 / 6) * 100, 5)
    })
  })

  // 5. Activity grid
  describe("activityGrid", () => {
    it("returns 7x24 = 168 cells", () => {
      const result = computeFleetAggregation(ALL_TORRENTS, TRACKER_TAGS, CROSS_SEED_TAGS)
      expect(result.activityGrid.data).toHaveLength(168)
    })

    it("populates correct hour/day cell from addedAt", () => {
      // Use a known timestamp and derive expected day/hour from local time (same as Date.getDay/getHours)
      const torrent = makeTorrent({ hash: "grid1", addedAt: BASE_SEC })
      const localDate = new Date(BASE_SEC * 1000)
      const expectedDay = localDate.getDay()
      const expectedHour = localDate.getHours()
      const result = computeFleetAggregation([torrent], TRACKER_TAGS, CROSS_SEED_TAGS)
      // buildActivityMatrix stores as [hour, day, count]
      const cell = result.activityGrid.data.find(
        ([h, d]) => h === expectedHour && d === expectedDay
      )
      expect(cell?.[2]).toBe(1)
    })

    it("maxCount is non-negative", () => {
      const result = computeFleetAggregation(ALL_TORRENTS, TRACKER_TAGS, CROSS_SEED_TAGS)
      expect(result.activityGrid.maxCount).toBeGreaterThanOrEqual(0)
    })
  })

  // 6. Stats totals
  describe("stats", () => {
    it("counts seeding and leeching correctly", () => {
      // T3 is leeching, rest are seeding
      const result = computeFleetAggregation(ALL_TORRENTS, TRACKER_TAGS, CROSS_SEED_TAGS)
      expect(result.stats.totalSeeding).toBe(5)
      expect(result.stats.totalLeeching).toBe(1)
    })

    it("sums upload and download speeds", () => {
      const result = computeFleetAggregation([T1, T3], TRACKER_TAGS, CROSS_SEED_TAGS)
      expect(result.stats.fleetUploadSpeed).toBe(T1.uploadSpeed + T3.uploadSpeed)
      expect(result.stats.fleetDownloadSpeed).toBe(T1.downloadSpeed + T3.downloadSpeed)
    })

    it("sums library sizes", () => {
      const result = computeFleetAggregation([T1, T2], TRACKER_TAGS, CROSS_SEED_TAGS)
      expect(result.stats.totalLibrarySize).toBe(T1.size + T2.size)
    })

    it("counts stale torrents (lastActivityAt > 30 days ago)", () => {
      const nowSec = Math.floor(Date.now() / 1000)
      const recentTorrent = makeTorrent({
        hash: "stale-fresh",
        tags: "aither",
        lastActivityAt: nowSec - 3_600, // 1 hour ago, not stale
      })
      const staleTorrent = makeTorrent({
        hash: "stale-old",
        tags: "aither",
        lastActivityAt: nowSec - 86_400 * 35, // 35 days ago, stale
      })
      const result = computeFleetAggregation(
        [recentTorrent, staleTorrent],
        TRACKER_TAGS,
        CROSS_SEED_TAGS
      )
      expect(result.stats.staleCount).toBe(1)
    })

    it("torrentCount equals input array length", () => {
      const result = computeFleetAggregation(ALL_TORRENTS, TRACKER_TAGS, CROSS_SEED_TAGS)
      expect(result.stats.torrentCount).toBe(ALL_TORRENTS.length)
    })
  })

  // 7. Tracker health
  describe("trackerHealth", () => {
    it("computes avgRatio correctly for a single tracker", () => {
      // Only T1 (ratio 2.0) and T4a (ratio 1.5) and T5 (ratio 5.5) match aither
      const result = computeFleetAggregation([T1, T4_AITHER, T5], TRACKER_TAGS, CROSS_SEED_TAGS)
      const aither = result.trackerHealth.find((t) => t.name === "Aither")
      expect(aither).toBeDefined()
      // T5 has tags "aither, cross-seed" -- the first non-cross-seed tracker tag is "aither"
      const expectedAvg = (T1.ratio + T4_AITHER.ratio + T5.ratio) / 3
      expect(aither?.avgRatio).toBeCloseTo(expectedAvg, 5)
    })

    it("computes uploadSpeedSum correctly", () => {
      const result = computeFleetAggregation([T1, T4_AITHER], TRACKER_TAGS, CROSS_SEED_TAGS)
      const aither = result.trackerHealth.find((t) => t.name === "Aither")
      expect(aither?.uploadSpeedSum).toBe(T1.uploadSpeed + T4_AITHER.uploadSpeed)
    })

    it("computes freshnessPct for recently active torrents", () => {
      // T1 lastActivityAt = BASE_SEC - 3600 (1 hour ago = fresh)
      // T2 lastActivityAt = BASE_SEC - 86400*35 (35 days ago = stale)
      // Use real now so we need torrents whose lastActivityAt is within 7 days of now
      const nowSec = Math.floor(Date.now() / 1000)
      const fresh = makeTorrent({
        hash: "fresh1",
        tags: "blutopia",
        lastActivityAt: nowSec - 3_600, // 1 hour ago
      })
      const stale = makeTorrent({
        hash: "stale1",
        tags: "blutopia",
        lastActivityAt: nowSec - 86_400 * 10, // 10 days ago
      })
      const result = computeFleetAggregation([fresh, stale], TRACKER_TAGS, CROSS_SEED_TAGS)
      const blutopia = result.trackerHealth.find((t) => t.name === "Blutopia")
      expect(blutopia?.freshnessPct).toBeCloseTo(50, 5)
    })

    it("computes avgSeedTimeDays only from seeding torrents", () => {
      const result = computeFleetAggregation([T1], TRACKER_TAGS, CROSS_SEED_TAGS)
      const aither = result.trackerHealth.find((t) => t.name === "Aither")
      // T1 seedingTime = 86400 / 86400 = 1 day, torrentCount=1
      expect(aither?.avgSeedTimeDays).toBeCloseTo(1 / 1, 5)
    })

    it("excludes trackers with zero torrents from health list", () => {
      // Only T2 is blutopia, no aither torrents
      const result = computeFleetAggregation([T2], TRACKER_TAGS, CROSS_SEED_TAGS)
      expect(result.trackerHealth.some((t) => t.name === "Aither")).toBe(false)
      expect(result.trackerHealth.some((t) => t.name === "Blutopia")).toBe(true)
    })
  })

  // 8. Storage treemap
  describe("storageByTrackerCategory", () => {
    it("groups by tracker and category", () => {
      const result = computeFleetAggregation([T1, T3], TRACKER_TAGS, CROSS_SEED_TAGS)
      const aither = result.storageByTrackerCategory.find((s) => s.tracker === "Aither")
      expect(aither).toBeDefined()
      // Both T1 and T3 are movies/aither
      const movies = aither?.categories.find((c) => c.name === "movies")
      expect(movies?.count).toBe(2)
      expect(movies?.totalSize).toBe(T1.size + T3.size)
    })

    it("groups multiple categories under same tracker", () => {
      const tvTorrent = makeTorrent({ hash: "tv1", tags: "aither", category: "tv" })
      const result = computeFleetAggregation([T1, tvTorrent], TRACKER_TAGS, CROSS_SEED_TAGS)
      const aither = result.storageByTrackerCategory.find((s) => s.tracker === "Aither")
      expect(aither?.categories).toHaveLength(2)
    })

    it("normalizes empty category to Uncategorized", () => {
      const nocat = makeTorrent({ hash: "nc1", tags: "aither", category: "" })
      const result = computeFleetAggregation([nocat], TRACKER_TAGS, CROSS_SEED_TAGS)
      const aither = result.storageByTrackerCategory.find((s) => s.tracker === "Aither")
      const uncategorized = aither?.categories.find((c) => c.name === "Uncategorized")
      expect(uncategorized).toBeDefined()
    })
  })

  // 9. Category breakdown (count-only view, same source data as storageByTrackerCategory)
  describe("categoryBreakdown", () => {
    it("returns tracker name and category names matching storageByTrackerCategory", () => {
      const result = computeFleetAggregation([T1, T3], TRACKER_TAGS, CROSS_SEED_TAGS)
      // Both T1 and T3 are aither/movies
      const breakdown = result.categoryBreakdown.find((b) => b.tracker === "Aither")
      const storage = result.storageByTrackerCategory.find((s) => s.tracker === "Aither")
      expect(breakdown).toBeDefined()
      expect(storage).toBeDefined()
      // Category names must match
      const breakdownNames = breakdown?.categories.map((c) => c.name).sort()
      const storageNames = storage?.categories.map((c) => c.name).sort()
      expect(breakdownNames).toEqual(storageNames)
    })

    it("counts match storageByTrackerCategory counts for same input", () => {
      const result = computeFleetAggregation([T1, T3], TRACKER_TAGS, CROSS_SEED_TAGS)
      const breakdown = result.categoryBreakdown.find((b) => b.tracker === "Aither")
      const storage = result.storageByTrackerCategory.find((s) => s.tracker === "Aither")
      for (const cat of breakdown?.categories ?? []) {
        const storageCat = storage?.categories.find((c) => c.name === cat.name)
        expect(storageCat).toBeDefined()
        expect(cat.count).toBe(storageCat?.count)
      }
    })

    it("single tracker with one category returns correct count", () => {
      const result = computeFleetAggregation([T1], TRACKER_TAGS, CROSS_SEED_TAGS)
      const breakdown = result.categoryBreakdown.find((b) => b.tracker === "Aither")
      expect(breakdown).toBeDefined()
      expect(breakdown?.categories).toHaveLength(1)
      expect(breakdown?.categories[0].name).toBe("movies")
      expect(breakdown?.categories[0].count).toBe(1)
    })

    it("multiple categories under the same tracker both appear", () => {
      const tvTorrent = makeTorrent({ hash: "tv2", tags: "aither", category: "tv" })
      const result = computeFleetAggregation([T1, tvTorrent], TRACKER_TAGS, CROSS_SEED_TAGS)
      const breakdown = result.categoryBreakdown.find((b) => b.tracker === "Aither")
      expect(breakdown?.categories).toHaveLength(2)
      const catNames = breakdown?.categories.map((c) => c.name)
      expect(catNames).toContain("movies")
      expect(catNames).toContain("tv")
    })

    it("normalizes empty category to Uncategorized in breakdown", () => {
      const nocat = makeTorrent({ hash: "nc2", tags: "aither", category: "" })
      const result = computeFleetAggregation([nocat], TRACKER_TAGS, CROSS_SEED_TAGS)
      const breakdown = result.categoryBreakdown.find((b) => b.tracker === "Aither")
      const uncategorized = breakdown?.categories.find((c) => c.name === "Uncategorized")
      expect(uncategorized).toBeDefined()
      expect(uncategorized?.count).toBe(1)
    })

    it("count increments correctly for multiple torrents in the same category", () => {
      const result = computeFleetAggregation([T1, T3], TRACKER_TAGS, CROSS_SEED_TAGS)
      const breakdown = result.categoryBreakdown.find((b) => b.tracker === "Aither")
      // T1 and T3 are both aither/movies
      const movies = breakdown?.categories.find((c) => c.name === "movies")
      expect(movies?.count).toBe(2)
    })

    it("does not include totalSize field (count-only shape)", () => {
      const result = computeFleetAggregation([T1], TRACKER_TAGS, CROSS_SEED_TAGS)
      const breakdown = result.categoryBreakdown.find((b) => b.tracker === "Aither")
      const cat = breakdown?.categories[0]
      expect(cat).toBeDefined()
      expect(Object.keys(cat ?? {})).not.toContain("totalSize")
    })
  })

  // 10. Size arrays grouped by tracker
  describe("sizesByTracker", () => {
    it("groups sizes by tracker tag", () => {
      const result = computeFleetAggregation([T1, T2], TRACKER_TAGS, CROSS_SEED_TAGS)
      const aither = result.sizesByTracker.find((s) => s.tag === "aither")
      expect(aither?.sizes).toEqual([T1.size])
      const blutopia = result.sizesByTracker.find((s) => s.tag === "blutopia")
      expect(blutopia?.sizes).toEqual([T2.size])
    })

    it("includes color and name for each tracker entry", () => {
      const result = computeFleetAggregation([T1], TRACKER_TAGS, CROSS_SEED_TAGS)
      const aither = result.sizesByTracker.find((s) => s.tag === "aither")
      expect(aither?.name).toBe("Aither")
      expect(aither?.color).toBe("#01d4ff")
    })
  })

  // 10. Age timeline monthly counts
  describe("ageTimeline", () => {
    it("produces correct monthly counts per tracker", () => {
      // T1 addedAt = BASE_SEC - 86400*15 (June 2024 - 15 days = ~May/June 2024)
      const t1MonthKey = new Date((BASE_SEC - 86_400 * 15) * 1000).toISOString().substring(0, 7)
      const result = computeFleetAggregation([T1], TRACKER_TAGS, CROSS_SEED_TAGS)
      const aither = result.ageTimeline.find((t) => t.name === "Aither")
      expect(aither).toBeDefined()
      expect(aither?.months.length).toBeGreaterThan(0)
      const month = aither?.months.find((m) => m.month === t1MonthKey)
      expect(month?.count).toBe(1)
    })

    it("months are sorted ascending", () => {
      const early = makeTorrent({
        hash: "early",
        tags: "aither",
        addedAt: BASE_SEC - 86_400 * 120,
      })
      const late = makeTorrent({ hash: "late", tags: "aither", addedAt: BASE_SEC - 86_400 * 5 })
      const result = computeFleetAggregation([late, early], TRACKER_TAGS, CROSS_SEED_TAGS)
      const aither = result.ageTimeline.find((t) => t.name === "Aither")
      const months = aither?.months ?? []
      for (let i = 1; i < months.length; i++) {
        expect(months[i].month >= months[i - 1].month).toBe(true)
      }
    })
  })

  // 11. Category timeline monthly counts
  describe("categoryTimeline", () => {
    it("groups torrents by category across trackers", () => {
      const result = computeFleetAggregation([T1, T2, T3], TRACKER_TAGS, CROSS_SEED_TAGS)
      const movies = result.categoryTimeline.find((c) => c.category === "movies")
      expect(movies).toBeDefined()
      const tv = result.categoryTimeline.find((c) => c.category === "tv")
      expect(tv).toBeDefined()
    })

    it("counts months correctly for a category", () => {
      // T1 and T3 both "movies"; they may share or differ in month
      const result = computeFleetAggregation([T1, T3], TRACKER_TAGS, CROSS_SEED_TAGS)
      const movies = result.categoryTimeline.find((c) => c.category === "movies")
      const totalCount = movies?.months.reduce((sum, m) => sum + m.count, 0) ?? 0
      expect(totalCount).toBe(2)
    })

    it("months are sorted ascending", () => {
      const early = makeTorrent({
        hash: "ce",
        tags: "aither",
        category: "movies",
        addedAt: BASE_SEC - 86_400 * 120,
      })
      const late = makeTorrent({
        hash: "cl",
        tags: "aither",
        category: "movies",
        addedAt: BASE_SEC - 86_400 * 5,
      })
      const result = computeFleetAggregation([late, early], TRACKER_TAGS, CROSS_SEED_TAGS)
      const movies = result.categoryTimeline.find((c) => c.category === "movies")
      const months = movies?.months ?? []
      for (let i = 1; i < months.length; i++) {
        expect(months[i].month >= months[i - 1].month).toBe(true)
      }
    })
  })

  // 12. Cross-seed network
  describe("crossSeedNetwork", () => {
    it("detects shared-name pairs as cross-seeded between trackers", () => {
      // T4_AITHER and T4_BLUTOPIA share name "Shared.Movie.2024.mkv"
      const result = computeFleetAggregation(
        [T4_AITHER, T4_BLUTOPIA],
        TRACKER_TAGS,
        CROSS_SEED_TAGS
      )
      expect(result.crossSeedNetwork.edges).toHaveLength(1)
      const edge = result.crossSeedNetwork.edges[0]
      const pair = [edge.source, edge.target].sort()
      expect(pair).toEqual(["aither", "blutopia"])
      expect(edge.weight).toBe(1)
    })

    it("counts cross-seeded per node correctly", () => {
      const result = computeFleetAggregation(
        [T4_AITHER, T4_BLUTOPIA],
        TRACKER_TAGS,
        CROSS_SEED_TAGS
      )
      const aitherNode = result.crossSeedNetwork.nodes.find((n) => n.id === "aither")
      expect(aitherNode?.crossSeeded).toBe(1)
    })

    it("does not create network nodes for trackers with zero torrents", () => {
      // Only aither torrent, no blutopia
      const result = computeFleetAggregation([T1], TRACKER_TAGS, CROSS_SEED_TAGS)
      const blutopiaNode = result.crossSeedNetwork.nodes.find((n) => n.id === "blutopia")
      expect(blutopiaNode).toBeUndefined()
    })

    it("excludes cross-seed tags from network tracker matching", () => {
      // T5 has tags "aither, cross-seed" -- cross-seed should not be a node
      const result = computeFleetAggregation([T5], TRACKER_TAGS, CROSS_SEED_TAGS)
      const csNode = result.crossSeedNetwork.nodes.find((n) => n.id === "cross-seed")
      expect(csNode).toBeUndefined()
    })

    it("returns no edges when no torrents share names across trackers", () => {
      // T1 (aither) and T2 (blutopia) have different names
      const result = computeFleetAggregation([T1, T2], TRACKER_TAGS, CROSS_SEED_TAGS)
      expect(result.crossSeedNetwork.edges).toHaveLength(0)
    })
  })

  // 13. Edge cases
  describe("edge cases", () => {
    // ratio -1 sentinel (qBT uses -1 for infinite ratio: downloaded=0, i.e. pure cross-seed)
    describe("ratio -1 sentinel", () => {
      it("excludes ratio=-1 torrent from ratioDistribution", () => {
        const infinite = makeTorrent({ hash: "inf1", tags: "aither", ratio: -1 })
        const result = computeFleetAggregation([infinite], TRACKER_TAGS, CROSS_SEED_TAGS)
        for (const bucket of result.ratioDistribution) {
          expect(bucket.count).toBe(0)
        }
      })

      it("excludes ratio=-1 torrent from trackerHealth.avgRatio", () => {
        const infinite = makeTorrent({ hash: "inf2", tags: "aither", ratio: -1 })
        const result = computeFleetAggregation([infinite], TRACKER_TAGS, CROSS_SEED_TAGS)
        const aither = result.trackerHealth.find((t) => t.name === "Aither")
        // validRatioCount is 0, so avgRatio falls back to 0
        expect(aither?.avgRatio).toBe(0)
      })
    })

    // Torrent whose tags contain no matching tracker tag
    describe("torrent with no matching tracker tag", () => {
      const orphan = makeTorrent({
        hash: "orphan1",
        tags: "someunknowntracker",
        state: "uploading",
        category: "movies",
        addedAt: BASE_SEC - 86_400 * 3,
      })

      it("is counted in stats.totalSeeding", () => {
        const result = computeFleetAggregation([orphan], TRACKER_TAGS, CROSS_SEED_TAGS)
        expect(result.stats.totalSeeding).toBe(1)
      })

      it("does not appear in trackerHealth", () => {
        const result = computeFleetAggregation([orphan], TRACKER_TAGS, CROSS_SEED_TAGS)
        expect(result.trackerHealth).toHaveLength(0)
      })

      it("does not appear in sizesByTracker", () => {
        const result = computeFleetAggregation([orphan], TRACKER_TAGS, CROSS_SEED_TAGS)
        expect(result.sizesByTracker).toHaveLength(0)
      })

      it("does not appear in ageBands", () => {
        const result = computeFleetAggregation([orphan], TRACKER_TAGS, CROSS_SEED_TAGS)
        expect(result.ageBands).toHaveLength(0)
      })

      it("does not appear in ageTimeline", () => {
        const result = computeFleetAggregation([orphan], TRACKER_TAGS, CROSS_SEED_TAGS)
        expect(result.ageTimeline).toHaveLength(0)
      })

      it("does appear in activityGrid when it has a valid addedAt", () => {
        const result = computeFleetAggregation([orphan], TRACKER_TAGS, CROSS_SEED_TAGS)
        const totalActivity = result.activityGrid.data.reduce((sum, [, , count]) => sum + count, 0)
        expect(totalActivity).toBe(1)
      })

      it("does appear in categoryTimeline (categories are not tracker-specific)", () => {
        const result = computeFleetAggregation([orphan], TRACKER_TAGS, CROSS_SEED_TAGS)
        const movies = result.categoryTimeline.find((c) => c.category === "movies")
        expect(movies).toBeDefined()
        const totalCount = movies?.months.reduce((sum, m) => sum + m.count, 0) ?? 0
        expect(totalCount).toBe(1)
      })
    })

    // Mixed seeding/leeching for seed time and avgSeedTimeDays
    describe("mixed seeding and leeching torrents for the same tracker", () => {
      // Seeding torrent: state uploading, seedingTime 86400 (1 day)
      const seedingTorrent = makeTorrent({
        hash: "mix-seed",
        tags: "aither",
        state: "uploading",
        seedingTime: 86_400,
      })
      // Leeching torrent: state downloading, seedingTime 0 (never seeded)
      const leechingTorrent = makeTorrent({
        hash: "mix-leech",
        tags: "aither",
        state: "downloading",
        seedingTime: 0,
      })

      it("seedTimeDistribution only counts the seeding torrent", () => {
        const result = computeFleetAggregation(
          [seedingTorrent, leechingTorrent],
          TRACKER_TAGS,
          CROSS_SEED_TAGS
        )
        const total = result.seedTimeDistribution.reduce((sum, b) => sum + b.count, 0)
        expect(total).toBe(1)
      })

      it("trackerHealth.avgSeedTimeDays averages seedingTime across all tracker torrents", () => {
        // seedTimeDaysSum = (86400/86400) + (0/86400) = 1.0 + 0 = 1.0
        // torrentCount = 2
        // avgSeedTimeDays = 1.0 / 2 = 0.5
        const result = computeFleetAggregation(
          [seedingTorrent, leechingTorrent],
          TRACKER_TAGS,
          CROSS_SEED_TAGS
        )
        const aither = result.trackerHealth.find((t) => t.name === "Aither")
        expect(aither?.avgSeedTimeDays).toBeCloseTo(0.5, 5)
      })
    })
  })
})
