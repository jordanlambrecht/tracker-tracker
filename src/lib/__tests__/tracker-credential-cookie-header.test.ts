// src/lib/__tests__/tracker-credential-cookie-header.test.ts

import { describe, expect, it } from "vitest"
import { validateCookieHeader } from "@/lib/tracker-credentials/cookie-header"

describe("validateCookieHeader", () => {
  const opts = { example: "uid=123; pass=abc123" }

  it("strips a pasted 'Cookie: ' prefix", () => {
    expect(validateCookieHeader("Cookie: uid=1; pass=2", opts)).toBe("uid=1; pass=2")
  })

  it("trims surrounding whitespace", () => {
    expect(validateCookieHeader("  uid=1  ", opts)).toBe("uid=1")
  })

  it("rejects a bare cookie name from the shared list", () => {
    expect(() => validateCookieHeader("cf_clearance", opts)).toThrow("pasted a cookie name")
  })

  it("rejects a bare cookie name supplied by the caller", () => {
    expect(() => validateCookieHeader("love", { ...opts, extraCookieNames: ["love"] })).toThrow(
      "pasted a cookie name"
    )
  })

  it("does not reject a caller's extra name for a different tracker", () => {
    expect(validateCookieHeader("love=yes", opts)).toBe("love=yes")
  })

  it("rejects a value with no key=value pair, quoting the tracker's example", () => {
    expect(() => validateCookieHeader("justastring", opts)).toThrow("uid=123; pass=abc123")
  })

  it("rejects a value truncated by DevTools into a non-ASCII character", () => {
    expect(() => validateCookieHeader("uid=1; pass=abc…", opts)).toThrow(
      /non-ASCII character \("…", U\+2026\) at position 15/
    )
  })

  it("accepts a realistic cookie blob", () => {
    const blob = "cf_clearance=AbC-123_x; uid=456; pass=deadbeef; XSRF-TOKEN=zzz"
    expect(validateCookieHeader(blob, opts)).toBe(blob)
  })
})

describe("validateCookieHeader control characters", () => {
  // Without the control-character check, CR/LF passes the byte-range guard and
  // fetch() throws a TypeError that quotes the whole header, secret included.
  it("rejects a pasted raw request-header block containing CRLF", () => {
    expect(() =>
      validateCookieHeader("PHPSESSID=secret\r\nHost: retrotoon.world", { example: "a=b" })
    ).toThrow(/control character \(U\+000D\) at position 16/)
  })

  it("rejects a bare newline and a tab", () => {
    expect(() => validateCookieHeader("a=b\nc=d", { example: "a=b" })).toThrow(/U\+000A/)
    expect(() => validateCookieHeader("a=b\tc=d", { example: "a=b" })).toThrow(/U\+0009/)
  })

  it("never echoes the cookie value in the error", () => {
    let message = ""
    try {
      validateCookieHeader("PHPSESSID=SUPERSECRETVALUE\r\nHost: x", { example: "a=b" })
    } catch (err) {
      message = (err as Error).message
    }
    expect(message).not.toContain("SUPERSECRETVALUE")
  })

  it("still accepts an ordinary multi-cookie header", () => {
    expect(
      validateCookieHeader("cf_clearance=abc; PHPSESSID=def; other=ghi", { example: "a=b" })
    ).toBe("cf_clearance=abc; PHPSESSID=def; other=ghi")
  })
})
