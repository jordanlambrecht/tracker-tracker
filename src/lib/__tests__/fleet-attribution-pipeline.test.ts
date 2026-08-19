// src/lib/__tests__/fleet-attribution-pipeline.test.ts
//
// Pipeline-level regression tests for announce-URL attribution (issue #152).
//
// WHY THIS FILE EXISTS, AND WHY IT MUST NOT BE "SIMPLIFIED":
// fleet-aggregation.test.ts builds TorrentRaw object literals by hand with `tracker`
// already set. That shape is one the real pipeline never produced. slimTorrentForCache
// omitted `tracker` entirely, so every torrent arriving at computeFleetAggregation had
// tracker === undefined and the announce fallback was dead code in production while the
// unit tests passed. The bug shipped twice (eb4f0ac, 0c4f694) behind a green suite.
//
// So these tests run a real TorrentRecord through the ACTUAL cache pipeline:
// slimTorrentForCache -> mergeTorrentLists -> stampClientNames -> computeFleetAggregation.
// This is the same sequence coordinator.ts:203-241 performs. If anyone drops the field from
// slimTorrentForCache again, these fail. Do not replace the pipeline calls with a literal.

import { describe, expect, it } from "vitest"
import { mergeTorrentLists, stampClientNames } from "@/lib/download-clients/merge"
import { slimTorrentForCache } from "@/lib/download-clients/transforms"
import type { TorrentRecord } from "@/lib/download-clients/types"
import type { TorrentRaw, TrackerTag } from "@/lib/fleet"
import { computeFleetAggregation } from "@/lib/fleet-aggregation"
import { trackerHostKey } from "@/lib/tracker-matching"

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE_SEC = 1718409600 // 2024-06-15T00:00:00Z

/** A passkey distinctive enough that any leak into the cached payload is unambiguous. */
const PASSKEY = "e7f3a9c1b5d24680deadbeefcafe1234"

const LST_ANNOUNCE = `https://tracker.lst.gg/${PASSKEY}/announce`
const AITHER_ANNOUNCE = `https://aither.cc/announce/${PASSKEY}`

/** Full TorrentRecord, i.e. what a qBittorrent adapter actually hands the sync store. */
function makeTorrentRecord(overrides: Partial<TorrentRecord> & { hash: string }): TorrentRecord {
  return {
    hash: overrides.hash,
    name: overrides.name ?? `Torrent-${overrides.hash}`,
    state: overrides.state ?? "uploading",
    tags: overrides.tags ?? "",
    category: overrides.category ?? "movies",
    uploadSpeed: overrides.uploadSpeed ?? 102_400,
    downloadSpeed: overrides.downloadSpeed ?? 0,
    uploaded: overrides.uploaded ?? 1_000_000,
    downloaded: overrides.downloaded ?? 500_000,
    ratio: overrides.ratio ?? 2.0,
    size: overrides.size ?? 5_000_000_000,
    seedCount: overrides.seedCount ?? 10,
    leechCount: overrides.leechCount ?? 2,
    swarmSeeders: overrides.swarmSeeders ?? 50,
    swarmLeechers: overrides.swarmLeechers ?? 5,
    tracker: overrides.tracker ?? LST_ANNOUNCE,
    addedAt: overrides.addedAt ?? BASE_SEC - 86_400 * 15,
    completedAt: overrides.completedAt ?? BASE_SEC - 86_400 * 14,
    lastActivityAt: overrides.lastActivityAt ?? BASE_SEC - 3_600,
    seedingTime: overrides.seedingTime ?? 86_400,
    activeTime: overrides.activeTime ?? 90_000,
    lastSeenComplete: overrides.lastSeenComplete ?? BASE_SEC - 3_600,
    availability: overrides.availability ?? 1.0,
    remaining: overrides.remaining ?? 0,
    progress: overrides.progress ?? 1.0,
    contentPath: overrides.contentPath ?? "/data/movies/test",
    savePath: overrides.savePath ?? "/data/movies",
  }
}

/**
 * Tracker metadata exactly as coordinator.ts:168-179 builds it: a tagged tracker keys
 * on its qBittorrent tag, an untagged one keys on its announce host.
 */
const TRACKERS: TrackerTag[] = [
  { tag: "aither", name: "Aither", color: "#01d4ff", baseUrl: "https://aither.cc" },
  {
    tag: trackerHostKey("https://lst.gg") as string,
    name: "LST",
    color: "#3b82f6",
    baseUrl: "https://lst.gg",
  },
]

const CROSS_SEED_TAGS = ["cross-seed"]

/**
 * The real cache round trip: slim each record the way the scheduler and the warm-store
 * read both do, merge across clients by hash, stamp client names, aggregate.
 */
function aggregateThroughPipeline(clients: { clientName: string; torrents: TorrentRecord[] }[]) {
  const slimmed = clients.map((c) => ({
    clientName: c.clientName,
    torrents: c.torrents.map(slimTorrentForCache),
  }))
  const merged = mergeTorrentLists(slimmed.map((c) => c.torrents))
  const stamped = stampClientNames(slimmed, merged)
  // Deliberately uncast: this assignment is itself a compile-time guard that what the
  // cache pipeline emits still satisfies TorrentRaw. A cast here would hide a drift.
  const forAggregation: TorrentRaw[] = stamped
  return computeFleetAggregation(forAggregation, TRACKERS, CROSS_SEED_TAGS)
}

// ---------------------------------------------------------------------------
// Attribution
// ---------------------------------------------------------------------------

describe("fleet attribution through the real cache pipeline (issue #152)", () => {
  it("carries an announce host through slimTorrentForCache at all", () => {
    // The load-bearing assertion. This is the exact link that was missing: the
    // pipeline used to drop `tracker`, so everything downstream silently no-opped.
    const slim = slimTorrentForCache(makeTorrentRecord({ hash: "p0" }))
    expect(slim.tracker).toBe("lst.gg")
  })

  it("attributes an untagged torrent to its tracker by announce host", () => {
    const result = aggregateThroughPipeline([
      { clientName: "qbt-1", torrents: [makeTorrentRecord({ hash: "p1", tags: "" })] },
    ])

    expect(result.trackerHealth.find((t) => t.name === "LST")?.torrentCount).toBe(1)
  })

  it("attributes a cross-seed-only tagged torrent by announce host", () => {
    // The reporter's actual setup: a cross-seed label, no per-tracker labels.
    const result = aggregateThroughPipeline([
      { clientName: "qbt-1", torrents: [makeTorrentRecord({ hash: "p2", tags: "cross-seed" })] },
    ])

    expect(result.trackerHealth.find((t) => t.name === "LST")?.torrentCount).toBe(1)
  })

  it("still lets an explicit qBittorrent tag win over the announce host", () => {
    const result = aggregateThroughPipeline([
      {
        clientName: "qbt-1",
        // Tagged aither, but announcing to lst.gg. The user's tag is the explicit decision.
        torrents: [makeTorrentRecord({ hash: "p3", tags: "aither", tracker: LST_ANNOUNCE })],
      },
    ])

    expect(result.trackerHealth.find((t) => t.name === "Aither")?.torrentCount).toBe(1)
    expect(result.trackerHealth.find((t) => t.name === "LST")?.torrentCount ?? 0).toBe(0)
  })

  it("leaves a torrent from an unknown site unattributed", () => {
    const result = aggregateThroughPipeline([
      {
        clientName: "qbt-1",
        torrents: [
          makeTorrentRecord({
            hash: "p4",
            tags: "",
            tracker: "https://tracker.unknown.test/announce",
          }),
        ],
      },
    ])

    for (const t of result.trackerHealth) expect(t.torrentCount).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Totals
// ---------------------------------------------------------------------------

describe("fleet totals stay consistent with per-tracker attribution", () => {
  it("counts an announce-matched torrent once, not once per path", () => {
    const result = aggregateThroughPipeline([
      {
        clientName: "qbt-1",
        torrents: [
          makeTorrentRecord({ hash: "n1", tags: "", tracker: LST_ANNOUNCE }),
          makeTorrentRecord({ hash: "n2", tags: "cross-seed", tracker: LST_ANNOUNCE }),
          makeTorrentRecord({ hash: "n3", tags: "aither", tracker: AITHER_ANNOUNCE }),
        ],
      },
    ])

    expect(result.stats.torrentCount).toBe(3)
    expect(result.trackerHealth.find((t) => t.name === "LST")?.torrentCount).toBe(2)
    expect(result.trackerHealth.find((t) => t.name === "Aither")?.torrentCount).toBe(1)

    // This is the invariant the bug violated: torrents were admitted to the fleet
    // totals but credited to no tracker, so the two sides stopped adding up.
    const attributed = result.trackerHealth.reduce((sum, t) => sum + t.torrentCount, 0)
    expect(attributed).toBe(result.stats.torrentCount)
  })

  it("does not double-count the same hash seeded from two clients", () => {
    const result = aggregateThroughPipeline([
      { clientName: "qbt-1", torrents: [makeTorrentRecord({ hash: "dup", tags: "" })] },
      { clientName: "qbt-2", torrents: [makeTorrentRecord({ hash: "dup", tags: "" })] },
    ])

    expect(result.stats.torrentCount).toBe(1)
    expect(result.trackerHealth.find((t) => t.name === "LST")?.torrentCount).toBe(1)
  })

  it("sums library size once per unique torrent, not once per client", () => {
    const result = aggregateThroughPipeline([
      { clientName: "qbt-1", torrents: [makeTorrentRecord({ hash: "dup", size: 5_000_000_000 })] },
      { clientName: "qbt-2", torrents: [makeTorrentRecord({ hash: "dup", size: 5_000_000_000 })] },
    ])

    expect(result.stats.totalLibrarySize).toBe(5_000_000_000)
  })
})

// ---------------------------------------------------------------------------
// Passkey safety
// ---------------------------------------------------------------------------

describe("the cached payload never carries an announce passkey", () => {
  it("stores no substring of a passkey held in the announce path", () => {
    const slim = slimTorrentForCache(makeTorrentRecord({ hash: "s1", tracker: LST_ANNOUNCE }))
    const serialized = JSON.stringify(slim)

    expect(serialized).not.toContain(PASSKEY)
    expect(serialized).toContain("lst.gg")
  })

  it.each([
    ["path", `https://tracker.lst.gg/${PASSKEY}/announce`],
    ["query string", `https://tracker.lst.gg/announce?passkey=${PASSKEY}`],
    ["userinfo", `https://${PASSKEY}:x@tracker.lst.gg/announce`],
    ["subdomain", `https://${PASSKEY}.tracker.lst.gg/announce`],
    ["udp scheme with port", `udp://tracker.lst.gg:2810/${PASSKEY}/announce`],
  ])("drops a passkey carried in the %s", (_position, announce) => {
    const slim = slimTorrentForCache(makeTorrentRecord({ hash: "s2", tracker: announce }))
    const serialized = JSON.stringify(slim)

    expect(serialized).not.toContain(PASSKEY)
    expect(slim.tracker).toBe("lst.gg")
  })

  it("keeps the whole cached payload free of the raw announce URL", () => {
    // Guards the write shape end to end: what the scheduler hands the jsonb column
    // is this array, and nothing in it may resemble the announce URL.
    const cached = [makeTorrentRecord({ hash: "s3" }), makeTorrentRecord({ hash: "s4" })].map(
      slimTorrentForCache
    )
    const serialized = JSON.stringify(cached)

    expect(serialized).not.toContain(PASSKEY)
    expect(serialized).not.toContain("/announce")
    expect(serialized).not.toContain("https://")
  })
})
