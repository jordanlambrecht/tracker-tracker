// src/lib/__tests__/public-url.test.ts
import { describe, expect, it } from "vitest"
import { readPublicUrl } from "@/lib/api-helpers"
import { browserBase, normalizePublicUrl, publicUrlError } from "@/lib/public-url"

describe("publicUrlError", () => {
  it.each([
    "https://prowlarr.example.com",
    "http://192.168.1.10:9696",
    "http://localhost:5010",
    "https://example.com/qbittorrent",
  ])("accepts %s", (url) => {
    expect(publicUrlError(url)).toBeNull()
  })

  it.each([
    ["not a url", "Invalid public URL format"],
    ["ftp://example.com", "Public URL must use http:// or https://"],
    ["javascript:alert(1)", "Public URL must use http:// or https://"],
    ["https://user:pass@example.com", "Public URL must not contain a username or password"],
    ["https://example.com/?a=1", "Public URL must not contain a query or fragment"],
    ["https://example.com/#top", "Public URL must not contain a query or fragment"],
  ])("refuses %s", (url, message) => {
    expect(publicUrlError(url)).toBe(message)
  })

  it("refuses a URL over the length cap", () => {
    expect(publicUrlError(`https://example.com/${"a".repeat(600)}`)).toMatch(/characters or fewer/)
  })
})

describe("normalizePublicUrl", () => {
  it("trims and drops trailing slashes", () => {
    expect(normalizePublicUrl("  https://example.com/ui//  ")).toBe("https://example.com/ui")
  })

  it("reads a blank value as null", () => {
    expect(normalizePublicUrl("   ")).toBeNull()
  })
})

describe("browserBase", () => {
  it("uses the public URL when set", () => {
    expect(browserBase("https://example.com/", "http://prowlarr:9696")).toBe("https://example.com")
  })

  it.each([null, undefined, ""])("falls back to the connection URL for %j", (publicUrl) => {
    expect(browserBase(publicUrl, "http://prowlarr:9696/")).toBe("http://prowlarr:9696")
  })
})

describe("readPublicUrl", () => {
  it("leaves an absent field undefined", () => {
    expect(readPublicUrl(undefined)).toBeUndefined()
  })

  it.each([null, "", "  "])("clears on %j", (value) => {
    expect(readPublicUrl(value)).toBeNull()
  })

  it("returns the normalized URL", () => {
    expect(readPublicUrl(" https://example.com/ ")).toBe("https://example.com")
  })

  it("answers 400 for an invalid URL or a non-string", async () => {
    for (const value of ["ftp://example.com", 42]) {
      const res = readPublicUrl(value)
      expect(res).toBeInstanceOf(Response)
      expect((res as Response).status).toBe(400)
    }
  })
})
