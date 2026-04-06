// src/lib/__tests__/fleet-helpers.test.ts

import { describe, expect, it } from "vitest"
import { normalizeCategory, parseTorrentTags, toMonthKey } from "@/lib/fleet"

// ---------------------------------------------------------------------------
// normalizeCategory
// ---------------------------------------------------------------------------

describe("normalizeCategory", () => {
  it("returns Uncategorized for empty string", () => {
    expect(normalizeCategory("")).toBe("Uncategorized")
  })

  it("returns Uncategorized for null", () => {
    expect(normalizeCategory(null)).toBe("Uncategorized")
  })

  it("returns Uncategorized for undefined", () => {
    expect(normalizeCategory(undefined)).toBe("Uncategorized")
  })

  it("returns Uncategorized for whitespace-only string", () => {
    expect(normalizeCategory("   ")).toBe("Uncategorized")
  })

  it("trims leading and trailing whitespace", () => {
    expect(normalizeCategory("  movies  ")).toBe("movies")
  })

  it("returns category as-is for non-empty input", () => {
    expect(normalizeCategory("movies")).toBe("movies")
  })
})

// ---------------------------------------------------------------------------
// toMonthKey
// ---------------------------------------------------------------------------

describe("toMonthKey", () => {
  it("produces correct YYYY-MM format for a known timestamp", () => {
    // 1700000000 seconds = 2023-11-14T22:13:20Z
    const result = toMonthKey(1700000000)
    expect(result).toBe("2023-11")
  })

  it("pads single-digit months with a leading zero", () => {
    // 1704067200 = 2024-01-01T00:00:00Z (January)
    const result = toMonthKey(1704067200)
    expect(result).toBe("2024-01")
  })

  it("uses UTC month, not local time", () => {
    // Pick a timestamp that sits at the very end of one UTC month but could
    // fall in the next month in UTC+X timezones:
    // 1696118399 = 2023-09-30T23:59:59Z (still September in UTC)
    const result = toMonthKey(1696118399)
    expect(result).toBe("2023-09")
  })
})

// ---------------------------------------------------------------------------
// parseTorrentTags
// ---------------------------------------------------------------------------

describe("parseTorrentTags", () => {
  it("returns empty array for empty string", () => {
    expect(parseTorrentTags("")).toEqual([])
  })

  it("returns empty array for null (cast as string)", () => {
    expect(parseTorrentTags(null as unknown as string)).toEqual([])
  })

  it("returns empty array for undefined (cast as string)", () => {
    expect(parseTorrentTags(undefined as unknown as string)).toEqual([])
  })

  it("parses comma-separated tags", () => {
    expect(parseTorrentTags("aither, blutopia")).toEqual(["aither", "blutopia"])
  })

  it("lowercases tags by default", () => {
    expect(parseTorrentTags("Aither")).toEqual(["aither"])
  })

  it("preserves case when lowercase=false", () => {
    expect(parseTorrentTags("Aither", false)).toEqual(["Aither"])
  })

  it("filters empty strings produced by trailing commas", () => {
    expect(parseTorrentTags("aither,")).toEqual(["aither"])
  })
})
