// src/lib/qbt/__tests__/utils.test.ts

import { describe, expect, it } from "vitest"
import { slimTorrentForCache } from "../utils"

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
  seeding_time: 86400,
  time_active: 90000,
  added_on: 1700000000,
  completion_on: 1700003600,
  last_activity: 1700090000,
  amount_left: 0,
  num_seeds: 10,
  num_leechs: 2,
  num_complete: 50,
  num_incomplete: 5,
  upspeed: 102400,
  dlspeed: 0,
  availability: 1.0,
  progress: 1.0,
  tracker: "https://tracker.example.com/announce?passkey=secret",
  content_path: "/data/movies/test",
  save_path: "/data/movies",
  magnet_uri: "magnet:?xt=urn:btih:abc123&dn=Test",
  comment: "Uploaded by user123",
  root_path: "/data/movies/test",
  download_path: "",
  infohash_v1: "abc123",
  infohash_v2: "",
  f_l_piece_prio: false,
  force_start: false,
  has_metadata: true,
  inactive_seeding_time_limit: -1,
  max_inactive_seeding_time: -1,
  max_ratio: -1,
  max_seeding_time: -1,
  popularity: 0,
  priority: 0,
  private: true,
  ratio_limit: -2,
  reannounce: 0,
  seq_dl: false,
  super_seeding: false,
  auto_tmm: false,
  completed: 524288000,
  dl_limit: -1,
  downloaded_session: 0,
  seen_complete: 1700003600,
  up_limit: -1,
  uploaded_session: 0,
  total_size: 524288000,
  trackers_count: 1,
  eta: 8640000,
}

describe("slimTorrentForCache", () => {
  it("retains exactly 23 fields", () => {
    const slim = slimTorrentForCache(FULL_TORRENT)
    expect(Object.keys(slim)).toHaveLength(23)
  })

  it("retains only the expected fields in sorted order", () => {
    const slim = slimTorrentForCache(FULL_TORRENT)
    expect(Object.keys(slim).sort()).toEqual([
      "added_on",
      "amount_left",
      "availability",
      "category",
      "completion_on",
      "dlspeed",
      "downloaded",
      "hash",
      "last_activity",
      "name",
      "num_complete",
      "num_incomplete",
      "num_leechs",
      "num_seeds",
      "progress",
      "ratio",
      "seeding_time",
      "size",
      "state",
      "tags",
      "time_active",
      "uploaded",
      "upspeed",
    ])
  })

  it("preserves field values exactly", () => {
    const slim = slimTorrentForCache(FULL_TORRENT)
    expect(slim.hash).toBe("abc123")
    expect(slim.uploaded).toBe(1048576000)
    expect(slim.ratio).toBe(2.0)
    expect(slim.seeding_time).toBe(86400)
    expect(slim.tags).toBe("aither, blutopia")
  })

  it("excludes sensitive fields", () => {
    const slim = slimTorrentForCache(FULL_TORRENT) as Record<string, unknown>
    expect(slim.tracker).toBeUndefined()
    expect(slim.content_path).toBeUndefined()
    expect(slim.save_path).toBeUndefined()
    expect(slim.magnet_uri).toBeUndefined()
    expect(slim.root_path).toBeUndefined()
  })

  it("excludes unused qBT config fields", () => {
    const slim = slimTorrentForCache(FULL_TORRENT) as Record<string, unknown>
    expect(slim.private).toBeUndefined()
    expect(slim.infohash_v1).toBeUndefined()
    expect(slim.downloaded_session).toBeUndefined()
    expect(slim.uploaded_session).toBeUndefined()
    expect(slim.auto_tmm).toBeUndefined()
    expect(slim.eta).toBeUndefined()
    expect(slim.total_size).toBeUndefined()
  })
})
