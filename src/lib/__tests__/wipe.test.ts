// src/lib/__tests__/wipe.test.ts

import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/db", () => ({
  db: {
    update: vi.fn(),
  },
}))

vi.mock("@/lib/db/schema", () => ({
  appSettings: {},
}))

vi.mock("@/lib/scheduler", () => ({
  stopScheduler: vi.fn(),
}))

import { getProgressiveLockoutMs } from "@/lib/wipe"

describe("getProgressiveLockoutMs", () => {
  it.each([
    [0, 0],
    [1, 0],
    [4, 0],
    [5, 30_000],
    [9, 30_000],
    [10, 120_000],
    [14, 120_000],
    [15, 900_000],
    [19, 900_000],
    [20, 3_600_000],
    [100, 3_600_000],
  ])("returns correct lockout for %i attempts → %i ms", (attempts, expected) => {
    expect(getProgressiveLockoutMs(attempts)).toBe(expected)
  })
})
