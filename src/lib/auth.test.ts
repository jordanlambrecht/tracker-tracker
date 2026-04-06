// src/lib/auth.test.ts
import { describe, expect, it } from "vitest"
import { hashPassword, verifyPassword } from "./auth"

describe("password hashing", () => {
  it("hashes and verifies a password", async () => {
    const hash = await hashPassword("test-password-123")
    const valid = await verifyPassword(hash, "test-password-123")
    expect(valid).toBe(true)
  })

  it("rejects wrong password", async () => {
    const hash = await hashPassword("correct-password")
    const valid = await verifyPassword(hash, "wrong-password")
    expect(valid).toBe(false)
  })

  it("produces different hashes for same password (salted)", async () => {
    const hash1 = await hashPassword("same-password")
    const hash2 = await hashPassword("same-password")
    expect(hash1).not.toBe(hash2)
  })

  it("hash is not plaintext", async () => {
    const password = "my-secret-password"
    const hash = await hashPassword(password)
    expect(hash).not.toContain(password)
    expect(hash).toMatch(/^\$argon2/) // argon2 hash format
  })
})

describe("auth - security", () => {
  it("handles empty password for hashing", async () => {
    // Should still hash (validation is at the API layer)
    const hash = await hashPassword("")
    expect(hash).toMatch(/^\$argon2/)
  })

  it("handles very long passwords", async () => {
    const longPass = "a".repeat(10000)
    const hash = await hashPassword(longPass)
    const valid = await verifyPassword(hash, longPass)
    expect(valid).toBe(true)
  })

  it("handles unicode passwords", async () => {
    const unicodePass = "pässwörd-日本語-🔐"
    const hash = await hashPassword(unicodePass)
    const valid = await verifyPassword(hash, unicodePass)
    expect(valid).toBe(true)
  })
})
