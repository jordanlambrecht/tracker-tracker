// src/lib/adapters/filelist.test.ts

import { describe, expect, it } from "vitest"
import { parseFilelistCredentials } from "./filelist"

const VALID_TOKEN = JSON.stringify({
  cookies: "uid=1683565; pass=abc123def456",
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) TestUA",
})

describe("parseFilelistCredentials", () => {
  it("parses a valid credential blob", () => {
    const creds = parseFilelistCredentials(VALID_TOKEN)
    expect(creds.cookies).toBe("uid=1683565; pass=abc123def456")
    expect(creds.userAgent).toBe("Mozilla/5.0 (Windows NT 10.0; Win64; x64) TestUA")
  })

  it("strips a pasted 'Cookie: ' prefix", () => {
    const creds = parseFilelistCredentials(
      JSON.stringify({ cookies: "Cookie: uid=1; pass=x", userAgent: "UA" })
    )
    expect(creds.cookies).toBe("uid=1; pass=x")
  })

  it("rejects non-JSON", () => {
    expect(() => parseFilelistCredentials("not json")).toThrow(
      "FileList credentials must be a JSON object with cookies and userAgent"
    )
  })

  it("rejects a missing field", () => {
    expect(() => parseFilelistCredentials(JSON.stringify({ cookies: "uid=1; pass=x" }))).toThrow(
      "FileList credentials must contain cookies (string) and userAgent (string)"
    )
  })

  it("rejects an empty field", () => {
    expect(() =>
      parseFilelistCredentials(JSON.stringify({ cookies: "  ", userAgent: "UA" }))
    ).toThrow("FileList credentials: cookies cannot be empty")
  })

  it("rejects a lone cookie name paste", () => {
    expect(() =>
      parseFilelistCredentials(JSON.stringify({ cookies: "pass", userAgent: "UA" }))
    ).toThrow(/pasted a cookie name/)
  })

  it("rejects a value with no key=value pairs", () => {
    expect(() =>
      parseFilelistCredentials(JSON.stringify({ cookies: "abcdef", userAgent: "UA" }))
    ).toThrow(/key=value pairs/)
  })

  it("rejects non-ASCII truncation artifacts", () => {
    expect(() =>
      parseFilelistCredentials(JSON.stringify({ cookies: "uid=1; pass=abc…", userAgent: "UA" }))
    ).toThrow(/non-ASCII character/)
  })
})
