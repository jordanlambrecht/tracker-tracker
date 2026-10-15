// src/lib/tracker-platforms/__tests__/html-parse.test.ts
//
// tryParseSiteBytes returns undefined rather than throwing, so a unit it fails
// to recognise reads as "the tracker does not report this" instead of raising.
// That makes a gap in the unit table silent, which is what these cases pin.

import { describe, expect, it } from "vitest"
import { parseBytes } from "@/lib/parser"
import {
  datePrefix,
  normalizeWhitespace,
  tryParseCount,
  tryParseSiteBytes,
} from "../helpers/html-parse"

describe("tryParseSiteBytes", () => {
  it("parses the decimal units, whatever case the site prints", () => {
    expect(tryParseSiteBytes("1 GB")).toBe(parseBytes("1 GB"))
    expect(tryParseSiteBytes("5 kB")).toBe(parseBytes("5 KB"))
    expect(tryParseSiteBytes("2 tb")).toBe(parseBytes("2 TB"))
  })

  it("parses the IEC binary units, which a blanket uppercase silently dropped", () => {
    expect(tryParseSiteBytes("1 KiB")).toBe(parseBytes("1 KiB"))
    expect(tryParseSiteBytes("1 MiB")).toBe(parseBytes("1 MiB"))
    expect(tryParseSiteBytes("1 GiB")).toBe(parseBytes("1 GiB"))
    expect(tryParseSiteBytes("1 TiB")).toBe(parseBytes("1 TiB"))
    expect(tryParseSiteBytes("3 gib")).toBe(parseBytes("3 GiB"))
  })

  it("keeps binary and decimal units distinct rather than collapsing them", () => {
    expect(tryParseSiteBytes("1 GiB")).toBe(1073741824n)
    expect(tryParseSiteBytes("1 GB")).toBe(1000000000n)
  })

  it("strips grouping commas, which parseBytes rejects outright", () => {
    expect(tryParseSiteBytes("1,234.5 GB")).toBe(parseBytes("1234.5 GB"))
    expect(() => parseBytes("1,234.5 GB")).toThrow()
  })

  it("returns undefined for a unit that is not a byte unit at all", () => {
    expect(tryParseSiteBytes("12 posts")).toBeUndefined()
    expect(tryParseSiteBytes("1 XB")).toBeUndefined()
    expect(tryParseSiteBytes("")).toBeUndefined()
    expect(tryParseSiteBytes("N/A")).toBeUndefined()
  })
})

describe("normalizeWhitespace", () => {
  it("collapses the non-breaking space that labels arrive with", () => {
    expect(normalizeWhitespace("Join date")).toBe("Join date")
    expect(normalizeWhitespace("  a \n\t b  ")).toBe("a b")
  })
})

describe("datePrefix", () => {
  it("keeps the date and drops the time and the relative suffix", () => {
    expect(datePrefix("2026-08-20 19:05:17 (1 week ago)")).toBe("2026-08-20")
  })

  it("returns undefined when the value does not start with a date", () => {
    expect(datePrefix("never")).toBeUndefined()
    expect(datePrefix("20-08-2026")).toBeUndefined()
  })
})

describe("tryParseCount", () => {
  it("reads a zero the site printed as a zero", () => {
    // A real 0 has to survive, or it cannot be told from a row that was absent.
    expect(tryParseCount("0")).toBe(0)
  })

  it("strips grouping commas", () => {
    expect(tryParseCount("1,234")).toBe(1234)
    expect(tryParseCount("1,234,567")).toBe(1234567)
  })

  it("keeps a fractional value, because a bonus rate is one", () => {
    expect(tryParseCount("12.5")).toBe(12.5)
    expect(tryParseCount("1,234.56")).toBe(1234.56)
  })

  it("keeps a negative, which a buffer-style figure can be", () => {
    expect(tryParseCount("-5")).toBe(-5)
  })

  it("takes the first number in the text, wherever it sits", () => {
    // A label in front of the number does not hide it.
    expect(tryParseCount("Seeding: 42")).toBe(42)
    expect(tryParseCount("42 torrents")).toBe(42)
    expect(tryParseCount(" 7 ")).toBe(7)
  })

  it("returns undefined, not a zero, when the text carries no number", () => {
    // Returning 0 here is the bug the null versus zero rule exists for.
    expect(tryParseCount("")).toBeUndefined()
    expect(tryParseCount("N/A")).toBeUndefined()
    expect(tryParseCount("never")).toBeUndefined()
    expect(tryParseCount("-")).toBeUndefined()
    // A lone separator matches the digit-or-comma class but parses to nothing.
    expect(tryParseCount(",")).toBeUndefined()
  })

  it("treats an absent value the same as an unparseable one", () => {
    // BTN hands it an optional API field rather than scraped text.
    expect(tryParseCount(undefined)).toBeUndefined()
    expect(tryParseCount(null)).toBeUndefined()
  })

  it("returns undefined rather than null, so platformMeta drops the key", () => {
    // platformMeta is stringified into the trackers row, so a null here would
    // write the key back on every poll.
    expect(JSON.stringify({ invites: tryParseCount("N/A") })).toBe("{}")
    expect(JSON.stringify({ invites: tryParseCount("3") })).toBe('{"invites":3}')
  })
})
