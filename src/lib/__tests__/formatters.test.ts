// src/lib/__tests__/formatters.test.ts

import { describe, expect, it } from "vitest"
import { hexToRgba } from "@/lib/color-utils"
import {
  computeBufferBytes,
  computeDelta,
  floatBytesToBigInt,
  signedFloatBytesToBigInt,
} from "@/lib/data-transforms"
import {
  bytesToGiB,
  formatCount,
  formatDateTime,
  formatOrdinal,
  formatPercent,
  formatRatio,
  formatRatioDisplay,
  formatSignedChange,
  formatSpanInWords,
} from "@/lib/formatters"
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
  ratioIsInfinite: false,
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
  isManual: false,
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
    expect(formatPercent(85, { decimals: 0 })).toBe("85%")
    expect(formatPercent(33.333, { decimals: 2 })).toBe("33.33%")
  })

  it("handles edge values", () => {
    expect(formatPercent(-5.1)).toBe("-5.1%")
    expect(formatPercent(0.05, { decimals: 0 })).toBe("0%")
    expect(formatPercent(Number.POSITIVE_INFINITY, { signed: true })).toBe("—")
  })

  it("drops the minus from a negative that rounds to zero", () => {
    expect(formatPercent(-0.04)).toBe("0.0%")
    expect(formatPercent(-0.4, { decimals: 0 })).toBe("0%")
  })

  it("signs the rounded value in signed mode", () => {
    expect(formatPercent(5.79, { signed: true })).toBe("+5.8%")
    expect(formatPercent(-2.96, { signed: true })).toBe("-3.0%")
    expect(formatPercent(0.04, { signed: true })).toBe("0.0%")
    expect(formatPercent(-0.04, { signed: true })).toBe("0.0%")
    expect(formatPercent(0.4, { decimals: 0, signed: true })).toBe("0%")
  })
})

// ---------------------------------------------------------------------------
// formatDateTime
// ---------------------------------------------------------------------------

describe("formatDateTime", () => {
  it("formats an ISO string", () => {
    const result = formatDateTime("2026-03-15T14:30:00.000Z")
    expect(result).toContain("2026")
    expect(result).not.toBe("Invalid Date")
  })

  it("formats a Date object", () => {
    const result = formatDateTime(new Date("2026-03-15T14:30:00.000Z"))
    expect(result).toContain("2026")
    expect(result).not.toBe("Invalid Date")
  })

  it("formats a numeric timestamp", () => {
    // 1710510600000 = 2024-03-15T16:30:00.000Z
    const result = formatDateTime(1710510600000)
    expect(result).toContain("2024")
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

  // This clamp is load-bearing and must not be loosened for symmetry with the
  // signed helper: every caller converts uploaded/downloaded, which are
  // monotonic counters, so a negative there is a malformed API response and the
  // clamp is what stops it reaching the snapshots table.
  it("clamps negative values to 0n", () => {
    expect(floatBytesToBigInt(-1)).toBe(0n)
    expect(floatBytesToBigInt(-0.5)).toBe(0n)
    expect(floatBytesToBigInt(-2627286052460)).toBe(0n)
  })
})

// ---------------------------------------------------------------------------
// signedFloatBytesToBigInt
// ---------------------------------------------------------------------------

describe("signedFloatBytesToBigInt", () => {
  it("preserves a negative buffer reported by the tracker", () => {
    // Hawke's verified deficit response
    expect(signedFloatBytesToBigInt(-2627286052460)).toBe(-2627286052460n)
    expect(signedFloatBytesToBigInt(-1)).toBe(-1n)
  })

  it("behaves like the clamped helper for non-negative input", () => {
    expect(signedFloatBytesToBigInt(1234.7)).toBe(1234n)
    expect(signedFloatBytesToBigInt(0)).toBe(0n)
  })

  it("truncates toward zero rather than flooring", () => {
    // Math.floor(-0.5) is -1, which would deepen a reported deficit.
    expect(signedFloatBytesToBigInt(-0.5)).toBe(0n)
    expect(signedFloatBytesToBigInt(-999.999)).toBe(-999n)
  })

  it("returns 0n for null and undefined", () => {
    expect(signedFloatBytesToBigInt(null)).toBe(0n)
    expect(signedFloatBytesToBigInt(undefined)).toBe(0n)
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

  // Buffer is signed on a private tracker. Clamping a deficit to 0n drew a flat
  // line on the buffer chart while the account got worse, indistinguishable
  // from holding steady at breakeven.
  it("returns a negative buffer when download exceeds upload", () => {
    expect(computeBufferBytes(100n, 500n)).toBe(-400n)
    expect(computeBufferBytes(0n, 2627286052460n)).toBe(-2627286052460n)
  })

  it("returns 0n only at genuine breakeven", () => {
    expect(computeBufferBytes(500n, 500n)).toBe(0n)
    expect(computeBufferBytes(0n, 0n)).toBe(0n)
  })
})

describe("formatOrdinal", () => {
  it("uses st, nd and rd for one, two and three", () => {
    expect(formatOrdinal(1)).toBe("1st")
    expect(formatOrdinal(2)).toBe("2nd")
    expect(formatOrdinal(3)).toBe("3rd")
    expect(formatOrdinal(4)).toBe("4th")
  })

  it("keeps th through the teens, where the last digit lies", () => {
    expect(formatOrdinal(11)).toBe("11th")
    expect(formatOrdinal(12)).toBe("12th")
    expect(formatOrdinal(13)).toBe("13th")
  })

  it("reads the last digit again above twenty", () => {
    expect(formatOrdinal(21)).toBe("21st")
    expect(formatOrdinal(22)).toBe("22nd")
    expect(formatOrdinal(23)).toBe("23rd")
    expect(formatOrdinal(32)).toBe("32nd")
    expect(formatOrdinal(111)).toBe("111th")
    expect(formatOrdinal(101)).toBe("101st")
  })

  it("returns a dash for a missing value", () => {
    expect(formatOrdinal(null)).toBe("—")
    expect(formatOrdinal(undefined)).toBe("—")
  })
})

describe("formatSignedChange", () => {
  it("signs a change by its direction", () => {
    expect(formatSignedChange(0.0123, 4)).toEqual({ text: "+0.0123", direction: "up" })
    expect(formatSignedChange(-0.0123, 4)).toEqual({ text: "-0.0123", direction: "down" })
  })

  it("shows a change that rounds to zero without a sign", () => {
    expect(formatSignedChange(0, 4)).toEqual({ text: "0.0000", direction: "flat" })
    expect(formatSignedChange(0.00004, 4)).toEqual({ text: "0.0000", direction: "flat" })
    expect(formatSignedChange(-0.04, 1)).toEqual({ text: "0.0", direction: "flat" })
  })

  it("passes the unsigned, rounded magnitude to the formatter", () => {
    expect(formatSignedChange(-1234, 0, formatCount).text).toBe("-1,234")
    expect(formatSignedChange(-0.04, 1, (v) => formatPercent(v)).text).toBe("0.0%")
    expect(formatSignedChange(12.34, 1, (v) => formatPercent(v)).text).toBe("+12.3%")
  })
})

const SPAN_MINUTE = 60_000
const SPAN_HOUR = 60 * SPAN_MINUTE
const SPAN_DAY = 24 * SPAN_HOUR

describe("formatSpanInWords", () => {
  it.each([
    [30_000, "less than a minute"],
    [SPAN_MINUTE, "1 minute"],
    [45 * SPAN_MINUTE, "45 minutes"],
    [SPAN_HOUR, "1 hour"],
    [3 * SPAN_HOUR + 59 * SPAN_MINUTE, "3 hours"],
    [SPAN_DAY, "1 day"],
    [2 * SPAN_DAY + 5 * SPAN_HOUR, "2 days, 5 hours"],
    [SPAN_DAY + SPAN_HOUR, "1 day, 1 hour"],
    [-3 * SPAN_HOUR, "3 hours"],
  ])("formats %d ms as %s", (ms, text) => {
    expect(formatSpanInWords(ms)).toBe(text)
  })
})
