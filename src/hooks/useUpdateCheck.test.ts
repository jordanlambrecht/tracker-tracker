// src/hooks/useUpdateCheck.test.ts

import { describe, expect, it } from "vitest"
import { compareVersions } from "./useUpdateCheck"

describe("compareVersions", () => {
  it("returns 0 for equal versions", () => {
    expect(compareVersions("1.2.1", "1.2.1")).toBe(0)
  })

  it("returns > 0 when latest is newer (patch)", () => {
    expect(compareVersions("1.2.1", "1.2.2")).toBeGreaterThan(0)
  })

  it("returns > 0 when latest is newer (minor)", () => {
    expect(compareVersions("1.2.1", "1.3.0")).toBeGreaterThan(0)
  })

  it("returns > 0 when latest is newer (major)", () => {
    expect(compareVersions("1.2.1", "2.0.0")).toBeGreaterThan(0)
  })

  it("returns < 0 when current is newer", () => {
    expect(compareVersions("2.0.0", "1.9.9")).toBeLessThan(0)
  })

  it("strips v prefix", () => {
    expect(compareVersions("v1.2.1", "v1.2.2")).toBeGreaterThan(0)
    expect(compareVersions("v1.2.1", "1.2.1")).toBe(0)
  })

  it("handles different segment lengths", () => {
    expect(compareVersions("1.2", "1.2.1")).toBeGreaterThan(0)
    expect(compareVersions("1.2.1", "1.2")).toBeLessThan(0)
  })
})
