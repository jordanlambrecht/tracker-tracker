// src/lib/parser.test.ts
import { describe, expect, it } from "vitest"
import { formatBytes, parseBytes } from "./parser"

describe("parseBytes", () => {
  it("parses GiB values", () => {
    // 500.25 * 1024^3 = 537_139_347_456 (exact integer result)
    expect(parseBytes("500.25 GiB")).toBe(BigInt(537_139_347_456))
  })

  it("parses TiB values", () => {
    expect(parseBytes("1.5 TiB")).toBe(BigInt(1_649_267_441_664))
  })

  it("parses MiB values", () => {
    expect(parseBytes("100 MiB")).toBe(BigInt(104_857_600))
  })

  it("parses KiB values", () => {
    expect(parseBytes("512 KiB")).toBe(BigInt(524_288))
  })

  it("parses zero", () => {
    expect(parseBytes("0 GiB")).toBe(BigInt(0))
  })

  it("handles values with no decimal", () => {
    expect(parseBytes("50 GiB")).toBe(BigInt(53_687_091_200))
  })

  it("throws on invalid format", () => {
    expect(() => parseBytes("invalid")).toThrow()
  })

  it("throws on empty string", () => {
    expect(() => parseBytes("")).toThrow()
  })

  it("handles GB (decimal) if encountered", () => {
    expect(parseBytes("500 GB")).toBe(BigInt(500_000_000_000))
  })

  it("handles TB (decimal)", () => {
    expect(parseBytes("2 TB")).toBe(BigInt(2_000_000_000_000))
  })
})

describe("formatBytes", () => {
  it("formats bytes to GiB", () => {
    expect(formatBytes(BigInt(537_137_266_278))).toBe("500.25 GiB")
  })

  it("formats large values to TiB", () => {
    expect(formatBytes(BigInt(1_099_511_627_776))).toBe("1.00 TiB")
  })

  it("formats small values to MiB", () => {
    expect(formatBytes(BigInt(104_857_600))).toBe("100.00 MiB")
  })

  it("formats zero", () => {
    expect(formatBytes(BigInt(0))).toBe("0 B")
  })
})

describe("parseBytes - security", () => {
  it("rejects script injection in format string", () => {
    expect(() => parseBytes("<script>alert('xss')</script>")).toThrow()
  })

  it("rejects SQL injection attempts", () => {
    expect(() => parseBytes("1; DROP TABLE trackers; --")).toThrow()
  })

  it("handles extremely large values without crashing", () => {
    // 999 PiB equivalent - should not crash
    expect(() => parseBytes("999999999 TiB")).not.toThrow()
  })

  it("rejects negative values", () => {
    expect(() => parseBytes("-100 GiB")).toThrow()
  })
})
