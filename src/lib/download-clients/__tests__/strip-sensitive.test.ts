// src/lib/download-clients/__tests__/strip-sensitive.test.ts

import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { stripSensitiveTorrentFields } from "../fetch"

const baseTorrent = {
  hash: "abc123",
  name: "Test.Torrent",
  state: "uploading",
  tags: "aither",
  category: "tv",
  uploadSpeed: 1024,
  downloadSpeed: 0,
  uploaded: 5000000,
  downloaded: 3000000,
  ratio: 1.67,
  size: 3000000,
  seedCount: 10,
  leechCount: 2,
  swarmSeeders: 15,
  swarmLeechers: 3,
  tracker: "https://aither.cc/announce/abc123secretpasskey",
  addedAt: 1700000000,
  completedAt: 1700001000,
  lastActivityAt: 1700002000,
  seedingTime: 86400,
  activeTime: 90000,
  lastSeenComplete: 1700002000,
  availability: 1,
  remaining: 0,
  progress: 1,
  contentPath: "/data/media/tv/Test.Torrent",
  savePath: "/data/media/tv",
}

describe("stripSensitiveTorrentFields", () => {
  it("removes tracker field (may contain passkeys)", () => {
    const result = stripSensitiveTorrentFields(baseTorrent)
    expect(result).not.toHaveProperty("tracker")
    expect(JSON.stringify(result)).not.toContain("secretpasskey")
  })

  it("removes contentPath field (exposes server filesystem)", () => {
    const result = stripSensitiveTorrentFields(baseTorrent)
    expect(result).not.toHaveProperty("contentPath")
  })

  it("removes savePath field (exposes server filesystem)", () => {
    const result = stripSensitiveTorrentFields(baseTorrent)
    expect(result).not.toHaveProperty("savePath")
  })

  it("preserves all non-sensitive fields", () => {
    const result = stripSensitiveTorrentFields(baseTorrent)
    expect(result.hash).toBe("abc123")
    expect(result.name).toBe("Test.Torrent")
    expect(result.state).toBe("uploading")
    expect(result.tags).toBe("aither")
    expect(result.uploadSpeed).toBe(1024)
    expect(result.ratio).toBe(1.67)
    expect(result.seedCount).toBe(10)
    expect(result.addedAt).toBe(1700000000)
  })

  it("does not mutate the original object", () => {
    const original = { ...baseTorrent }
    stripSensitiveTorrentFields(original)
    expect(original).toHaveProperty("tracker")
    expect(original).toHaveProperty("contentPath")
    expect(original).toHaveProperty("savePath")
  })
})
