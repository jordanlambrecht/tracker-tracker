// src/lib/frame-security.test.ts

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  ALLOWED_FRAME_ANCESTORS_ENV,
  applyFrameSecurityHeaders,
  CSP_HEADER,
  FRAME_OPTIONS_HEADER,
  frameSecurityHeaders,
  parseAllowedFrameAncestors,
} from "./frame-security"

describe("parseAllowedFrameAncestors", () => {
  it("returns nothing for unset, empty, or whitespace-only values", () => {
    for (const raw of [undefined, "", "   ", "\n\t"]) {
      expect(parseAllowedFrameAncestors(raw).allowed).toEqual([])
    }
  })

  it("accepts a single https origin", () => {
    expect(parseAllowedFrameAncestors("https://dash.example.com").allowed).toEqual([
      "https://dash.example.com",
    ])
  })

  it("accepts space-separated and comma-separated lists", () => {
    const expected = ["https://a.example.com", "https://b.example.com"]
    expect(parseAllowedFrameAncestors("https://a.example.com https://b.example.com").allowed).toEqual(expected)
    expect(parseAllowedFrameAncestors("https://a.example.com,https://b.example.com").allowed).toEqual(expected)
  })

  it("accepts an Appsmith-style value containing 'self' verbatim", () => {
    const { allowed, rejected } = parseAllowedFrameAncestors("'self' https://dash.example.com")
    expect(allowed).toEqual(["https://dash.example.com"])
    expect(rejected).toEqual([])
  })

  it("accepts ports, http, and subdomain wildcards", () => {
    expect(parseAllowedFrameAncestors("https://dash.example.com:8443").allowed).toHaveLength(1)
    expect(parseAllowedFrameAncestors("http://dash.lan").allowed).toHaveLength(1)
    expect(parseAllowedFrameAncestors("https://*.example.com").allowed).toHaveLength(1)
  })

  it("de-duplicates repeated origins", () => {
    expect(
      parseAllowedFrameAncestors("https://a.example.com https://a.example.com").allowed
    ).toEqual(["https://a.example.com"])
  })

  // The env var is interpolated into a response header, so anything that is not
  // an origin must be dropped rather than sanitized into something plausible.
  it.each([
    ["a bare wildcard", "*"],
    ["a smuggled second directive", "https://x.example.com;script-src 'unsafe-inline'"],
    ["a CSP keyword", "'unsafe-inline'"],
    ["the none keyword", "'none'"],
    ["a data URI", "data:"],
    ["a blob URI", "blob:"],
    ["a scheme-relative host", "//example.com"],
    ["a bare hostname", "example.com"],
    ["a javascript URI", "javascript:alert(1)"],
    ["a path", "https://example.com/embed"],
    ["an over-long port", "https://example.com:123456"],
  ])("rejects %s", (_label, value) => {
    const { allowed, rejected } = parseAllowedFrameAncestors(value)
    expect(allowed).toEqual([])
    expect(rejected.length).toBeGreaterThan(0)
  })

  // A CRLF payload cannot inject a header: the split consumes the newline, the
  // origin is validated on its own, and the junk after it is rejected. Asserted as
  // the output property rather than by rejecting the whole value.
  it("cannot be used to inject a second header", () => {
    const { allowed, rejected } = parseAllowedFrameAncestors("https://example.com\r\nX-Evil: 1")
    expect(allowed).toEqual(["https://example.com"])
    expect(rejected).toEqual(["X-Evil:", "1"])
    for (const origin of allowed) {
      expect(origin).not.toMatch(/[\r\n]/)
    }
  })

  it("keeps the valid origins and reports the invalid ones alongside", () => {
    const { allowed, rejected } = parseAllowedFrameAncestors("https://good.example.com nonsense")
    expect(allowed).toEqual(["https://good.example.com"])
    expect(rejected).toEqual(["nonsense"])
  })
})

describe("frameSecurityHeaders", () => {
  it("denies framing by default, matching the previous hardcoded behaviour", () => {
    expect(frameSecurityHeaders(undefined)).toEqual({
      [FRAME_OPTIONS_HEADER]: "DENY",
      [CSP_HEADER]: "frame-ancestors 'none'",
    })
  })

  it("fails closed when every configured origin is invalid", () => {
    expect(frameSecurityHeaders("* javascript:alert(1)")).toEqual({
      [FRAME_OPTIONS_HEADER]: "DENY",
      [CSP_HEADER]: "frame-ancestors 'none'",
    })
  })

  it("emits a scoped frame-ancestors for a configured origin", () => {
    expect(frameSecurityHeaders("https://dash.example.com")).toEqual({
      [CSP_HEADER]: "frame-ancestors 'self' https://dash.example.com",
    })
  })

  it("omits X-Frame-Options once an allow-list exists, rather than downgrading it", () => {
    const headers = frameSecurityHeaders("https://dash.example.com")
    expect(headers[FRAME_OPTIONS_HEADER]).toBeUndefined()
  })

  it("never emits a policy that allows all origins", () => {
    for (const raw of ["*", "https://*", "'self' *", undefined, ""]) {
      const csp = frameSecurityHeaders(raw)[CSP_HEADER]
      expect(csp).not.toMatch(/frame-ancestors[^;]*\*(\s|$)/)
    }
  })

  it("constrains framing only, leaving other CSP directives unrestricted", () => {
    const csp = frameSecurityHeaders("https://dash.example.com")[CSP_HEADER]
    expect(csp?.startsWith("frame-ancestors ")).toBe(true)
    expect(csp).not.toContain(";")
  })
})

describe("applyFrameSecurityHeaders", () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("sets the deny pair on a bare Headers instance", () => {
    const headers = new Headers()
    applyFrameSecurityHeaders(headers)
    expect(headers.get(FRAME_OPTIONS_HEADER)).toBe("DENY")
    expect(headers.get(CSP_HEADER)).toBe("frame-ancestors 'none'")
  })

  it("reads the allow-list from the environment", () => {
    vi.stubEnv(ALLOWED_FRAME_ANCESTORS_ENV, "https://dash.example.com")
    const headers = new Headers()
    applyFrameSecurityHeaders(headers)
    expect(headers.get(CSP_HEADER)).toBe("frame-ancestors 'self' https://dash.example.com")
    expect(headers.get(FRAME_OPTIONS_HEADER)).toBeNull()
  })

  // The whole point of the allow-list is defeated if a DENY survives underneath it.
  it("clears a pre-existing X-Frame-Options when an allow-list is configured", () => {
    vi.stubEnv(ALLOWED_FRAME_ANCESTORS_ENV, "https://dash.example.com")
    const headers = new Headers({ [FRAME_OPTIONS_HEADER]: "DENY" })
    applyFrameSecurityHeaders(headers)
    expect(headers.get(FRAME_OPTIONS_HEADER)).toBeNull()
  })

  it("leaves unrelated security headers alone", () => {
    const headers = new Headers({ "X-Content-Type-Options": "nosniff" })
    applyFrameSecurityHeaders(headers)
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff")
  })
})
