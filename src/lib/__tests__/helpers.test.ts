// src/lib/__tests__/helpers.test.ts

import { describe, expect, it } from "vitest"
import { localDateStr } from "@/lib/formatters"
import {
  compareBigIntDesc,
  computePctChange,
  extractApiError,
  isUnixTimestampOnDate,
  normalizeUrl,
  sanitizeHost,
} from "@/lib/helpers"

// ---------------------------------------------------------------------------
// sanitizeHost
// ---------------------------------------------------------------------------

describe("sanitizeHost", () => {
  it("strips https:// prefix", () => {
    expect(sanitizeHost("https://example.com")).toBe("example.com")
  })

  it("strips http:// prefix", () => {
    expect(sanitizeHost("http://example.com")).toBe("example.com")
  })

  it("trims whitespace then strips protocol", () => {
    expect(sanitizeHost("  https://example.com  ")).toBe("example.com")
  })

  it("passes through a host with no protocol unchanged", () => {
    expect(sanitizeHost("example.com")).toBe("example.com")
  })

  it("does not strip non-http protocols", () => {
    expect(sanitizeHost("ftp://example.com")).toBe("ftp://example.com")
  })
})

// ---------------------------------------------------------------------------
// normalizeUrl
// ---------------------------------------------------------------------------

describe("normalizeUrl", () => {
  it("lowercases the URL", () => {
    expect(normalizeUrl("HTTPS://FOO.COM")).toBe("https://foo.com")
  })

  it("strips a single trailing slash", () => {
    expect(normalizeUrl("https://Example.com/")).toBe("https://example.com")
  })

  it("strips multiple trailing slashes", () => {
    expect(normalizeUrl("https://example.com///")).toBe("https://example.com")
  })

  it("returns the URL unchanged when already normalized", () => {
    expect(normalizeUrl("https://example.com")).toBe("https://example.com")
  })
})

// ---------------------------------------------------------------------------
// extractApiError
// ---------------------------------------------------------------------------

describe("extractApiError", () => {
  it("returns the error field from a JSON response", async () => {
    const res = new Response(JSON.stringify({ error: "Bad request" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
    expect(await extractApiError(res)).toBe("Bad request")
  })

  it("returns the default fallback when error field is undefined", async () => {
    const res = new Response(JSON.stringify({ error: undefined }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
    expect(await extractApiError(res)).toBe("Request failed")
  })

  it("returns the default fallback when JSON has no error field", async () => {
    const res = new Response(JSON.stringify({}), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
    expect(await extractApiError(res)).toBe("Request failed")
  })

  it("returns the default fallback on invalid JSON", async () => {
    const res = new Response("not json", {
      status: 500,
    })
    expect(await extractApiError(res)).toBe("Request failed")
  })

  it("returns a custom fallback string when provided", async () => {
    const res = new Response("not json", { status: 503 })
    expect(await extractApiError(res, "Service unavailable")).toBe("Service unavailable")
  })
})

// ---------------------------------------------------------------------------
// compareBigIntDesc
// ---------------------------------------------------------------------------

describe("compareBigIntDesc", () => {
  it("returns 1 when b > a (a sorts after b in descending order)", () => {
    expect(compareBigIntDesc(1n, 2n)).toBe(1)
  })

  it("returns -1 when b < a (a sorts before b in descending order)", () => {
    expect(compareBigIntDesc(2n, 1n)).toBe(-1)
  })

  it("returns 0 when a and b are equal", () => {
    expect(compareBigIntDesc(1n, 1n)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// computePctChange
// ---------------------------------------------------------------------------

describe("computePctChange", () => {
  it("returns 100 for a value that doubled", () => {
    expect(computePctChange("200", "100")).toBe(100)
  })

  it("returns -50 for a value that halved", () => {
    expect(computePctChange("100", "200")).toBe(-50)
  })

  it("returns null when yesterday is null", () => {
    expect(computePctChange("100", null)).toBeNull()
  })

  it("returns null when yesterday is zero (division by zero guard)", () => {
    expect(computePctChange("100", "0")).toBeNull()
  })

  it("returns null when today is not a valid bigint string", () => {
    expect(computePctChange("abc", "100")).toBeNull()
  })

  it("returns null when yesterday is not a valid bigint string", () => {
    expect(computePctChange("100", "xyz")).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// isUnixTimestampOnDate
// ---------------------------------------------------------------------------

describe("isUnixTimestampOnDate", () => {
  it("returns false for 0 (falsy zero guard)", () => {
    expect(isUnixTimestampOnDate(0, "1970-01-01")).toBe(false)
  })

  it("returns false for negative timestamps", () => {
    expect(isUnixTimestampOnDate(-1, "anything")).toBe(false)
  })

  it("returns true when the timestamp falls on the expected date", () => {
    // Build the expected date string via the same localDateStr used by the function
    // so the test is immune to timezone differences on the CI runner.
    const ts = Math.floor(new Date("2026-03-15T12:00:00").getTime() / 1000)
    const expected = localDateStr(new Date(ts * 1000))
    expect(isUnixTimestampOnDate(ts, expected)).toBe(true)
  })

  it("returns false when the date string does not match", () => {
    const ts = Math.floor(new Date("2026-03-15T12:00:00").getTime() / 1000)
    expect(isUnixTimestampOnDate(ts, "1999-01-01")).toBe(false)
  })
})
