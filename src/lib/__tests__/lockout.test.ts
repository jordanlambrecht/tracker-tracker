// src/lib/__tests__/lockout.test.ts

import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/db", () => ({
  db: {
    update: vi.fn(),
  },
}))

vi.mock("@/lib/db/schema", () => ({
  appSettings: {},
}))

import { db } from "@/lib/db"
import { checkLockout, recordFailedAttempt } from "@/lib/lockout"

const mockUpdate = db.update as ReturnType<typeof vi.fn>

describe("checkLockout", () => {
  const baseLockout = { lockoutEnabled: true, lockoutThreshold: 5, lockoutDurationMinutes: 15 }

  it("returns null when not locked", () => {
    expect(checkLockout({ ...baseLockout, lockedUntil: null })).toBeNull()
  })
  it("returns null when lock expired", () => {
    const past = new Date(Date.now() - 60_000)
    expect(checkLockout({ ...baseLockout, lockedUntil: past })).toBeNull()
  })
  it("returns 429 response when locked", () => {
    const future = new Date(Date.now() + 60_000)
    const result = checkLockout({ ...baseLockout, lockedUntil: future })
    expect(result).not.toBeNull()
    expect(result?.status).toBe(429)
  })
  it("returns null when lockout is disabled even if lockedUntil is set", () => {
    const future = new Date(Date.now() + 60_000)
    expect(checkLockout({ ...baseLockout, lockoutEnabled: false, lockedUntil: future })).toBeNull()
  })
})

describe("recordFailedAttempt", () => {
  const lockoutSettings = { lockoutEnabled: true, lockoutThreshold: 5, lockoutDurationMinutes: 15 }

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
    await recordFailedAttempt(1, lockoutSettings)
    expect(mockUpdate).toHaveBeenCalled()
    expect(chain.set).toHaveBeenCalled()
    expect(chain.returning).toHaveBeenCalled()
  })

  it("does not set lockout below threshold", async () => {
    setupMockChain(3)
    await recordFailedAttempt(1, lockoutSettings)
    expect(mockUpdate).toHaveBeenCalledTimes(1)
  })

  it("sets lockout when attempts reach threshold", async () => {
    setupMockChain(5)
    await recordFailedAttempt(1, lockoutSettings)
    expect(mockUpdate).toHaveBeenCalledTimes(2)
  })

  it("does not set lockout when disabled", async () => {
    setupMockChain(100)
    await recordFailedAttempt(1, { ...lockoutSettings, lockoutEnabled: false })
    expect(mockUpdate).toHaveBeenCalledTimes(1)
  })
})
