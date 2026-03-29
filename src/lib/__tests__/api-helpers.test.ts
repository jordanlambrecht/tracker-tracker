// src/lib/__tests__/api-helpers.test.ts

import { describe, expect, it, vi } from "vitest"
import { validateIntRange, validateMaxLength } from "@/lib/api-helpers"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      body,
      status: init?.status ?? 200,
    }),
  },
}))

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}))

vi.mock("@/lib/network", () => ({
  isUnsafeNetworkHost: vi.fn().mockReturnValue(false),
}))

// ---------------------------------------------------------------------------
// validateIntRange
// ---------------------------------------------------------------------------

describe("validateIntRange", () => {
  describe("valid inputs (returns null)", () => {
    it("should return null for a value within range", () => {
      const result = validateIntRange(5, 1, 10, "Field")
      expect(result).toBeNull()
    })

    it("should return null for value at minimum boundary", () => {
      const result = validateIntRange(1, 1, 10, "Field")
      expect(result).toBeNull()
    })

    it("should return null for value at maximum boundary", () => {
      const result = validateIntRange(10, 1, 10, "Field")
      expect(result).toBeNull()
    })
  })

  describe("invalid inputs (returns NextResponse)", () => {
    it("should return error response for value below minimum", () => {
      const result = validateIntRange(0, 1, 10, "Field") as unknown as { body: { error: string }; status: number }
      expect(result).not.toBeNull()
      expect(result.status).toBe(400)
      expect(result.body.error).toContain("between 1 and 10")
    })

    it("should return error response for value above maximum", () => {
      const result = validateIntRange(11, 1, 10, "Field") as unknown as { body: { error: string }; status: number }
      expect(result).not.toBeNull()
      expect(result.status).toBe(400)
      expect(result.body.error).toContain("between 1 and 10")
    })

    it("should return error response for a float (non-integer)", () => {
      const result = validateIntRange(1.5, 1, 10, "Field") as unknown as { body: { error: string }; status: number }
      expect(result).not.toBeNull()
      expect(result.status).toBe(400)
    })

    it("should return error response for NaN", () => {
      const result = validateIntRange(NaN, 1, 10, "Field") as unknown as { body: { error: string }; status: number }
      expect(result).not.toBeNull()
      expect(result.status).toBe(400)
    })

    it("should include the label in the error message", () => {
      const result = validateIntRange(0, 1, 10, "PollInterval") as unknown as { body: { error: string }; status: number }
      expect(result.body.error).toContain("PollInterval")
    })
  })
})

// ---------------------------------------------------------------------------
// validateMaxLength
// ---------------------------------------------------------------------------

describe("validateMaxLength", () => {
  describe("valid inputs (returns null)", () => {
    it("should return null for a string under the limit", () => {
      const result = validateMaxLength("hello", 10, "Name")
      expect(result).toBeNull()
    })

    it("should return null for a string exactly at the limit", () => {
      const result = validateMaxLength("1234567890", 10, "Name")
      expect(result).toBeNull()
    })

    it("should return null for an empty string", () => {
      const result = validateMaxLength("", 10, "Name")
      expect(result).toBeNull()
    })
  })

  describe("invalid inputs (returns NextResponse)", () => {
    it("should return error response for a string exceeding the limit", () => {
      const result = validateMaxLength("12345678901", 10, "Name") as unknown as { body: { error: string }; status: number }
      expect(result).not.toBeNull()
      expect(result.status).toBe(400)
      expect(result.body.error).toContain("10 characters or fewer")
    })

    it("should include the label in the error message", () => {
      const result = validateMaxLength("this string is way too long", 10, "TrackerName") as unknown as { body: { error: string }; status: number }
      expect(result.body.error).toContain("TrackerName")
    })
  })
})
