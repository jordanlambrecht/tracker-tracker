// src/lib/__tests__/totp.test.ts

import { Secret, TOTP } from "otpauth"
import { describe, expect, it } from "vitest"
import {
  generateBackupCodes,
  generateTotpSecret,
  hashBackupCode,
  verifyAndConsumeBackupCode,
  verifyTotpCode,
} from "../totp"

// ---------------------------------------------------------------------------
// generateTotpSecret
// ---------------------------------------------------------------------------

describe("generateTotpSecret", () => {
  it("returns a base32 secret and otpauth URI", () => {
    const { secret, uri } = generateTotpSecret("testuser")
    expect(secret).toMatch(/^[A-Z2-7]+=*$/)
    expect(uri).toContain("otpauth://totp/")
    expect(uri).toContain("Tracker%20Tracker")
    expect(uri).toContain(`secret=${secret}`)
  })

  it("generates unique secrets on each call", () => {
    const a = generateTotpSecret("user")
    const b = generateTotpSecret("user")
    expect(a.secret).not.toBe(b.secret)
  })
})

// ---------------------------------------------------------------------------
// verifyTotpCode
// ---------------------------------------------------------------------------

describe("verifyTotpCode", () => {
  it("accepts a valid current code", () => {
    const { secret } = generateTotpSecret("test")
    const totp = new TOTP({
      secret: Secret.fromBase32(secret),
      algorithm: "SHA1",
      digits: 6,
      period: 30,
    })
    const code = totp.generate()
    expect(verifyTotpCode(secret, code)).toBe(true)
  })

  it("rejects a completely wrong code", () => {
    const { secret } = generateTotpSecret("test")
    expect(verifyTotpCode(secret, "000000")).toBe(false)
  })

  it("rejects non-numeric input", () => {
    const { secret } = generateTotpSecret("test")
    expect(verifyTotpCode(secret, "abcdef")).toBe(false)
  })

  it("rejects empty string", () => {
    const { secret } = generateTotpSecret("test")
    expect(verifyTotpCode(secret, "")).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// generateBackupCodes
// ---------------------------------------------------------------------------

describe("generateBackupCodes", () => {
  it("generates 8 codes", () => {
    const codes = generateBackupCodes()
    expect(codes).toHaveLength(8)
  })

  it("codes match XXXX-XXXX format", () => {
    const codes = generateBackupCodes()
    for (const code of codes) {
      expect(code).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}$/)
    }
  })

  it("generates unique codes", () => {
    const codes = generateBackupCodes()
    const unique = new Set(codes)
    expect(unique.size).toBe(codes.length)
  })
})

// ---------------------------------------------------------------------------
// hashBackupCode + verifyAndConsumeBackupCode
// ---------------------------------------------------------------------------

describe("hashBackupCode", () => {
  it("returns a hash, salt, and used=false", () => {
    const entry = hashBackupCode("ABCD-1234")
    expect(entry.hash).toMatch(/^[0-9a-f]{64}$/)
    expect(entry.salt).toMatch(/^[0-9a-f]{32}$/)
    expect(entry.used).toBe(false)
  })

  it("produces different hashes for the same code (random salt)", () => {
    const a = hashBackupCode("ABCD-1234")
    const b = hashBackupCode("ABCD-1234")
    expect(a.hash).not.toBe(b.hash)
    expect(a.salt).not.toBe(b.salt)
  })
})

describe("verifyAndConsumeBackupCode", () => {
  it("verifies a valid backup code and marks it used", () => {
    const code = "ABCD-EF01"
    const entry = hashBackupCode(code)
    const entries = [entry]

    const { valid, updatedEntries } = verifyAndConsumeBackupCode(code, entries)
    expect(valid).toBe(true)
    expect(updatedEntries[0].used).toBe(true)
  })

  it("accepts code without dashes", () => {
    const code = "ABCD-EF01"
    const entry = hashBackupCode(code)

    const { valid } = verifyAndConsumeBackupCode("ABCDEF01", [entry])
    expect(valid).toBe(true)
  })

  it("accepts lowercase input", () => {
    const code = "ABCD-EF01"
    const entry = hashBackupCode(code)

    const { valid } = verifyAndConsumeBackupCode("abcd-ef01", [entry])
    expect(valid).toBe(true)
  })

  it("rejects an invalid code", () => {
    const entry = hashBackupCode("ABCD-EF01")
    const { valid, updatedEntries } = verifyAndConsumeBackupCode("WRONG-CODE", [entry])
    expect(valid).toBe(false)
    expect(updatedEntries[0].used).toBe(false)
  })

  it("rejects an already-used code", () => {
    const code = "ABCD-EF01"
    const entry = { ...hashBackupCode(code), used: true }

    const { valid } = verifyAndConsumeBackupCode(code, [entry])
    expect(valid).toBe(false)
  })

  it("only marks the matched code as used, not others", () => {
    const codes = ["AAAA-1111", "BBBB-2222", "CCCC-3333"]
    const entries = codes.map((c) => hashBackupCode(c))

    const { valid, updatedEntries } = verifyAndConsumeBackupCode("BBBB-2222", entries)
    expect(valid).toBe(true)
    expect(updatedEntries[0].used).toBe(false)
    expect(updatedEntries[1].used).toBe(true)
    expect(updatedEntries[2].used).toBe(false)
  })

  it("returns valid=false when all codes are used", () => {
    const code = "ABCD-EF01"
    const entry = { ...hashBackupCode(code), used: true }
    const { valid } = verifyAndConsumeBackupCode(code, [entry])
    expect(valid).toBe(false)
  })

  it("works with a full set of generated codes", () => {
    const codes = generateBackupCodes()
    const entries = codes.map((c) => hashBackupCode(c))

    // Verify the 5th code
    const { valid, updatedEntries } = verifyAndConsumeBackupCode(codes[4], entries)
    expect(valid).toBe(true)
    expect(updatedEntries[4].used).toBe(true)

    // Same code should now fail
    const second = verifyAndConsumeBackupCode(codes[4], updatedEntries)
    expect(second.valid).toBe(false)

    // Different unused code should still work
    const third = verifyAndConsumeBackupCode(codes[0], updatedEntries)
    expect(third.valid).toBe(true)
  })
})
