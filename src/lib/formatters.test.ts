// src/lib/formatters.test.ts
import { describe, expect, it } from "vitest"
import {
  formatBytesFromString,
  formatBytesNum,
  formatRatio,
  formatStatValue,
  trackerDateStr,
} from "./formatters"

describe("formatBytesFromString", () => {
  it("formats GiB values", () => {
    // 500 GiB in bytes
    const bytes = String(BigInt(500) * BigInt(1024 ** 3))
    expect(formatBytesFromString(bytes)).toBe("500.00 GiB")
  })

  it("formats TiB values", () => {
    // 2 TiB in bytes
    const bytes = String(BigInt(2) * BigInt(1024 ** 4))
    expect(formatBytesFromString(bytes)).toBe("2.00 TiB")
  })

  // Buffer is signed, so scale on the magnitude. A `>= 1` check on the scaled
  // value fails for every negative and would print -2.39 TiB as "-2505575 MiB".
  it("formats a negative value with a sign and the right unit", () => {
    // Hawke's verified deficit response
    expect(formatBytesFromString("-2627286052460")).toBe("-2.39 TiB")
    expect(formatBytesFromString("-15561971655")).toBe("-14.49 GiB")
    expect(formatBytesFromString(String(-5 * 1024 ** 2))).toBe("-5 MiB")
  })

  it("never renders a negative sign on a value that rounds to zero", () => {
    // -0.5 KiB scales to -0.0 MiB; "-0 MiB" reads as a deficit that isn't there.
    expect(formatBytesFromString("-512")).toBe("0 MiB")
    expect(formatBytesFromString("0")).toBe("0 MiB")
  })

  it("leaves positive output unchanged (uploaded/downloaded share this path)", () => {
    expect(formatBytesFromString("2627286052460")).toBe("2.39 TiB")
    expect(formatBytesFromString(String(5 * 1024 ** 2))).toBe("5 MiB")
  })

  it("returns the em dash for unparseable input", () => {
    expect(formatBytesFromString("not-a-number")).toBe("—")
    expect(formatBytesFromString(null)).toBe("—")
  })
})

describe("formatBytesNum", () => {
  it("returns 0 B for zero bytes", () => {
    expect(formatBytesNum(0)).toBe("0 B")
  })

  it("formats positive bytes with binary units", () => {
    expect(formatBytesNum(1024 ** 3)).toBe("1.00 GiB")
  })

  it("formats positive bytes with decimal units", () => {
    expect(formatBytesNum(1000 ** 3, false)).toBe("1.00 GB")
  })

  it("formats negative bytes with sign prefix", () => {
    const result = formatBytesNum(-(1024 ** 3))
    expect(result).toBe("-1.00 GiB")
  })

  it("formats large negative values", () => {
    const result = formatBytesNum(-15561971655)
    expect(result).toMatch(/^-/)
    expect(result).toMatch(/GiB$/)
  })

  it("uses variable precision (>=100: 0dp, >=10: 1dp, else: 2dp)", () => {
    expect(formatBytesNum(150 * 1024 ** 3)).toBe("150 GiB")
    expect(formatBytesNum(15 * 1024 ** 3)).toBe("15.0 GiB")
    expect(formatBytesNum(1.5 * 1024 ** 3)).toBe("1.50 GiB")
  })

  it("formats PiB for very large values", () => {
    const huge = 1024 ** 5
    expect(formatBytesNum(huge)).toBe("1.00 PiB")
  })

  it("clamps unit index to array bounds", () => {
    const huge = 1024 ** 7
    const result = formatBytesNum(huge)
    expect(result).toMatch(/PiB$/)
  })
})

describe("formatRatio", () => {
  it("formats a number to 2 decimal places", () => {
    expect(formatRatio(3.99)).toBe("3.99")
  })
})

describe("formatStatValue", () => {
  const stats = {
    ratio: 2.79,
    ratioIsInfinite: false,
    uploadedBytes: "17340000000000",
    downloadedBytes: "6210000000000",
    seedingCount: 1882,
    leechingCount: 0,
    requiredRatio: null,
    warned: null,
    freeleechTokens: null,
    bufferBytes: null,
    hitAndRuns: null,
    seedbonus: null,
    shareScore: null,
    username: "test",
    group: "VIP",
  }

  it("formats ratio with x suffix", () => {
    expect(formatStatValue(stats, "ratio")).toBe("2.79x")
  })

  it("formats seeding with label", () => {
    expect(formatStatValue(stats, "seeding")).toMatch(/1,882 seeding/)
  })

  it("formats uploaded with arrow", () => {
    expect(formatStatValue(stats, "uploaded")).toMatch(/↑/)
  })

  it("formats downloaded with arrow", () => {
    expect(formatStatValue(stats, "downloaded")).toMatch(/↓/)
  })

  it("formats buffer with label", () => {
    expect(formatStatValue(stats, "buffer")).toMatch(/buf/)
  })

  it("returns dash for null stats", () => {
    expect(formatStatValue(null, "ratio")).toBe("—")
  })

  it("returns dash for null ratio", () => {
    expect(formatStatValue({ ...stats, ratio: null }, "ratio")).toBe("—")
  })

  // An infinite ratio and an unmeasured one both arrive as `ratio: null`; only
  // the flag separates them. Showing "—" for the infinite case made a
  // zero-download account look like it had no data at all.
  it("renders an infinite ratio as ∞ rather than a dash", () => {
    expect(formatStatValue({ ...stats, ratio: null, ratioIsInfinite: true }, "ratio")).toBe("∞x")
  })

  it("returns dash for null seedingCount", () => {
    expect(formatStatValue({ ...stats, seedingCount: null }, "seeding")).toBe("—")
  })
})

describe("trackerDateStr", () => {
  // Adapters return several date shapes, since TrackerStats sets no format for
  // joinedDate or lastAccessDate. A bare date must skip Date, because
  // new Date("2026-08-28") is UTC midnight and reads as 2026-08-27 in a
  // negative-offset zone.
  it("returns a bare date unchanged, whatever the server timezone is", () => {
    expect(trackerDateStr("2026-08-28")).toBe("2026-08-28")
    expect(trackerDateStr("2021-06-15")).toBe("2021-06-15")
    expect(trackerDateStr("  2026-01-01  ")).toBe("2026-01-01")
  })

  it("does not route a bare date through Date, which would shift the day", () => {
    const bare = "2026-08-28"
    const viaDate = new Date(bare).toLocaleDateString("en-CA")
    // Only meaningful off UTC, where the two genuinely differ.
    if (viaDate !== bare) expect(trackerDateStr(bare)).not.toBe(viaDate)
    expect(trackerDateStr(bare)).toBe(bare)
  })

  it("converts a shape that carries a real time to the local calendar date", () => {
    expect(trackerDateStr("2021-06-15 09:00:00")).toBe("2021-06-15")
    expect(trackerDateStr("2024-12-02T12:00:00+00:00")).toBe(
      new Date("2024-12-02T12:00:00+00:00").toLocaleDateString("en-CA")
    )
  })

  it("returns undefined rather than a bogus date for an unparseable value", () => {
    expect(trackerDateStr("never")).toBeUndefined()
    expect(trackerDateStr("")).toBeUndefined()
    expect(trackerDateStr("N/A")).toBeUndefined()
  })
})
