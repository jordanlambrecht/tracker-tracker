// src/lib/qbt/__tests__/client-parse.test.ts

import { describe, expect, it, vi } from "vitest"
import { parseCachedTorrents } from "@/lib/qbt"

// Silence the warn calls that parseCachedTorrents makes on failure paths
vi.mock("@/lib/logger", () => ({
  log: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// ---------------------------------------------------------------------------
// Minimal valid QbtTorrent fixture
// isQbtTorrent checks: hash (string), name (string), state (string), size (number), ratio (number)
// ---------------------------------------------------------------------------

const VALID_TORRENT = {
  hash: "abc123def456",
  name: "Test.Torrent.2024",
  state: "uploading",
  size: 5_000_000_000,
  ratio: 2.0,
  // Additional fields that the real API returns (not checked by isQbtTorrent)
  tags: "aither",
  category: "movies",
  upspeed: 1024,
  dlspeed: 0,
  uploaded: 2_000_000_000,
  downloaded: 1_000_000_000,
  num_seeds: 10,
  num_leechs: 2,
  num_complete: 50,
  num_incomplete: 5,
  added_on: 1700000000,
  completion_on: 1700003600,
  last_activity: 1700090000,
  seeding_time: 86400,
  time_active: 90000,
  seen_complete: 1700003600,
  availability: 1.0,
  amount_left: 0,
  progress: 1.0,
  tracker: "https://tracker.example.com/announce",
  content_path: "/data/movies/test",
  save_path: "/data/movies",
}

const VALID_TORRENT_2 = {
  ...VALID_TORRENT,
  hash: "def456abc123",
  name: "Another.Torrent.2024",
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("parseCachedTorrents", () => {
  describe("falsy inputs", () => {
    it("returns [] for null input", () => {
      expect(parseCachedTorrents(null)).toEqual([])
    })

    it("returns [] for undefined input", () => {
      expect(parseCachedTorrents(undefined)).toEqual([])
    })

    it("returns [] for false input", () => {
      expect(parseCachedTorrents(false)).toEqual([])
    })

    it("returns [] for empty string", () => {
      // empty string is falsy, caught by the !raw guard
      expect(parseCachedTorrents("")).toEqual([])
    })
  })

  describe("empty array", () => {
    it("returns [] for a pre-parsed empty array", () => {
      expect(parseCachedTorrents([])).toEqual([])
    })

    it("returns [] for a JSON string of an empty array", () => {
      expect(parseCachedTorrents("[]")).toEqual([])
    })
  })

  describe("valid pre-parsed array", () => {
    it("returns the array when given a valid pre-parsed array with one torrent", () => {
      const result = parseCachedTorrents([VALID_TORRENT])
      expect(result).toHaveLength(1)
      expect(result[0].hash).toBe("abc123def456")
    })

    it("returns all elements when the first element passes isQbtTorrent", () => {
      // Only the first element is validated; the rest pass through
      const result = parseCachedTorrents([VALID_TORRENT, VALID_TORRENT_2])
      expect(result).toHaveLength(2)
    })
  })

  describe("valid JSON string", () => {
    it("parses a JSON string containing a valid torrent array", () => {
      const json = JSON.stringify([VALID_TORRENT])
      const result = parseCachedTorrents(json)
      expect(result).toHaveLength(1)
      expect(result[0].hash).toBe("abc123def456")
    })

    it("returns all elements when JSON string contains multiple torrents", () => {
      const json = JSON.stringify([VALID_TORRENT, VALID_TORRENT_2])
      const result = parseCachedTorrents(json)
      expect(result).toHaveLength(2)
    })
  })

  describe("invalid JSON string", () => {
    it("returns [] for a JSON string of a non-array object (object root)", () => {
      const json = JSON.stringify({ hash: "abc", name: "x", state: "uploading" })
      expect(parseCachedTorrents(json)).toEqual([])
    })

    it("returns [] for malformed JSON string", () => {
      expect(parseCachedTorrents("{not valid json}")).toEqual([])
    })

    it("returns [] for a JSON string of a plain number", () => {
      expect(parseCachedTorrents("42")).toEqual([])
    })

    it("returns [] for a JSON string of null", () => {
      // JSON.parse("null") = null, which is not an array
      expect(parseCachedTorrents("null")).toEqual([])
    })
  })

  describe("isQbtTorrent validation failure", () => {
    it("returns [] when first element is missing hash field", () => {
      const bad = { name: "Test", state: "uploading", size: 100, ratio: 1.0 }
      expect(parseCachedTorrents([bad])).toEqual([])
    })

    it("returns [] when first element is missing name field", () => {
      const bad = { hash: "abc", state: "uploading", size: 100, ratio: 1.0 }
      expect(parseCachedTorrents([bad])).toEqual([])
    })

    it("returns [] when first element is missing state field", () => {
      const bad = { hash: "abc", name: "Test", size: 100, ratio: 1.0 }
      expect(parseCachedTorrents([bad])).toEqual([])
    })

    it("returns [] when first element is missing size field", () => {
      const bad = { hash: "abc", name: "Test", state: "uploading", ratio: 1.0 }
      expect(parseCachedTorrents([bad])).toEqual([])
    })

    it("returns [] when first element is missing ratio field", () => {
      const bad = { hash: "abc", name: "Test", state: "uploading", size: 100 }
      expect(parseCachedTorrents([bad])).toEqual([])
    })

    it("returns [] when first element has non-string hash", () => {
      const bad = { hash: 123, name: "Test", state: "uploading", size: 100, ratio: 1.0 }
      expect(parseCachedTorrents([bad])).toEqual([])
    })

    it("returns [] when first element has non-number size", () => {
      const bad = { hash: "abc", name: "Test", state: "uploading", size: "100", ratio: 1.0 }
      expect(parseCachedTorrents([bad])).toEqual([])
    })

    it("returns [] when first element is null", () => {
      expect(parseCachedTorrents([null])).toEqual([])
    })

    it("returns [] when first element is a plain string", () => {
      expect(parseCachedTorrents(["not-an-object"])).toEqual([])
    })
  })

  describe("non-array non-string inputs", () => {
    it("returns [] for a plain object input (not array, not string)", () => {
      expect(parseCachedTorrents({ hash: "abc", name: "x" })).toEqual([])
    })

    it("returns [] for a number input", () => {
      expect(parseCachedTorrents(42)).toEqual([])
    })
  })

  describe("only first element checked", () => {
    it("returns all elements when first is valid, even if later elements are malformed", () => {
      // parseCachedTorrents only validates index 0 — subsequent items pass through unchecked
      const malformed = { hash: "bad", missing_name: true }
      const result = parseCachedTorrents([VALID_TORRENT, malformed])
      expect(result).toHaveLength(2)
      expect(result[0].hash).toBe("abc123def456")
    })
  })
})
