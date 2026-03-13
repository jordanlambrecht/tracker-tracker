// src/app/api/auth/auth-security-routes.test.ts
//
// Functions: makeSelectChain, makeUpdateChain

import { beforeEach, describe, expect, it, vi } from "vitest"
import { db } from "@/lib/db"
import { createPendingToken, createSession, verifyPassword, verifyPendingToken } from "@/lib/auth"
import { decrypt, deriveKey } from "@/lib/crypto"
import { startScheduler } from "@/lib/scheduler"
import { verifyAndConsumeBackupCode, verifyTotpCode } from "@/lib/totp"
import { recordFailedAttempt, resetFailedAttempts, WIPE_MESSAGE } from "@/lib/wipe"

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock("@/lib/db/schema", () => ({
  appSettings: {},
}))

vi.mock("@/lib/auth", () => ({
  verifyPassword: vi.fn(),
  createPendingToken: vi.fn(),
  verifyPendingToken: vi.fn(),
  createSession: vi.fn(),
}))

vi.mock("@/lib/crypto", () => ({
  deriveKey: vi.fn(),
  decrypt: vi.fn(),
  encrypt: vi.fn((value: string) => `encrypted:${value}`),
}))

vi.mock("@/lib/scheduler", () => ({
  startScheduler: vi.fn(),
}))

vi.mock("@/lib/totp", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/totp")>()
  return {
    ...actual,
    verifyTotpCode: vi.fn(),
    verifyAndConsumeBackupCode: vi.fn(),
  }
})

vi.mock("@/lib/wipe", () => ({
  recordFailedAttempt: vi.fn().mockResolvedValue(false),
  resetFailedAttempts: vi.fn().mockResolvedValue(undefined),
  WIPE_MESSAGE: "Too many failed attempts. All data has been deleted.",
}))

function makeSelectChain(result: unknown) {
  const limit = vi.fn().mockResolvedValue(result)
  const from = vi.fn().mockReturnValue({ limit })
  ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from })
}

function makeUpdateChain() {
  const where = vi.fn().mockResolvedValue(undefined)
  const set = vi.fn().mockReturnValue({ where })
  ;(db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set })
  return { set, where }
}

describe("auth abuse defenses", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(recordFailedAttempt as ReturnType<typeof vi.fn>).mockResolvedValue(false)
    ;(resetFailedAttempts as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
  })

  it("returns the same generic login error for wrong username and wrong password", async () => {
    const settings = {
      id: 1,
      username: "admin",
      passwordHash: "hash",
      encryptionSalt: "salt",
      autoWipeThreshold: null,
      lockedUntil: null,
      totpSecret: null,
      sessionTimeoutMinutes: null,
    }
    makeSelectChain([settings])
    ;(verifyPassword as ReturnType<typeof vi.fn>).mockResolvedValue(false)

    const { POST } = await import("./login/route")

    const wrongUsernameResponse = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "intruder", password: "correct-password" }),
      })
    )

    const wrongPasswordResponse = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "admin", password: "wrong-password" }),
      })
    )

    await expect(wrongUsernameResponse.json()).resolves.toEqual({ error: "Invalid credentials" })
    await expect(wrongPasswordResponse.json()).resolves.toEqual({ error: "Invalid credentials" })
    expect(wrongUsernameResponse.status).toBe(401)
    expect(wrongPasswordResponse.status).toBe(401)
    expect(verifyPassword).toHaveBeenCalledTimes(2)
    expect(recordFailedAttempt).toHaveBeenCalledTimes(2)
  })

  it("returns a pending token for TOTP-enabled logins without creating a session early", async () => {
    const settings = {
      id: 1,
      passwordHash: "hash",
      encryptionSalt: "salt",
      autoWipeThreshold: 5,
      lockedUntil: null,
      totpSecret: "encrypted-secret",
      sessionTimeoutMinutes: 90,
    }
    makeSelectChain([settings])
    ;(verifyPassword as ReturnType<typeof vi.fn>).mockResolvedValue(true)
    ;(deriveKey as ReturnType<typeof vi.fn>).mockResolvedValue(Buffer.from("a".repeat(32)))
    ;(createPendingToken as ReturnType<typeof vi.fn>).mockResolvedValue("pending-token")

    const { POST } = await import("./login/route")
    const response = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "correct-password" }),
      })
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ requiresTotp: true, pendingToken: "pending-token" })
    expect(createSession).not.toHaveBeenCalled()
    expect(startScheduler).not.toHaveBeenCalled()
    expect(resetFailedAttempts).not.toHaveBeenCalled()
  })

  it("rejects invalid TOTP codes and records the failed attempt", async () => {
    makeSelectChain([
      {
        id: 1,
        totpSecret: "encrypted-secret",
        autoWipeThreshold: 3,
        lockedUntil: null,
        sessionTimeoutMinutes: 30,
      },
    ])
    ;(verifyPendingToken as ReturnType<typeof vi.fn>).mockResolvedValue({ encryptionKey: "a".repeat(64) })
    ;(decrypt as ReturnType<typeof vi.fn>).mockReturnValue("totp-secret")
    ;(verifyTotpCode as ReturnType<typeof vi.fn>).mockReturnValue(false)

    const { POST } = await import("./totp/verify/route")
    const response = await POST(
      new Request("http://localhost/api/auth/totp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendingToken: "pending-token", code: "123456" }),
      })
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: "Invalid TOTP code" })
    expect(recordFailedAttempt).toHaveBeenCalledWith(1, 3)
    expect(createSession).not.toHaveBeenCalled()
  })

  it("consumes a valid backup code and creates a session", async () => {
    makeSelectChain([
      {
        id: 1,
        totpSecret: "encrypted-secret",
        totpBackupCodes: "encrypted-codes",
        autoWipeThreshold: 3,
        lockedUntil: null,
        sessionTimeoutMinutes: 45,
      },
    ])
    const { set } = makeUpdateChain()
    ;(verifyPendingToken as ReturnType<typeof vi.fn>).mockResolvedValue({ encryptionKey: "b".repeat(64) })
    ;(decrypt as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify([{ hash: "x", salt: "y", used: false }]))
    ;(verifyAndConsumeBackupCode as ReturnType<typeof vi.fn>).mockReturnValue({
      valid: true,
      updatedEntries: [{ hash: "x", salt: "y", used: true }],
    })

    const { POST } = await import("./totp/verify/route")
    const response = await POST(
      new Request("http://localhost/api/auth/totp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendingToken: "pending-token", code: "ABCD-1234", isBackupCode: true }),
      })
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true })
    expect(set).toHaveBeenCalledWith({ totpBackupCodes: "encrypted:[{\"hash\":\"x\",\"salt\":\"y\",\"used\":true}]" })
    expect(resetFailedAttempts).toHaveBeenCalledWith(1)
    expect(createSession).toHaveBeenCalledWith("b".repeat(64), 45)
    expect(startScheduler).toHaveBeenCalledWith(Buffer.from("b".repeat(64), "hex"))
  })

  it("returns the wipe message when TOTP failures reach the threshold", async () => {
    makeSelectChain([
      {
        id: 1,
        totpSecret: "encrypted-secret",
        autoWipeThreshold: 1,
        lockedUntil: null,
      },
    ])
    ;(verifyPendingToken as ReturnType<typeof vi.fn>).mockResolvedValue({ encryptionKey: "c".repeat(64) })
    ;(decrypt as ReturnType<typeof vi.fn>).mockReturnValue("totp-secret")
    ;(verifyTotpCode as ReturnType<typeof vi.fn>).mockReturnValue(false)
    ;(recordFailedAttempt as ReturnType<typeof vi.fn>).mockResolvedValue(true)

    const { POST } = await import("./totp/verify/route")
    const response = await POST(
      new Request("http://localhost/api/auth/totp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendingToken: "pending-token", code: "654321" }),
      })
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: WIPE_MESSAGE })
  })

  it("returns 429 when lockedUntil is in the future (login)", async () => {
    const futureDate = new Date(Date.now() + 60_000)
    const settings = {
      id: 1,
      username: "admin",
      passwordHash: "hash",
      encryptionSalt: "salt",
      autoWipeThreshold: null,
      lockedUntil: futureDate,
      totpSecret: null,
      sessionTimeoutMinutes: null,
    }
    makeSelectChain([settings])

    const { POST } = await import("./login/route")
    const response = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "admin", password: "test" }),
      })
    )

    expect(response.status).toBe(429)
    const body = await response.json()
    expect(body.error).toMatch(/Too many failed attempts/)
    expect(body.retryAfter).toBeGreaterThan(0)
    expect(response.headers.get("Retry-After")).toBeTruthy()
    expect(verifyPassword).not.toHaveBeenCalled()
  })

  it("returns 429 when lockedUntil is in the future (TOTP verify)", async () => {
    const futureDate = new Date(Date.now() + 120_000)
    const settings = [
      {
        id: 1,
        passwordHash: "hash",
        encryptionSalt: "salt",
        autoWipeThreshold: 5,
        lockedUntil: futureDate,
        totpSecret: "encrypted-secret",
        sessionTimeoutMinutes: 90,
      },
    ]
    ;(verifyPendingToken as ReturnType<typeof vi.fn>).mockResolvedValue({ encryptionKey: "c".repeat(64) })
    makeSelectChain(settings)

    const { POST } = await import("./totp/verify/route")
    const response = await POST(
      new Request("http://localhost/api/auth/totp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendingToken: "pending-token", code: "123456" }),
      })
    )

    expect(response.status).toBe(429)
    const body = await response.json()
    expect(body.error).toMatch(/Too many failed attempts/)
    expect(body.retryAfter).toBeGreaterThan(0)
  })
})