// src/lib/__tests__/qbt-type-guards.test.ts

import { describe, expect, it } from "vitest"
import { parseCachedTorrents } from "@/lib/download-clients/qbt/transport"
import type { QbtTorrent } from "@/lib/download-clients/qbt/types"
import { isQbtTorrent } from "@/lib/download-clients/qbt/types"

// ─── Minimal valid torrent fixture ───────────────────────────────────────────

function makeTorrent(overrides: Partial<QbtTorrent> = {}): QbtTorrent {
  return {
    hash: "abc123def456",
    name: "Some.Torrent.Name",
    state: "uploading",
    tags: "aither",
    category: "movies",
    upspeed: 1024,
    dlspeed: 0,
    uploaded: 5000000,
    downloaded: 1000000,
    ratio: 5.0,
    size: 1000000,
    num_seeds: 3,
    num_leechs: 0,
    num_complete: 10,
    num_incomplete: 2,
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
    content_path: "/data/torrent",
    save_path: "/data",
    ...overrides,
  }
}

// ─── isQbtTorrent ─────────────────────────────────────────────────────────────

describe("isQbtTorrent", () => {
  // ── null / non-object primitives ─────────────────────────────────────────

  it("returns false for null", () => {
    expect(isQbtTorrent(null)).toBe(false)
  })

  it("returns false for undefined", () => {
    expect(isQbtTorrent(undefined)).toBe(false)
  })

  it("returns false for a string", () => {
    expect(isQbtTorrent("not a torrent")).toBe(false)
  })

  it("returns false for a number", () => {
    expect(isQbtTorrent(42)).toBe(false)
  })

  it("returns false for an empty object", () => {
    expect(isQbtTorrent({})).toBe(false)
  })

  it("returns false for an array", () => {
    expect(isQbtTorrent([])).toBe(false)
  })

  // ── valid shape ───────────────────────────────────────────────────────────

  it("returns true for a valid QbtTorrent", () => {
    expect(isQbtTorrent(makeTorrent())).toBe(true)
  })

  it("returns true when optional is_private field is absent", () => {
    const t = makeTorrent()
    delete (t as Partial<QbtTorrent>).is_private
    expect(isQbtTorrent(t)).toBe(true)
  })

  it("returns true when ratio is 0", () => {
    expect(isQbtTorrent(makeTorrent({ ratio: 0 }))).toBe(true)
  })

  it("returns true when size is 0", () => {
    expect(isQbtTorrent(makeTorrent({ size: 0 }))).toBe(true)
  })

  // ── missing required string fields ───────────────────────────────────────

  it("returns false when hash is missing", () => {
    const t = { ...makeTorrent() }
    delete (t as Partial<QbtTorrent>).hash
    expect(isQbtTorrent(t)).toBe(false)
  })

  it("returns false when name is missing", () => {
    const t = { ...makeTorrent() }
    delete (t as Partial<QbtTorrent>).name
    expect(isQbtTorrent(t)).toBe(false)
  })

  it("returns false when state is missing", () => {
    const t = { ...makeTorrent() }
    delete (t as Partial<QbtTorrent>).state
    expect(isQbtTorrent(t)).toBe(false)
  })

  // ── missing required number fields ───────────────────────────────────────

  it("returns false when size is missing", () => {
    const t = { ...makeTorrent() }
    delete (t as Partial<QbtTorrent>).size
    expect(isQbtTorrent(t)).toBe(false)
  })

  it("returns false when ratio is missing", () => {
    const t = { ...makeTorrent() }
    delete (t as Partial<QbtTorrent>).ratio
    expect(isQbtTorrent(t)).toBe(false)
  })

  // ── wrong types on required fields ───────────────────────────────────────

  it("returns false when hash is a number, not a string", () => {
    expect(isQbtTorrent({ ...makeTorrent(), hash: 12345 })).toBe(false)
  })

  it("returns false when name is null", () => {
    expect(isQbtTorrent({ ...makeTorrent(), name: null })).toBe(false)
  })

  it("returns false when state is a boolean", () => {
    expect(isQbtTorrent({ ...makeTorrent(), state: true })).toBe(false)
  })

  it("returns false when ratio is a string, not a number", () => {
    expect(isQbtTorrent({ ...makeTorrent(), ratio: "5.0" })).toBe(false)
  })

  it("returns false when size is a string, not a number", () => {
    expect(isQbtTorrent({ ...makeTorrent(), size: "1000000" })).toBe(false)
  })
})

// ─── parseCachedTorrents ──────────────────────────────────────────────────────

describe("parseCachedTorrents", () => {
  // ── falsy / non-parseable inputs ─────────────────────────────────────────

  it("returns empty array for null", () => {
    expect(parseCachedTorrents(null)).toEqual([])
  })

  it("returns empty array for undefined", () => {
    expect(parseCachedTorrents(undefined)).toEqual([])
  })

  it("returns empty array for false", () => {
    expect(parseCachedTorrents(false)).toEqual([])
  })

  it("returns empty array for 0", () => {
    expect(parseCachedTorrents(0)).toEqual([])
  })

  it("returns empty array for an empty string", () => {
    expect(parseCachedTorrents("")).toEqual([])
  })

  it("returns empty array for a non-array object", () => {
    expect(parseCachedTorrents({ hash: "abc" })).toEqual([])
  })

  it("returns empty array for a number", () => {
    expect(parseCachedTorrents(42)).toEqual([])
  })

  // ── JSON string input ────────────────────────────────────────────────────

  it("parses a JSON string containing a valid torrent array", () => {
    const torrent = makeTorrent()
    const result = parseCachedTorrents(JSON.stringify([torrent]))
    expect(result).toHaveLength(1)
    expect(result[0].hash).toBe(torrent.hash)
  })

  it("parses a JSON string containing multiple valid torrents", () => {
    const t1 = makeTorrent({ hash: "aaa" })
    const t2 = makeTorrent({ hash: "bbb" })
    const result = parseCachedTorrents(JSON.stringify([t1, t2]))
    expect(result).toHaveLength(2)
  })

  it("returns empty array for invalid JSON string", () => {
    expect(parseCachedTorrents("{not valid json")).toEqual([])
  })

  it("returns empty array for a JSON string that parses to a non-array (object)", () => {
    expect(parseCachedTorrents(JSON.stringify({ hash: "abc" }))).toEqual([])
  })

  it("returns empty array for a JSON string that parses to a non-array (number)", () => {
    expect(parseCachedTorrents("42")).toEqual([])
  })

  it("returns empty array for a JSON string whose first element fails isQbtTorrent", () => {
    const invalid = [{ notAHash: true }]
    expect(parseCachedTorrents(JSON.stringify(invalid))).toEqual([])
  })

  it("returns empty array for a JSON string array with valid-looking data but missing ratio", () => {
    const broken = [{ hash: "abc", name: "test", state: "uploading", size: 1000 }]
    expect(parseCachedTorrents(JSON.stringify(broken))).toEqual([])
  })

  // ── array input (JSONB already parsed by the DB driver) ───────────────────

  it("returns the array when passed a pre-parsed array of valid torrents", () => {
    const torrent = makeTorrent()
    const result = parseCachedTorrents([torrent])
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe(torrent.name)
  })

  it("returns the array when passed a pre-parsed array with multiple valid torrents", () => {
    const torrents = [makeTorrent({ hash: "aaa" }), makeTorrent({ hash: "bbb" })]
    expect(parseCachedTorrents(torrents)).toHaveLength(2)
  })

  it("returns empty array when the pre-parsed array's first element is invalid", () => {
    const invalid = [{ notAHash: true }]
    expect(parseCachedTorrents(invalid)).toEqual([])
  })

  // ── empty array ───────────────────────────────────────────────────────────

  it("returns an empty array for an empty pre-parsed array", () => {
    expect(parseCachedTorrents([])).toEqual([])
  })

  it("returns an empty array for an empty JSON string array '[]'", () => {
    expect(parseCachedTorrents("[]")).toEqual([])
  })
})
