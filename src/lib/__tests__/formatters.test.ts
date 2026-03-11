// src/lib/__tests__/formatters.test.ts

import { describe, expect, it } from "vitest"
import { bytesToGiB, computeDelta, hexToRgba } from "@/lib/formatters"
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
