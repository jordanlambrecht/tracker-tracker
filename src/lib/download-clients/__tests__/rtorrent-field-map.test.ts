// src/lib/download-clients/__tests__/rtorrent-field-map.test.ts

import { describe, expect, it } from "vitest"
import { LEECHING_STATES, SEEDING_STATES } from "@/lib/fleet"
import { mapRtorrentState, mapRtorrentTorrent, primaryTrackerHost } from "../rtorrent/field-map"
import type { RtorrentTorrent, RtorrentTracker } from "../rtorrent/types"
import { slimTorrentForCache } from "../transforms"

const NOW = 1_700_100_000
const PASSKEY = "0123456789abcdef"

function tracker(over: Partial<RtorrentTracker>): RtorrentTracker {
  return {
    url: `https://tracker.example.org/${PASSKEY}/announce`,
    group: 0,
    enabled: true,
    scrapeComplete: 40,
    scrapeIncomplete: 2,
    ...over,
  }
}

const RAW: RtorrentTorrent = {
  hash: "ABCDEF0000000000000000000000000000000001",
  name: "Ada.Lovelace.Notes.2026",
  label: "sonarr",
  state: 1,
  isActive: true,
  isOpen: true,
  complete: true,
  hashing: 0,
  upRate: 2048,
  downRate: 0,
  upTotal: 6000,
  downTotal: 4100,
  ratio: 1500,
  sizeBytes: 4000,
  leftBytes: 0,
  completedBytes: 4000,
  peersComplete: 3,
  peersAccounted: 5,
  startedAt: 1_700_000_000,
  finishedAt: 1_700_000_100,
  addTime: "1699999000",
  directory: "/home/alice/files/Ada.Lovelace.Notes.2026",
  basePath: "/home/alice/files/Ada.Lovelace.Notes.2026",
  isMultiFile: true,
  isPrivate: true,
  trackers: [tracker({})],
}

function t(over: Partial<RtorrentTorrent>): RtorrentTorrent {
  return { ...RAW, ...over }
}

describe("mapRtorrentState", () => {
  const cases: [string, Partial<RtorrentTorrent>, string][] = [
    ["first hash check, incomplete", { hashing: 1, complete: false }, "checkingDL"],
    ["rehash, complete", { hashing: 3, complete: true }, "checkingUP"],
    ["stopped, complete", { state: 0, isOpen: false, isActive: false }, "stoppedUP"],
    ["stopped, incomplete", { state: 0, isActive: false, complete: false }, "stoppedDL"],
    ["paused, complete", { state: 1, isOpen: true, isActive: false }, "stoppedUP"],
    ["paused, incomplete", { isActive: false, complete: false }, "stoppedDL"],
    ["seeding with upload", { upRate: 10 }, "uploading"],
    ["seeding idle", { upRate: 0 }, "stalledUP"],
    ["downloading with download", { complete: false, downRate: 10 }, "downloading"],
    ["downloading idle", { complete: false, downRate: 0 }, "stalledDL"],
  ]
  it.each(cases)("%s", (_label, over, expected) => {
    expect(mapRtorrentState(t(over))).toBe(expected)
  })

  it("counts only started torrents as active", () => {
    const isActive = (over: Partial<RtorrentTorrent>) => {
      const s = mapRtorrentState(t(over))
      return SEEDING_STATES.has(s) || LEECHING_STATES.has(s)
    }
    expect(isActive({})).toBe(true)
    expect(isActive({ complete: false, downRate: 0 })).toBe(true)
    expect(isActive({ isActive: false })).toBe(false)
    expect(isActive({ state: 0, isActive: false })).toBe(false)
    expect(isActive({ hashing: 1 })).toBe(false)
  })
})

describe("primaryTrackerHost", () => {
  it("is the host of the lowest enabled group", () => {
    const host = primaryTrackerHost([
      tracker({ group: 0, enabled: false, url: "https://disabled.example.net/announce" }),
      tracker({ group: 2, url: "https://backup.example.org/announce" }),
      tracker({ group: 1 }),
    ])
    expect(host).toBe("tracker.example.org")
    expect(host).not.toContain(PASSKEY)
  })

  it("keeps list order within a group", () => {
    expect(
      primaryTrackerHost([
        tracker({ url: "udp://first.example.org:6969/announce" }),
        tracker({ url: "https://second.example.org/announce" }),
      ])
    ).toBe("first.example.org:6969")
  })

  it("is empty with no enabled tracker", () => {
    expect(primaryTrackerHost([])).toBe("")
    expect(primaryTrackerHost([tracker({ enabled: false })])).toBe("")
  })
})

describe("mapRtorrentTorrent", () => {
  it("tags is empty and hash is lowercase", () => {
    const r = mapRtorrentTorrent(RAW, NOW)
    expect(r.tags).toBe("")
    expect(r.hash).toBe("abcdef0000000000000000000000000000000001")
    expect(r.category).toBe("sonarr")
    expect(r.isPrivate).toBe(true)
  })

  it("decodes labels", () => {
    expect(mapRtorrentTorrent(t({ label: "TV%20Shows" }), NOW).category).toBe("TV Shows")
    expect(mapRtorrentTorrent(t({ label: "caf%C3%A9" }), NOW).category).toBe("café")
    expect(mapRtorrentTorrent(t({ label: "%E0%A4%A" }), NOW).category).toBe("%E0%A4%A")
    expect(mapRtorrentTorrent(t({ label: "" }), NOW).category).toBe("")
  })

  it("ratio per-mille and infinite", () => {
    expect(mapRtorrentTorrent(t({ ratio: 1500 }), NOW).ratio).toBe(1.5)
    expect(mapRtorrentTorrent(t({ ratio: 0, upTotal: 10, completedBytes: 0 }), NOW).ratio).toBe(-1)
    expect(mapRtorrentTorrent(t({ ratio: 0, upTotal: 0, completedBytes: 0 }), NOW).ratio).toBe(0)
  })

  it("zero size gives progress 0", () => {
    const r = mapRtorrentTorrent(t({ sizeBytes: 0, completedBytes: 0, complete: false }), NOW)
    expect(r.progress).toBe(0)
    expect(Number.isNaN(r.progress)).toBe(false)
  })

  it("maps sizes, totals and progress", () => {
    const r = mapRtorrentTorrent(t({ sizeBytes: 4000, completedBytes: 1000, leftBytes: 3000 }), NOW)
    expect(r.size).toBe(4000)
    expect(r.remaining).toBe(3000)
    expect(r.progress).toBe(0.25)
    expect(r.uploaded).toBe(6000)
    expect(r.downloaded).toBe(4100)
  })

  it("uses scrape counts, falling back to connected peers", () => {
    const scraped = mapRtorrentTorrent(
      t({
        trackers: [
          tracker({ scrapeComplete: 40, scrapeIncomplete: 2 }),
          tracker({ scrapeComplete: 55, scrapeIncomplete: 1 }),
          tracker({ enabled: false, scrapeComplete: 999, scrapeIncomplete: 999 }),
        ],
      }),
      NOW
    )
    expect(scraped.swarmSeeders).toBe(55)
    expect(scraped.swarmLeechers).toBe(2)
    expect(scraped.seedCount).toBe(3)
    expect(scraped.leechCount).toBe(2)

    const unscraped = mapRtorrentTorrent(
      t({ trackers: [tracker({ scrapeComplete: 0, scrapeIncomplete: 0 })] }),
      NOW
    )
    expect(unscraped.swarmSeeders).toBe(3)
    expect(unscraped.swarmLeechers).toBe(2)
  })

  it("never counts negative leechers", () => {
    expect(mapRtorrentTorrent(t({ peersComplete: 4, peersAccounted: 2 }), NOW).leechCount).toBe(0)
  })

  it("keeps the passkey out of every field", () => {
    const r = mapRtorrentTorrent(RAW, NOW)
    expect(r.tracker).toBe("tracker.example.org")
    expect(JSON.stringify(r)).not.toContain(PASSKEY)
    expect(JSON.stringify(slimTorrentForCache(r))).not.toContain(PASSKEY)
  })

  it("addedAt prefers ruTorrent addtime", () => {
    expect(mapRtorrentTorrent(RAW, NOW).addedAt).toBe(1_699_999_000)
    expect(mapRtorrentTorrent(t({ addTime: "" }), NOW).addedAt).toBe(1_700_000_000)
    expect(mapRtorrentTorrent(t({ addTime: "soon" }), NOW).addedAt).toBe(1_700_000_000)
  })

  it("maps completion, activity and seeding time", () => {
    const seeding = mapRtorrentTorrent(RAW, NOW)
    expect(seeding.completedAt).toBe(1_700_000_100)
    expect(seeding.lastActivityAt).toBe(NOW)
    expect(seeding.seedingTime).toBe(NOW - 1_700_000_100)
    expect(seeding.activeTime).toBe(0)
    expect(seeding.lastSeenComplete).toBe(0)
    expect(seeding.availability).toBe(-1)

    const idle = mapRtorrentTorrent(t({ upRate: 0, downRate: 0, isActive: false }), NOW)
    expect(idle.lastActivityAt).toBe(0)
    expect(idle.seedingTime).toBe(0)

    const leeching = mapRtorrentTorrent(t({ complete: false, finishedAt: 0 }), NOW)
    expect(leeching.completedAt).toBe(-1)
    expect(leeching.seedingTime).toBe(0)
  })

  it("single-file and multi-file paths", () => {
    const multi = mapRtorrentTorrent(RAW, NOW)
    expect(multi.contentPath).toBe("/home/alice/files/Ada.Lovelace.Notes.2026")
    expect(multi.savePath).toBe("/home/alice/files")

    const single = mapRtorrentTorrent(
      t({
        name: "notes.iso",
        isMultiFile: false,
        directory: "/home/alice/files",
        basePath: "",
      }),
      NOW
    )
    expect(single.contentPath).toBe("/home/alice/files/notes.iso")
    expect(single.savePath).toBe("/home/alice/files")

    const closedMulti = mapRtorrentTorrent(t({ basePath: "" }), NOW)
    expect(closedMulti.contentPath).toBe("/home/alice/files/Ada.Lovelace.Notes.2026")
  })
})
