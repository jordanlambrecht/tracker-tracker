// src/lib/formatters.test.ts
import { describe, expect, it } from "vitest"
import { bytesToGiB, formatBytesFromString, formatRatio } from "./formatters"

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
