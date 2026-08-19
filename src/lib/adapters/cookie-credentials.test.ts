// src/lib/adapters/cookie-credentials.test.ts
import { describe, expect, it } from "vitest"
import { parseCredentialJson, validateCookieHeader } from "./cookie-credentials"

describe("parseCredentialJson", () => {
  it("returns the requested fields", () => {
    const creds = parseCredentialJson('{"username":"bob","password":"hunter2"}', "TorrentLeech", [
      "username",
      "password",
    ] as const)

    expect(creds).toEqual({ username: "bob", password: "hunter2" })
  })

  it("keeps extra fields off the required list intact", () => {
    const creds = parseCredentialJson('{"cookies":"a=1","userAgent":"UA","extra":"x"}', "IPT", [
      "cookies",
      "userAgent",
    ] as const)

    expect(creds.cookies).toBe("a=1")
    expect(creds.userAgent).toBe("UA")
  })

  it("does not normalize values — callers decide what may be trimmed", () => {
    const creds = parseCredentialJson('{"password":"  pad  "}', "X", ["password"] as const)

    expect(creds.password).toBe("  pad  ")
  })

  it("names the tracker and every field when the blob is not JSON", () => {
    expect(() =>
      parseCredentialJson("not json", "AvistaZ", ["cookies", "userAgent", "username"] as const)
    ).toThrow("AvistaZ credentials must be a JSON object with cookies, userAgent, and username")
  })

  it("joins two fields with 'and' rather than a comma", () => {
    expect(() =>
      parseCredentialJson("not json", "IPTorrents", ["cookies", "userAgent"] as const)
    ).toThrow("IPTorrents credentials must be a JSON object with cookies and userAgent")
  })

  it("reports the expected types when a field is the wrong type", () => {
    expect(() =>
      parseCredentialJson('{"cookies":"a=1","userAgent":42}', "IPTorrents", [
        "cookies",
        "userAgent",
      ] as const)
    ).toThrow("IPTorrents credentials must contain cookies (string) and userAgent (string)")
  })

  it("rejects a JSON array", () => {
    expect(() => parseCredentialJson("[]", "X", ["cookies"] as const)).toThrow("must contain")
  })

  it("rejects JSON null", () => {
    expect(() => parseCredentialJson("null", "X", ["cookies"] as const)).toThrow("must contain")
  })

  it("names the offending field when a value is blank", () => {
    expect(() =>
      parseCredentialJson('{"cookies":"a=1","userAgent":"   "}', "IPTorrents", [
        "cookies",
        "userAgent",
      ] as const)
    ).toThrow("IPTorrents credentials: userAgent cannot be empty")
  })
})

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
