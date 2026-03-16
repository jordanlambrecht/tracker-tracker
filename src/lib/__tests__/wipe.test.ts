// src/lib/__tests__/wipe.test.ts

import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/db", () => ({
  db: {
    update: vi.fn(),
    delete: vi.fn().mockReturnValue({ where: vi.fn() }),
    execute: vi.fn(),
  },
}))

vi.mock("@/lib/db/schema", () => ({
  appSettings: {},
  trackerSnapshots: {},
  trackers: {},
  trackerRoles: {},
  downloadClients: {},
  clientSnapshots: {},
  clientUptimeBuckets: {},
  tagGroupMembers: {},
  tagGroups: {},
}))

vi.mock("@/lib/scheduler", () => ({
  stopScheduler: vi.fn(),
}))

import { db } from "@/lib/db"
import { checkLockout, getProgressiveLockoutMs, recordFailedAttempt } from "@/lib/wipe"

const mockUpdate = db.update as ReturnType<typeof vi.fn>

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

describe("checkLockout", () => {
  it("returns null when not locked", () => {
    expect(checkLockout({ lockedUntil: null })).toBeNull()
  })
  it("returns null when lock expired", () => {
    const past = new Date(Date.now() - 60_000)
    expect(checkLockout({ lockedUntil: past })).toBeNull()
  })
  it("returns 429 response when locked", () => {
    const future = new Date(Date.now() + 60_000)
    const result = checkLockout({ lockedUntil: future })
    expect(result).not.toBeNull()
    expect(result?.status).toBe(429)
  })
})

describe("recordFailedAttempt", () => {
  function setupMockChain(failedLoginAttempts: number) {
    const chain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ failedLoginAttempts }]),
    }
    mockUpdate.mockReturnValue(chain)
    return chain
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("increments the counter via atomic SQL", async () => {
    const chain = setupMockChain(1)
    await recordFailedAttempt(1, null)
    expect(mockUpdate).toHaveBeenCalled()
    expect(chain.set).toHaveBeenCalled()
    expect(chain.returning).toHaveBeenCalled()
  })

  it("does not set lockout below threshold", async () => {
    setupMockChain(3)
    await recordFailedAttempt(1, null)
    // update called once for the increment, not again for lockout
    expect(mockUpdate).toHaveBeenCalledTimes(1)
  })

  it("sets lockout when attempts reach 5", async () => {
    setupMockChain(5)
    await recordFailedAttempt(1, null)
    // update called twice: increment + lockout
    expect(mockUpdate).toHaveBeenCalledTimes(2)
  })

  it("sets lockout when attempts reach 10", async () => {
    setupMockChain(10)
    await recordFailedAttempt(1, null)
    expect(mockUpdate).toHaveBeenCalledTimes(2)
  })

  it("returns false when below wipe threshold", async () => {
    setupMockChain(3)
    const wiped = await recordFailedAttempt(1, 10)
    expect(wiped).toBe(false)
  })

  it("returns false when threshold is null", async () => {
    setupMockChain(100)
    const wiped = await recordFailedAttempt(1, null)
    expect(wiped).toBe(false)
  })

  it("returns true and wipes when at threshold", async () => {
    // First call returns the atomic increment result, subsequent calls are from scrubAndDeleteAll
    const chain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ failedLoginAttempts: 10 }]),
    }
    mockUpdate.mockReturnValue(chain)
    const wiped = await recordFailedAttempt(1, 10)
    expect(wiped).toBe(true)
  })
})
