// src/lib/__tests__/formatters-today.test.ts

import { describe, expect, it } from "vitest"
import { formatBytesFromString, localDateStr } from "@/lib/formatters"

// ---------------------------------------------------------------------------
// localDateStr
// ---------------------------------------------------------------------------

describe("localDateStr", () => {
  it("returns a YYYY-MM-DD formatted string", () => {
    const result = localDateStr(new Date("2024-06-15"))
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it("returns the correct date for a given Date object", () => {
    // Construct a date at local midnight to avoid any timezone edge case confusion
    const d = new Date(2024, 5, 15) // June 15 2024 in local time
    const result = localDateStr(d)
    expect(result).toBe("2024-06-15")
  })

  it("returns the correct date for a unix milliseconds number", () => {
    // 2024-01-20 at noon UTC — choosing noon avoids UTC±local edge
    const ms = new Date("2024-01-20T12:00:00").getTime()
    const result = localDateStr(ms)
    // The year, month, and day must match a local interpretation of that timestamp
    expect(result).toMatch(/^2024-01-\d{2}$/)
  })

  it("with no args, returns today's date in YYYY-MM-DD format", () => {
    const today = new Date().toLocaleDateString("en-CA")
    const result = localDateStr()
    expect(result).toBe(today)
  })

  it("handles the first day of the month without off-by-one", () => {
    const d = new Date(2024, 0, 1) // January 1 local
    expect(localDateStr(d)).toBe("2024-01-01")
  })

  it("handles the last day of the month correctly", () => {
    const d = new Date(2024, 0, 31) // January 31 local
    expect(localDateStr(d)).toBe("2024-01-31")
  })

  it("handles leap day", () => {
    const d = new Date(2024, 1, 29) // Feb 29 2024 (leap year) local
    expect(localDateStr(d)).toBe("2024-02-29")
  })

  it("is consistent between Date object and equivalent unix ms input", () => {
    const d = new Date(2025, 2, 26) // March 26 2025 local
    const ms = d.getTime()
    expect(localDateStr(d)).toBe(localDateStr(ms))
  })
})

// ---------------------------------------------------------------------------
// formatBytesFromString — MiB threshold
// ---------------------------------------------------------------------------

describe("formatBytesFromString MiB/GiB threshold", () => {
  const MiB = 1024 * 1024
  const GiB = 1024 * 1024 * 1024
  const TiB = 1024 * 1024 * 1024 * 1024

  it("returns '0 MiB' (zero padded rounds to 0) for 0 bytes", () => {
    expect(formatBytesFromString("0")).toBe("0 MiB")
  })

  it("500 MiB (under 1 GiB) displays as MiB, not GiB", () => {
    const bytes = BigInt(500 * MiB)
    const result = formatBytesFromString(bytes.toString())
    expect(result).toContain("MiB")
    expect(result).not.toContain("GiB")
    expect(result).not.toContain("TiB")
  })

  it("value just under 1 GiB displays as MiB", () => {
    const bytes = BigInt(GiB - 1)
    const result = formatBytesFromString(bytes.toString())
    expect(result).toContain("MiB")
    expect(result).not.toContain("GiB")
  })

  it("exactly 1 GiB displays as GiB", () => {
    const bytes = BigInt(GiB)
    const result = formatBytesFromString(bytes.toString())
    expect(result).toContain("GiB")
    expect(result).not.toContain("MiB")
    expect(result).toBe("1.00 GiB")
  })

  it("value over 1 GiB displays as GiB", () => {
    const bytes = BigInt(1.5 * GiB)
    const result = formatBytesFromString(bytes.toString())
    expect(result).toContain("GiB")
    expect(result).not.toContain("MiB")
    expect(result).toBe("1.50 GiB")
  })

  it("value over 1 TiB displays as TiB", () => {
    const bytes = BigInt(2 * TiB)
    const result = formatBytesFromString(bytes.toString())
    expect(result).toContain("TiB")
    expect(result).not.toContain("GiB")
    expect(result).toBe("2.00 TiB")
  })

  it("value just over 1 TiB displays as TiB not GiB", () => {
    const bytes = BigInt(TiB + 1)
    const result = formatBytesFromString(bytes.toString())
    expect(result).toContain("TiB")
  })

  it("null input returns the em dash fallback", () => {
    expect(formatBytesFromString(null)).toBe("—")
  })

  it("undefined input returns the em dash fallback", () => {
    expect(formatBytesFromString(undefined)).toBe("—")
  })

  it("empty string input returns the em dash fallback", () => {
    expect(formatBytesFromString("")).toBe("—")
  })

  it("MiB value rounds to whole number (no decimal)", () => {
    const bytes = BigInt(512 * MiB)
    const result = formatBytesFromString(bytes.toString())
    // Math.round(512) → "512 MiB"
    expect(result).toBe("512 MiB")
  })

  it("100 MiB rounds and displays correctly", () => {
    const bytes = BigInt(100 * MiB)
    const result = formatBytesFromString(bytes.toString())
    expect(result).toBe("100 MiB")
  })

  it("1 MiB displays as 1 MiB", () => {
    const bytes = BigInt(MiB)
    const result = formatBytesFromString(bytes.toString())
    expect(result).toBe("1 MiB")
  })
})
