// src/lib/__tests__/validators.test.ts
import { describe, expect, it } from "vitest"
import { isIntegerInRange, isValidHex, isValidPort, parseIntClamped } from "@/lib/validators"

describe("isValidHex", () => {
  describe("strict mode (default)", () => {
    it("accepts a lowercase 6-digit hex", () => {
      expect(isValidHex("#000000")).toBe(true)
    })

    it("accepts an uppercase 6-digit hex", () => {
      expect(isValidHex("#FFFFFF")).toBe(true)
    })

    it("accepts a mixed-case 6-digit hex", () => {
      expect(isValidHex("#aAbBcC")).toBe(true)
    })

    it("rejects a 3-digit shorthand hex", () => {
      expect(isValidHex("#fff")).toBe(false)
    })

    it("rejects a 4-digit hex", () => {
      expect(isValidHex("#ffff")).toBe(false)
    })

    it("rejects an 8-digit hex with alpha", () => {
      expect(isValidHex("#ffffffaa")).toBe(false)
    })

    it("rejects a hex without leading hash", () => {
      expect(isValidHex("fff000")).toBe(false)
    })

    it("rejects an empty string", () => {
      expect(isValidHex("")).toBe(false)
    })

    it("rejects non-hex characters in the value", () => {
      expect(isValidHex("#gggggg")).toBe(false)
    })

    it("rejects a named color string", () => {
      expect(isValidHex("red")).toBe(false)
    })
  })

  describe("permissive mode", () => {
    it("accepts a 3-digit shorthand hex", () => {
      expect(isValidHex("#fff", true)).toBe(true)
    })

    it("accepts a 4-digit shorthand hex with alpha", () => {
      expect(isValidHex("#ffff", true)).toBe(true)
    })

    it("accepts a 6-digit hex", () => {
      expect(isValidHex("#ffffff", true)).toBe(true)
    })

    it("accepts an 8-digit hex with alpha", () => {
      expect(isValidHex("#ffffffaa", true)).toBe(true)
    })

    it("rejects a hex without leading hash", () => {
      expect(isValidHex("fff", true)).toBe(false)
    })

    it("rejects an empty string", () => {
      expect(isValidHex("", true)).toBe(false)
    })

    it("rejects non-hex characters", () => {
      expect(isValidHex("#gg", true)).toBe(false)
    })

    it("rejects a 5-digit hex (invalid length)", () => {
      expect(isValidHex("#12345", true)).toBe(false)
    })

    it("rejects a named color string", () => {
      expect(isValidHex("red", true)).toBe(false)
    })

    it("rejects a 1-digit hex (invalid length)", () => {
      expect(isValidHex("#1", true)).toBe(false)
    })
  })
})

describe("isValidPort", () => {
  it("accepts the minimum valid port (1)", () => {
    expect(isValidPort(1)).toBe(true)
  })

  it("accepts port 80", () => {
    expect(isValidPort(80)).toBe(true)
  })

  it("accepts port 443", () => {
    expect(isValidPort(443)).toBe(true)
  })

  it("accepts a common application port (8080)", () => {
    expect(isValidPort(8080)).toBe(true)
  })

  it("accepts the maximum valid port (65535)", () => {
    expect(isValidPort(65535)).toBe(true)
  })

  it("rejects port 0 (below minimum)", () => {
    expect(isValidPort(0)).toBe(false)
  })

  it("rejects a negative port", () => {
    expect(isValidPort(-1)).toBe(false)
  })

  it("rejects a port above the maximum (65536)", () => {
    expect(isValidPort(65536)).toBe(false)
  })

  it("rejects a fractional port number", () => {
    expect(isValidPort(1.5)).toBe(false)
  })

  it("rejects NaN", () => {
    expect(isValidPort(NaN)).toBe(false)
  })

  it("rejects Infinity", () => {
    expect(isValidPort(Infinity)).toBe(false)
  })
})

describe("isIntegerInRange", () => {
  it("accepts the minimum boundary value", () => {
    expect(isIntegerInRange(1, 1, 100)).toBe(true)
  })

  it("accepts the maximum boundary value", () => {
    expect(isIntegerInRange(100, 1, 100)).toBe(true)
  })

  it("accepts a value in the middle of the range", () => {
    expect(isIntegerInRange(50, 1, 100)).toBe(true)
  })

  it("rejects a value below the minimum", () => {
    expect(isIntegerInRange(0, 1, 100)).toBe(false)
  })

  it("rejects a value above the maximum", () => {
    expect(isIntegerInRange(101, 1, 100)).toBe(false)
  })

  it("rejects a fractional value", () => {
    expect(isIntegerInRange(1.5, 1, 100)).toBe(false)
  })

  it("rejects NaN", () => {
    expect(isIntegerInRange(NaN, 1, 100)).toBe(false)
  })

  it("rejects Infinity", () => {
    expect(isIntegerInRange(Infinity, 1, 100)).toBe(false)
  })

  it("accepts 0 when 0 is within range", () => {
    expect(isIntegerInRange(0, -10, 10)).toBe(true)
  })

  it("accepts negative integers within a negative range", () => {
    expect(isIntegerInRange(-5, -10, -1)).toBe(true)
  })

  it("accepts a value when min equals max (single-value range)", () => {
    expect(isIntegerInRange(42, 42, 42)).toBe(true)
  })

  it("rejects a value outside a single-value range", () => {
    expect(isIntegerInRange(43, 42, 42)).toBe(false)
  })
})

describe("parseIntClamped", () => {
  it("defaults to fallback when null", () => {
    expect(parseIntClamped(null, 1, 3650, 30)).toBe(30)
  })

  it("defaults to fallback for non-numeric strings", () => {
    expect(parseIntClamped("abc", 1, 3650, 30)).toBe(30)
    expect(parseIntClamped("", 1, 3650, 30)).toBe(30)
  })

  it("parses valid numeric strings", () => {
    expect(parseIntClamped("7", 1, 3650, 30)).toBe(7)
    expect(parseIntClamped("90", 1, 3650, 30)).toBe(90)
  })

  it("clamps to minimum", () => {
    expect(parseIntClamped("0", 1, 3650, 30)).toBe(1)
    expect(parseIntClamped("-5", 1, 3650, 30)).toBe(1)
  })

  it("clamps to maximum", () => {
    expect(parseIntClamped("3651", 1, 3650, 30)).toBe(3650)
    expect(parseIntClamped("999999", 1, 3650, 30)).toBe(3650)
  })

  it("truncates decimals via parseInt", () => {
    expect(parseIntClamped("7.9", 1, 3650, 30)).toBe(7)
  })

  it("works with different min/max/default", () => {
    expect(parseIntClamped(null, 0, 100, 50)).toBe(50)
    expect(parseIntClamped("200", 0, 100, 50)).toBe(100)
    expect(parseIntClamped("-1", 0, 100, 50)).toBe(0)
  })
})
