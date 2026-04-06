// src/lib/download-clients/__tests__/merge.test.ts

import { describe, expect, it } from "vitest"
import { aggregateCrossSeedTags, mergeTorrentLists, type RawTorrent } from "../merge"

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeTorrent(overrides: Partial<RawTorrent> & { hash: string }): RawTorrent {
  return {
    hash: overrides.hash,
    uploadSpeed: overrides.uploadSpeed ?? 1000,
    downloadSpeed: overrides.downloadSpeed ?? 500,
    seedingTime: overrides.seedingTime ?? 3600,
    progress: overrides.progress ?? 1.0,
    seedCount: overrides.seedCount ?? 10,
    swarmSeeders: overrides.swarmSeeders ?? 50,
    leechCount: overrides.leechCount ?? 2,
    swarmLeechers: overrides.swarmLeechers ?? 5,
    uploaded: overrides.uploaded ?? 2_000_000,
    downloaded: overrides.downloaded ?? 1_000_000,
    ratio: overrides.ratio ?? 2.0,
  }
}

// ---------------------------------------------------------------------------
// mergeTorrentLists
// ---------------------------------------------------------------------------

describe("mergeTorrentLists", () => {
  describe("no overlap", () => {
    it("returns concatenation when lists share no hashes", () => {
      const a = makeTorrent({ hash: "aaa" })
      const b = makeTorrent({ hash: "bbb" })
      const result = mergeTorrentLists([[a], [b]])
      expect(result).toHaveLength(2)
      const hashes = result.map((t) => t.hash).sort()
      expect(hashes).toEqual(["aaa", "bbb"])
    })

    it("preserves all field values when no overlap exists", () => {
      const a = makeTorrent({ hash: "aaa", uploadSpeed: 100, downloadSpeed: 200 })
      const b = makeTorrent({ hash: "bbb", uploadSpeed: 300, downloadSpeed: 400 })
      const result = mergeTorrentLists([[a], [b]])
      const ra = result.find((t) => t.hash === "aaa")
      expect(ra?.uploadSpeed).toBe(100)
      expect(ra?.downloadSpeed).toBe(200)
      const rb = result.find((t) => t.hash === "bbb")
      expect(rb?.uploadSpeed).toBe(300)
      expect(rb?.downloadSpeed).toBe(400)
    })
  })

  describe("full overlap (same hash on two clients)", () => {
    it("sums uploadSpeed and downloadSpeed", () => {
      const t1 = makeTorrent({ hash: "hhh", uploadSpeed: 1000, downloadSpeed: 200 })
      const t2 = makeTorrent({ hash: "hhh", uploadSpeed: 500, downloadSpeed: 100 })
      const [result] = mergeTorrentLists([[t1], [t2]])
      expect(result.uploadSpeed).toBe(1500)
      expect(result.downloadSpeed).toBe(300)
    })

    it("sums uploaded and downloaded", () => {
      const t1 = makeTorrent({ hash: "hhh", uploaded: 3_000_000, downloaded: 1_500_000 })
      const t2 = makeTorrent({ hash: "hhh", uploaded: 1_000_000, downloaded: 500_000 })
      const [result] = mergeTorrentLists([[t1], [t2]])
      expect(result.uploaded).toBe(4_000_000)
      expect(result.downloaded).toBe(2_000_000)
    })

    it("takes max for seedingTime", () => {
      const t1 = makeTorrent({ hash: "hhh", seedingTime: 7200 })
      const t2 = makeTorrent({ hash: "hhh", seedingTime: 3600 })
      const [result] = mergeTorrentLists([[t1], [t2]])
      expect(result.seedingTime).toBe(7200)
    })

    it("takes max for progress", () => {
      const t1 = makeTorrent({ hash: "hhh", progress: 0.7 })
      const t2 = makeTorrent({ hash: "hhh", progress: 1.0 })
      const [result] = mergeTorrentLists([[t1], [t2]])
      expect(result.progress).toBe(1.0)
    })

    it("takes max for swarm counts", () => {
      const t1 = makeTorrent({
        hash: "hhh",
        seedCount: 5,
        swarmSeeders: 30,
        leechCount: 1,
        swarmLeechers: 3,
      })
      const t2 = makeTorrent({
        hash: "hhh",
        seedCount: 15,
        swarmSeeders: 20,
        leechCount: 4,
        swarmLeechers: 7,
      })
      const [result] = mergeTorrentLists([[t1], [t2]])
      expect(result.seedCount).toBe(15)
      expect(result.swarmSeeders).toBe(30)
      expect(result.leechCount).toBe(4)
      expect(result.swarmLeechers).toBe(7)
    })

    it("keeps non-numeric fields from the first occurrence", () => {
      // hash is the only non-numeric field in RawTorrent; first occurrence wins
      const t1 = makeTorrent({ hash: "hhh" })
      const t2 = makeTorrent({ hash: "hhh" })
      const [result] = mergeTorrentLists([[t1], [t2]])
      expect(result.hash).toBe("hhh")
    })
  })

  describe("ratio recalculation", () => {
    it("recalculates ratio as totalUploaded / totalDownloaded when downloaded > 0", () => {
      // t1: uploaded=3MB, downloaded=1MB; t2: uploaded=1MB, downloaded=1MB
      // merged: uploaded=4MB, downloaded=2MB, ratio should be 2.0
      const t1 = makeTorrent({
        hash: "hhh",
        uploaded: 3_000_000,
        downloaded: 1_000_000,
        ratio: 3.0,
      })
      const t2 = makeTorrent({
        hash: "hhh",
        uploaded: 1_000_000,
        downloaded: 1_000_000,
        ratio: 1.0,
      })
      const [result] = mergeTorrentLists([[t1], [t2]])
      expect(result.ratio).toBeCloseTo(4_000_000 / 2_000_000, 10)
    })

    it("falls back to Math.max of ratios when downloaded = 0 on both clients", () => {
      // downloaded=0 on both means we cannot compute a meaningful ratio
      const t1 = makeTorrent({ hash: "hhh", uploaded: 5_000_000, downloaded: 0, ratio: 4.5 })
      const t2 = makeTorrent({ hash: "hhh", uploaded: 2_000_000, downloaded: 0, ratio: 3.2 })
      const [result] = mergeTorrentLists([[t1], [t2]])
      // total downloaded is still 0, so ratio = max(4.5, 3.2) = 4.5
      expect(result.ratio).toBe(4.5)
    })

    it("recalculates ratio correctly when only one client has downloaded > 0", () => {
      // t1 downloaded=0 (e.g. pure cross-seed), t2 downloaded=1MB
      // merged: downloaded=1MB, so ratio is computable
      const t1 = makeTorrent({ hash: "hhh", uploaded: 2_000_000, downloaded: 0, ratio: 99.0 })
      const t2 = makeTorrent({
        hash: "hhh",
        uploaded: 1_000_000,
        downloaded: 1_000_000,
        ratio: 1.0,
      })
      const [result] = mergeTorrentLists([[t1], [t2]])
      // after merge: uploaded=3_000_000, downloaded=1_000_000 -> ratio = 3.0
      expect(result.ratio).toBeCloseTo(3.0, 10)
    })
  })

  describe("single list with no duplicates", () => {
    it("passes through unchanged when given one list with distinct hashes", () => {
      const torrents = [
        makeTorrent({ hash: "a1", uploadSpeed: 100 }),
        makeTorrent({ hash: "a2", uploadSpeed: 200 }),
        makeTorrent({ hash: "a3", uploadSpeed: 300 }),
      ]
      const result = mergeTorrentLists([torrents])
      expect(result).toHaveLength(3)
      for (const t of torrents) {
        const found = result.find((r) => r.hash === t.hash)
        expect(found?.uploadSpeed).toBe(t.uploadSpeed)
      }
    })
  })

  describe("empty inputs", () => {
    it("returns empty array for empty outer list", () => {
      expect(mergeTorrentLists([])).toEqual([])
    })

    it("returns empty array for single empty inner list", () => {
      expect(mergeTorrentLists([[]])).toEqual([])
    })

    it("returns empty array when all inner lists are empty", () => {
      expect(mergeTorrentLists([[], [], []])).toEqual([])
    })

    it("returns torrents from non-empty list when other lists are empty", () => {
      const t = makeTorrent({ hash: "solo" })
      const result = mergeTorrentLists([[], [t], []])
      expect(result).toHaveLength(1)
      expect(result[0].hash).toBe("solo")
    })
  })

  describe("three-way overlap", () => {
    it("sums speeds across all three clients", () => {
      const t1 = makeTorrent({ hash: "tri", uploadSpeed: 100, downloadSpeed: 10 })
      const t2 = makeTorrent({ hash: "tri", uploadSpeed: 200, downloadSpeed: 20 })
      const t3 = makeTorrent({ hash: "tri", uploadSpeed: 300, downloadSpeed: 30 })
      const [result] = mergeTorrentLists([[t1], [t2], [t3]])
      expect(result.uploadSpeed).toBe(600)
      expect(result.downloadSpeed).toBe(60)
    })

    it("sums uploaded and downloaded across all three clients", () => {
      const t1 = makeTorrent({ hash: "tri", uploaded: 1_000_000, downloaded: 500_000 })
      const t2 = makeTorrent({ hash: "tri", uploaded: 2_000_000, downloaded: 1_000_000 })
      const t3 = makeTorrent({ hash: "tri", uploaded: 3_000_000, downloaded: 1_500_000 })
      const [result] = mergeTorrentLists([[t1], [t2], [t3]])
      expect(result.uploaded).toBe(6_000_000)
      expect(result.downloaded).toBe(3_000_000)
    })

    it("takes max seedingTime across all three clients", () => {
      const t1 = makeTorrent({ hash: "tri", seedingTime: 1000 })
      const t2 = makeTorrent({ hash: "tri", seedingTime: 9999 })
      const t3 = makeTorrent({ hash: "tri", seedingTime: 500 })
      const [result] = mergeTorrentLists([[t1], [t2], [t3]])
      expect(result.seedingTime).toBe(9999)
    })

    it("recalculates ratio from three-way summed totals", () => {
      // uploaded sum: 6MB, downloaded sum: 3MB -> ratio = 2.0
      const t1 = makeTorrent({ hash: "tri", uploaded: 1_000_000, downloaded: 500_000, ratio: 2.0 })
      const t2 = makeTorrent({
        hash: "tri",
        uploaded: 2_000_000,
        downloaded: 1_000_000,
        ratio: 2.0,
      })
      const t3 = makeTorrent({
        hash: "tri",
        uploaded: 3_000_000,
        downloaded: 1_500_000,
        ratio: 2.0,
      })
      const [result] = mergeTorrentLists([[t1], [t2], [t3]])
      expect(result.ratio).toBeCloseTo(2.0, 10)
    })
  })
})

// ---------------------------------------------------------------------------
// aggregateCrossSeedTags
// ---------------------------------------------------------------------------

describe("aggregateCrossSeedTags", () => {
  it("returns empty array for empty input", () => {
    expect(aggregateCrossSeedTags([])).toEqual([])
  })

  it("returns tags from a single client unchanged", () => {
    const result = aggregateCrossSeedTags([{ crossSeedTags: ["cross-seed", "fill"] }])
    expect(result).toHaveLength(2)
    expect(result).toContain("cross-seed")
    expect(result).toContain("fill")
  })

  it("deduplicates overlapping tags across multiple clients", () => {
    const result = aggregateCrossSeedTags([
      { crossSeedTags: ["cross-seed", "fill"] },
      { crossSeedTags: ["cross-seed", "other"] },
    ])
    // cross-seed appears in both clients but should only appear once
    const csCount = result.filter((t) => t === "cross-seed").length
    expect(csCount).toBe(1)
    expect(result).toContain("fill")
    expect(result).toContain("other")
  })

  it("returns union of all tags when no overlap", () => {
    const result = aggregateCrossSeedTags([
      { crossSeedTags: ["tag-a", "tag-b"] },
      { crossSeedTags: ["tag-c", "tag-d"] },
    ])
    expect(result).toHaveLength(4)
    expect(result).toContain("tag-a")
    expect(result).toContain("tag-b")
    expect(result).toContain("tag-c")
    expect(result).toContain("tag-d")
  })

  it("handles a client with an empty tag array without including empty strings", () => {
    const result = aggregateCrossSeedTags([
      { crossSeedTags: [] },
      { crossSeedTags: ["cross-seed"] },
    ])
    expect(result).toEqual(["cross-seed"])
  })

  it("handles all clients having empty tag arrays", () => {
    const result = aggregateCrossSeedTags([{ crossSeedTags: [] }, { crossSeedTags: [] }])
    expect(result).toEqual([])
  })
})
