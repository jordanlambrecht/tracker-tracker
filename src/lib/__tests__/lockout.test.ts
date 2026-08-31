// src/lib/__tests__/lockout.test.ts

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/db", () => ({
  db: {
    update: vi.fn(),
  },
}))

vi.mock("@/lib/db/schema", () => ({
  appSettings: {},
}))

vi.mock("@/lib/logger", () => ({
  log: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
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

// DISABLE_LOGIN_LOCKOUT exists because the in-app lockout toggle is behind
// authenticate(), unreachable by the very person it locks out. These cases pin
// the two controls as independent: the env var overrides enforcement without
// touching the DB toggle, and the DB toggle keeps working when the env var is
// absent. Each case re-imports the module so the warn-once flag starts clean.
describe("checkLockout with DISABLE_LOGIN_LOCKOUT", () => {
  const locked = {
    lockoutEnabled: true,
    lockoutThreshold: 5,
    lockoutDurationMinutes: 15,
    lockedUntil: new Date(Date.now() + 60_000),
  }

  async function freshCheckLockout() {
    vi.resetModules()
    const mod = await import("@/lib/lockout")
    return mod.checkLockout
  }

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("lets a locked-out user straight through when the env var is 'true'", async () => {
    vi.stubEnv("DISABLE_LOGIN_LOCKOUT", "true")
    const check = await freshCheckLockout()
    expect(check(locked)).toBeNull()
  })

  it("still enforces the lockout when the env var is unset", async () => {
    vi.stubEnv("DISABLE_LOGIN_LOCKOUT", undefined)
    const check = await freshCheckLockout()
    expect(check(locked)?.status).toBe(429)
  })

  // Only the exact string "true" disarms it, so a stray "1"/"yes"/"false" in a
  // compose file cannot quietly switch the lockout off.
  it.each(["false", "1", "yes", "TRUE", ""])(
    "still enforces the lockout when the env var is %o",
    async (value) => {
      vi.stubEnv("DISABLE_LOGIN_LOCKOUT", value)
      const check = await freshCheckLockout()
      expect(check(locked)?.status).toBe(429)
    }
  )

  it("leaves the database toggle working independently when the env var is unset", async () => {
    vi.stubEnv("DISABLE_LOGIN_LOCKOUT", undefined)
    const check = await freshCheckLockout()
    // DB toggle off → no enforcement, from the DB alone.
    expect(check({ ...locked, lockoutEnabled: false })).toBeNull()
    // DB toggle on and locked → enforcement, from the DB alone.
    expect(check(locked)?.status).toBe(429)
  })

  it("warns once per process so it cannot be silently left enabled", async () => {
    vi.stubEnv("DISABLE_LOGIN_LOCKOUT", "true")
    vi.resetModules()
    const { log } = await import("@/lib/logger")
    const { checkLockout: check } = await import("@/lib/lockout")
    const warn = log.warn as unknown as ReturnType<typeof vi.fn>
    warn.mockClear()

    // Warns even when nothing is actually locked, an armed switch on a healthy
    // instance is exactly the case that would otherwise stay silent forever.
    check({ ...locked, lockedUntil: null })
    check(locked)
    check(locked)

    expect(warn).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(warn.mock.calls[0])).toContain("DISABLE_LOGIN_LOCKOUT")
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
    // The argument to .set() must contain a failedLoginAttempts key built from a
    // drizzle sql`` expression, i.e. not a plain numeric literal, so that the
    // increment is atomic at the database level and avoids read-modify-write races.
    const setArg = chain.set.mock.calls[0][0] as Record<string, unknown>
    expect(setArg).toHaveProperty("failedLoginAttempts")
    expect(typeof setArg.failedLoginAttempts).not.toBe("number")
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
