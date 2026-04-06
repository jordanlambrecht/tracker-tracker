// src/lib/__tests__/api-helpers.test.ts

import { describe, expect, it } from "vitest"
import { validateIntRange, validateMaxLength } from "@/lib/api-helpers"

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
    it("should return error response for value below minimum", async () => {
      const result = validateIntRange(0, 1, 10, "Field")
      expect(result).not.toBeNull()
      if (!result) return
      expect(result.status).toBe(400)
      const data = await result.json()
      expect(data.error).toContain("between 1 and 10")
    })

    it("should return error response for value above maximum", async () => {
      const result = validateIntRange(11, 1, 10, "Field")
      expect(result).not.toBeNull()
      if (!result) return
      expect(result.status).toBe(400)
      const data = await result.json()
      expect(data.error).toContain("between 1 and 10")
    })

    it("should return error response for a float (non-integer)", async () => {
      const result = validateIntRange(1.5, 1, 10, "Field")
      expect(result).not.toBeNull()
      if (!result) return
      expect(result.status).toBe(400)
    })

    it("should return error response for NaN", async () => {
      const result = validateIntRange(NaN, 1, 10, "Field")
      expect(result).not.toBeNull()
      if (!result) return
      expect(result.status).toBe(400)
    })

    it("should include the label in the error message", async () => {
      const result = validateIntRange(0, 1, 10, "PollInterval")
      expect(result).not.toBeNull()
      if (!result) return
      const data = await result.json()
      expect(data.error).toContain("PollInterval")
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
    it("should return error response for a string exceeding the limit", async () => {
      const result = validateMaxLength("12345678901", 10, "Name")
      expect(result).not.toBeNull()
      if (!result) return
      expect(result.status).toBe(400)
      const data = await result.json()
      expect(data.error).toContain("10 characters or fewer")
    })

    it("should include the label in the error message", async () => {
      const result = validateMaxLength("this string is way too long", 10, "TrackerName")
      expect(result).not.toBeNull()
      if (!result) return
      const data = await result.json()
      expect(data.error).toContain("TrackerName")
    })
  })
})
