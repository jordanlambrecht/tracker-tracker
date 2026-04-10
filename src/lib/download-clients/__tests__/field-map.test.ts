// src/lib/download-clients/__tests__/field-map.test.ts

import { describe, expect, it } from "vitest"
import { mapQbtDelta, mapQbtTorrent } from "../field-map"

describe("mapQbtTorrent", () => {
  const RAW = {
    hash: "abc",
    name: "Test",
    state: "uploading",
    tags: "aither",
    category: "movies",
    upspeed: 1024,
    dlspeed: 512,
    uploaded: 5000,
    downloaded: 2500,
    ratio: 2.0,
    size: 1_000_000,
    num_seeds: 10,
    num_leechs: 3,
    num_complete: 50,
    num_incomplete: 5,
    tracker: "https://tracker.example.com/announce",
    added_on: 1700000000,
    completion_on: 1700001000,
    last_activity: 1700002000,
    seeding_time: 86400,
    time_active: 90000,
    seen_complete: 1700001500,
    availability: 1.0,
    amount_left: 0,
    progress: 1.0,
    content_path: "/data/movies/test",
    save_path: "/data/movies",
    is_private: true,
  }

  it("maps all snake_case fields to camelCase", () => {
    const result = mapQbtTorrent(RAW)
    expect(result.uploadSpeed).toBe(1024)
    expect(result.downloadSpeed).toBe(512)
    expect(result.seedCount).toBe(10)
    expect(result.leechCount).toBe(3)
    expect(result.swarmSeeders).toBe(50)
    expect(result.swarmLeechers).toBe(5)
    expect(result.addedAt).toBe(1700000000)
    expect(result.completedAt).toBe(1700001000)
    expect(result.lastActivityAt).toBe(1700002000)
    expect(result.seedingTime).toBe(86400)
    expect(result.activeTime).toBe(90000)
    expect(result.lastSeenComplete).toBe(1700001500)
    expect(result.remaining).toBe(0)
    expect(result.contentPath).toBe("/data/movies/test")
    expect(result.savePath).toBe("/data/movies")
    expect(result.isPrivate).toBe(true)
  })

  it("preserves fields that need no mapping", () => {
    const result = mapQbtTorrent(RAW)
    expect(result.hash).toBe("abc")
    expect(result.name).toBe("Test")
    expect(result.state).toBe("uploading")
    expect(result.tags).toBe("aither")
    expect(result.ratio).toBe(2.0)
    expect(result.size).toBe(1_000_000)
  })

  it("does not include old field names in output", () => {
    const result = mapQbtTorrent(RAW) as unknown as Record<string, unknown>
    expect(result).not.toHaveProperty("upspeed")
    expect(result).not.toHaveProperty("dlspeed")
    expect(result).not.toHaveProperty("num_seeds")
    expect(result).not.toHaveProperty("added_on")
    expect(result).not.toHaveProperty("content_path")
  })
})

describe("mapQbtDelta", () => {
  it("maps partial torrent updates", () => {
    const delta = { upspeed: 2048, num_seeds: 15 }
    const result = mapQbtDelta(delta)
    expect(result).toEqual({ uploadSpeed: 2048, seedCount: 15 })
    expect(result).not.toHaveProperty("upspeed")
  })

  it("passes through fields that need no mapping", () => {
    const delta = { ratio: 3.5, progress: 0.5 }
    const result = mapQbtDelta(delta)
    expect(result).toEqual({ ratio: 3.5, progress: 0.5 })
  })

  it("handles empty delta", () => {
    const result = mapQbtDelta({})
    expect(result).toEqual({})
  })
})
