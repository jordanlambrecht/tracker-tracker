// src/lib/formatters.test.ts
import { describe, expect, it } from "vitest"
import { bytesToGiB, formatBytesFromString, formatRatio, formatStatValue } from "./formatters"

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
