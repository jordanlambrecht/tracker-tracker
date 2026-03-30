// src/lib/__tests__/formatters.test.ts

import { describe, expect, it } from "vitest"
import { hexToRgba } from "@/lib/color-utils"
import {
  bytesToGiB,
  formatCount,
  formatDateTime,
  formatPercent,
  formatRatio,
  formatRatioDisplay,
} from "@/lib/formatters"
import { computeBufferBytes, computeDelta, floatBytesToBigInt } from "@/lib/helpers"
import type { Snapshot } from "@/types/api"

describe("bytesToGiB", () => {
  it("returns 0 for empty string", () => {
    expect(bytesToGiB("")).toBe(0)
  })

  it("returns 0 for null-ish input", () => {
    expect(bytesToGiB(null)).toBe(0)
    expect(bytesToGiB(undefined)).toBe(0)
  })

  it("converts valid byte string to GiB", () => {
    expect(bytesToGiB("1073741824")).toBeCloseTo(1.0)
  })
})

describe("hexToRgba", () => {
  it("converts valid hex to rgba", () => {
    expect(hexToRgba("#00d4ff", 0.5)).toBe("rgba(0, 212, 255, 0.5)")
  })

  it("returns fallback for shorthand hex", () => {
    expect(hexToRgba("#fff", 0.5)).toBe("rgba(0, 212, 255, 0.5)")
  })

  it("returns fallback for empty string", () => {
    expect(hexToRgba("", 0.5)).toBe("rgba(0, 212, 255, 0.5)")
  })

  it("returns fallback for invalid string", () => {
    expect(hexToRgba("not-a-color", 0.5)).toBe("rgba(0, 212, 255, 0.5)")
  })
})

const makeSnap = (polledAt: string, up: string, down: string): Snapshot => ({
  polledAt,
  uploadedBytes: up,
  downloadedBytes: down,
  ratio: null,
  bufferBytes: "0",
  seedbonus: null,
  seedingCount: null,
  leechingCount: null,
  hitAndRuns: null,
  requiredRatio: null,
  warned: null,
  freeleechTokens: null,
  shareScore: null,
  username: null,
  group: null,
})

describe("computeDelta", () => {
  it("returns null for fewer than 2 snapshots", () => {
    expect(computeDelta([])).toBeNull()
    expect(computeDelta([makeSnap(new Date().toISOString(), "100", "50")])).toBeNull()
  })

  it("computes 24h delta from ascending snapshots", () => {
    const now = Date.now()
    const snaps = [
      makeSnap(new Date(now - 12 * 3600_000).toISOString(), "1000", "500"),
      makeSnap(new Date(now - 1 * 3600_000).toISOString(), "2000", "800"),
    ]
    const result = computeDelta(snaps)
    expect(result).toEqual({ uploaded: "1000", downloaded: "300" })
  })

  it("handles descending-order snapshots (sorts internally)", () => {
    const now = Date.now()
    const snaps = [
      makeSnap(new Date(now - 1 * 3600_000).toISOString(), "2000", "800"),
      makeSnap(new Date(now - 12 * 3600_000).toISOString(), "1000", "500"),
    ]
    const result = computeDelta(snaps)
    expect(result).toEqual({ uploaded: "1000", downloaded: "300" })
  })

  it("returns null when all snapshots are older than 24h", () => {
    const old = Date.now() - 48 * 3600_000
    const snaps = [
      makeSnap(new Date(old).toISOString(), "1000", "500"),
      makeSnap(new Date(old + 3600_000).toISOString(), "1100", "550"),
    ]
    expect(computeDelta(snaps)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// formatRatio
// ---------------------------------------------------------------------------

describe("formatRatio", () => {
  it("formats a ratio to 2 decimal places", () => {
    expect(formatRatio(1.5)).toBe("1.50")
    expect(formatRatio(0)).toBe("0.00")
  })

  it("returns em dash for null and undefined", () => {
    expect(formatRatio(null)).toBe("—")
    expect(formatRatio(undefined)).toBe("—")
  })

  it("returns infinity symbol for non-finite values", () => {
    expect(formatRatio(Infinity)).toBe("∞")
    expect(formatRatio(-Infinity)).toBe("∞")
    expect(formatRatio(NaN)).toBe("∞")
  })
})

// ---------------------------------------------------------------------------
// formatRatioDisplay
// ---------------------------------------------------------------------------

describe("formatRatioDisplay", () => {
  it("formats a ratio with 2dp and x suffix", () => {
    expect(formatRatioDisplay(1.5)).toBe("1.50x")
    expect(formatRatioDisplay(0)).toBe("0.00x")
    expect(formatRatioDisplay(12.345)).toBe("12.35x")
  })

  it("returns em dash for null and undefined", () => {
    expect(formatRatioDisplay(null)).toBe("—")
    expect(formatRatioDisplay(undefined)).toBe("—")
  })

  it("returns infinity symbol for Infinity and NaN", () => {
    expect(formatRatioDisplay(Infinity)).toBe("∞x")
    expect(formatRatioDisplay(-Infinity)).toBe("∞x")
    expect(formatRatioDisplay(NaN)).toBe("∞x")
  })
})

// ---------------------------------------------------------------------------
// formatCount
// ---------------------------------------------------------------------------

describe("formatCount", () => {
  it("formats integers with thousand separators", () => {
    expect(formatCount(0)).toBe("0")
    expect(formatCount(999)).toBe("999")
    expect(formatCount(1234)).toBe("1,234")
    expect(formatCount(1_000_000)).toBe("1,000,000")
  })

  it("returns em dash for null and undefined", () => {
    expect(formatCount(null)).toBe("—")
    expect(formatCount(undefined)).toBe("—")
  })

  it("handles negative numbers", () => {
    expect(formatCount(-42)).toBe("-42")
    expect(formatCount(-1234)).toBe("-1,234")
  })
})

// ---------------------------------------------------------------------------
// formatPercent
// ---------------------------------------------------------------------------

describe("formatPercent", () => {
  it("formats with 1 decimal place by default", () => {
    expect(formatPercent(42.37)).toBe("42.4%")
    expect(formatPercent(0)).toBe("0.0%")
    expect(formatPercent(100)).toBe("100.0%")
  })

  it("respects custom decimal places", () => {
    expect(formatPercent(85, 0)).toBe("85%")
    expect(formatPercent(33.333, 2)).toBe("33.33%")
  })

  it("handles edge values", () => {
    expect(formatPercent(-5.1)).toBe("-5.1%")
    expect(formatPercent(0.05, 0)).toBe("0%")
  })
})

// ---------------------------------------------------------------------------
// formatDateTime
// ---------------------------------------------------------------------------

describe("formatDateTime", () => {
  it("formats an ISO string", () => {
    const result = formatDateTime("2026-03-15T14:30:00.000Z")
    expect(typeof result).toBe("string")
    expect(result.length).toBeGreaterThan(5)
    // Output is locale-dependent on the test runner, so just verify it's not "Invalid Date"
    expect(result).not.toBe("Invalid Date")
  })

  it("formats a Date object", () => {
    const result = formatDateTime(new Date("2026-03-15T14:30:00.000Z"))
    expect(result).not.toBe("Invalid Date")
  })

  it("formats a numeric timestamp", () => {
    const result = formatDateTime(1742048400000)
    expect(result).not.toBe("Invalid Date")
  })
})

// ---------------------------------------------------------------------------
// floatBytesToBigInt
// ---------------------------------------------------------------------------

describe("floatBytesToBigInt", () => {
  it("converts a float to a floored bigint", () => {
    expect(floatBytesToBigInt(1234.7)).toBe(1234n)
    expect(floatBytesToBigInt(0)).toBe(0n)
    expect(floatBytesToBigInt(1024 * 1024 * 1024)).toBe(1073741824n)
  })

  it("returns 0n for null and undefined", () => {
    expect(floatBytesToBigInt(null)).toBe(0n)
    expect(floatBytesToBigInt(undefined)).toBe(0n)
  })

  it("floors fractional bytes", () => {
    expect(floatBytesToBigInt(999.999)).toBe(999n)
    expect(floatBytesToBigInt(0.1)).toBe(0n)
  })

  it("clamps negative values to 0n", () => {
    expect(floatBytesToBigInt(-1)).toBe(0n)
    expect(floatBytesToBigInt(-0.5)).toBe(0n)
  })
})

// ---------------------------------------------------------------------------
// computeBufferBytes
// ---------------------------------------------------------------------------

describe("computeBufferBytes", () => {
  it("returns the difference when upload exceeds download", () => {
    expect(computeBufferBytes(500n, 200n)).toBe(300n)
    expect(computeBufferBytes(1000n, 0n)).toBe(1000n)
  })

  it("returns 0n when download exceeds or equals upload", () => {
    expect(computeBufferBytes(100n, 500n)).toBe(0n)
    expect(computeBufferBytes(500n, 500n)).toBe(0n)
    expect(computeBufferBytes(0n, 0n)).toBe(0n)
  })
})
