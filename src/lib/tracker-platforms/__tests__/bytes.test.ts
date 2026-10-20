// src/lib/tracker-platforms/__tests__/bytes.test.ts
//
// floatBytesToBigInt answers 0n for null, so a byte field declared required
// goes through requireBytes. These cases pin that an absent total fails the poll.

import { describe, expect, it } from "vitest"
import { requireBytes } from "../helpers/bytes"

const HOST = "tracker.example"

describe("requireBytes", () => {
  it("converts a reported total", () => {
    expect(requireBytes(1_000_000, "uploaded", HOST)).toBe(1_000_000n)
  })

  it("keeps a reported zero, which is a real figure", () => {
    // A brand new account has genuinely uploaded nothing. Rejecting this would
    // be the same mistake in the other direction.
    expect(requireBytes(0, "uploaded", HOST)).toBe(0n)
  })

  it("floors a fractional byte count", () => {
    expect(requireBytes(1.9, "uploaded", HOST)).toBe(1n)
  })

  it("clamps a negative total to zero", () => {
    // Matches floatBytesToBigInt. Only `buffer` is signed, and it does not come
    // through here.
    expect(requireBytes(-5, "uploaded", HOST)).toBe(0n)
  })

  it("refuses an absent total rather than reading it as zero", () => {
    expect(() => requireBytes(undefined, "uploaded", HOST)).toThrow(
      `Unexpected response from ${HOST}: missing uploaded`
    )
    expect(() => requireBytes(null, "downloaded", HOST)).toThrow(
      `Unexpected response from ${HOST}: missing downloaded`
    )
  })

  it("refuses a value that is not a number", () => {
    // The declared type says number. Nothing enforces that on the wire.
    expect(() => requireBytes("1000", "uploaded", HOST)).toThrow(
      `Unexpected response from ${HOST}: non-numeric uploaded`
    )
    expect(() => requireBytes({}, "uploaded", HOST)).toThrow("non-numeric uploaded")
  })

  it("refuses NaN and Infinity, which BigInt() would throw a RangeError on", () => {
    expect(() => requireBytes(Number.NaN, "uploaded", HOST)).toThrow("non-numeric uploaded")
    expect(() => requireBytes(Number.POSITIVE_INFINITY, "uploaded", HOST)).toThrow(
      "non-numeric uploaded"
    )
  })

  it("names the host, so the card can say which tracker answered oddly", () => {
    expect(() => requireBytes(null, "uploaded", "other.example")).toThrow("other.example")
  })
})
