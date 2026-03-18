// src/lib/formatters.test.ts
import { describe, expect, it } from "vitest"
import {
  bytesToGiB,
  formatBytesFromString,
  formatBytesNum,
  formatRatio,
  formatStatValue,
} from "./formatters"

describe("formatBytesFromString", () => {
  it("returns — for null", () => {
    expect(formatBytesFromString(null)).toBe("—")
  })

  it("returns — for undefined", () => {
    expect(formatBytesFromString(undefined)).toBe("—")
  })

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
})

describe("bytesToGiB", () => {
  it("converts bytes string to GiB number", () => {
    const bytes = String(BigInt(1024 ** 3))
    expect(bytesToGiB(bytes)).toBeCloseTo(1.0)
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

  it("returns — for null", () => {
    expect(formatRatio(null)).toBe("—")
  })

  it("returns — for undefined", () => {
    expect(formatRatio(undefined)).toBe("—")
  })
})

describe("formatStatValue", () => {
  const stats = {
    ratio: 2.79,
    uploadedBytes: "17340000000000",
    downloadedBytes: "6210000000000",
    seedingCount: 1882,
    leechingCount: 0,
    requiredRatio: null,
    warned: null,
    freeleechTokens: null,
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

  it("returns dash for null seedingCount", () => {
    expect(formatStatValue({ ...stats, seedingCount: null }, "seeding")).toBe("—")
  })
})
