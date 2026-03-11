// src/lib/__tests__/privacy.test.ts
import { describe, expect, it } from "vitest"
import { isRedacted, maskUsername, REDACTED_PREFIX, redactedLength } from "../privacy"

describe("maskUsername", () => {
  it("returns null for null input", () => {
    expect(maskUsername(null)).toBeNull()
  })

  it("returns null for undefined input", () => {
    expect(maskUsername(undefined)).toBeNull()
  })

  it("returns a redacted marker with character count", () => {
    expect(maskUsername("JohnDoe")).toBe(`${REDACTED_PREFIX}7`)
  })

  it("preserves length for short usernames", () => {
    expect(maskUsername("ab")).toBe(`${REDACTED_PREFIX}2`)
  })

  it("preserves length for long usernames", () => {
    expect(maskUsername("a".repeat(50))).toBe(`${REDACTED_PREFIX}50`)
  })

  it("counts spaces and special characters", () => {
    expect(maskUsername("Power User")).toBe(`${REDACTED_PREFIX}10`)
  })
})

describe("isRedacted", () => {
  it("returns false for null", () => {
    expect(isRedacted(null)).toBe(false)
  })

  it("returns false for undefined", () => {
    expect(isRedacted(undefined)).toBe(false)
  })

  it("returns false for normal text", () => {
    expect(isRedacted("JohnDoe")).toBe(false)
  })

  it("returns true for a redacted marker", () => {
    expect(isRedacted(`${REDACTED_PREFIX}7`)).toBe(true)
  })

  it("returns false for empty string", () => {
    expect(isRedacted("")).toBe(false)
  })
})

describe("redactedLength", () => {
  it("returns null for null", () => {
    expect(redactedLength(null)).toBeNull()
  })

  it("returns null for non-redacted text", () => {
    expect(redactedLength("JohnDoe")).toBeNull()
  })

  it("extracts the character count from a redacted marker", () => {
    expect(redactedLength(`${REDACTED_PREFIX}7`)).toBe(7)
  })

  it("handles double-digit counts", () => {
    expect(redactedLength(`${REDACTED_PREFIX}42`)).toBe(42)
  })

  it("returns null for prefix with no number", () => {
    expect(redactedLength(REDACTED_PREFIX)).toBeNull()
  })
})
