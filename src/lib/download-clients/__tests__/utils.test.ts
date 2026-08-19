// src/lib/download-clients/__tests__/utils.test.ts

import { describe, expect, it } from "vitest"
import { slimTorrentForCache } from "../transforms"

const FULL_TORRENT = {
  hash: "abc123",
  name: "Test Torrent",
  state: "uploading",
  tags: "aither, blutopia",
  category: "movies",
  uploaded: 1048576000,
  downloaded: 524288000,
  ratio: 2.0,
  size: 524288000,
  seedingTime: 86400,
  activeTime: 90000,
  addedAt: 1700000000,
  completedAt: 1700003600,
  lastActivityAt: 1700090000,
  remaining: 0,
  seedCount: 10,
  leechCount: 2,
  swarmSeeders: 50,
  swarmLeechers: 5,
  uploadSpeed: 102400,
  downloadSpeed: 0,
  availability: 1.0,
  progress: 1.0,
  tracker: "https://tracker.example.com/announce?passkey=secret",
  contentPath: "/data/movies/test",
  savePath: "/data/movies",
  lastSeenComplete: 1700003600,
  isPrivate: true,
}

describe("slimTorrentForCache", () => {
  it("retains exactly 24 fields", () => {
    const slim = slimTorrentForCache(FULL_TORRENT)
    expect(Object.keys(slim)).toHaveLength(24)
  })

  it("retains only the expected fields in sorted order", () => {
    const slim = slimTorrentForCache(FULL_TORRENT)
    expect(Object.keys(slim).sort()).toEqual([
      "activeTime",
      "addedAt",
      "availability",
      "category",
      "completedAt",
      "downloadSpeed",
      "downloaded",
      "hash",
      "lastActivityAt",
      "leechCount",
      "name",
      "progress",
      "ratio",
      "remaining",
      "seedCount",
      "seedingTime",
      "size",
      "state",
      "swarmLeechers",
      "swarmSeeders",
      "tags",
      "tracker",
      "uploadSpeed",
      "uploaded",
    ])
  })

  it("preserves field values exactly", () => {
    const slim = slimTorrentForCache(FULL_TORRENT)
    expect(slim.hash).toBe("abc123")
    expect(slim.uploaded).toBe(1048576000)
    expect(slim.ratio).toBe(2.0)
    expect(slim.seedingTime).toBe(86400)
    expect(slim.tags).toBe("aither, blutopia")
  })

  it("excludes filesystem path fields", () => {
    const slim = slimTorrentForCache(FULL_TORRENT) as Record<string, unknown>
    expect(slim.contentPath).toBeUndefined()
    expect(slim.savePath).toBeUndefined()
  })

  // cachedTorrents is a plaintext jsonb column, so the announce URL is reduced to
  // its registrable host before it is stored. Attribution only needs the host, and
  // the reduction drops the passkey along with the rest of the URL.
  it("reduces the announce URL to its registrable host", () => {
    const slim = slimTorrentForCache(FULL_TORRENT)
    expect(slim.tracker).toBe("example.com")
  })

  it("stores nothing resembling the announce passkey", () => {
    const serialized = JSON.stringify(slimTorrentForCache(FULL_TORRENT))
    expect(serialized).not.toContain("passkey")
    expect(serialized).not.toContain("secret")
    expect(serialized).not.toContain("/announce")
  })

  it("omits the field entirely when the announce URL is unusable", () => {
    const slim = slimTorrentForCache({ ...FULL_TORRENT, tracker: "" })
    expect(slim.tracker).toBeUndefined()
    // undefined is dropped by JSON.stringify, so nothing is written to the column.
    expect(JSON.parse(JSON.stringify(slim))).not.toHaveProperty("tracker")
  })

  it("excludes unused qBT config fields", () => {
    const slim = slimTorrentForCache(FULL_TORRENT) as Record<string, unknown>
    expect(slim.isPrivate).toBeUndefined()
    expect(slim.lastSeenComplete).toBeUndefined()
  })
})
