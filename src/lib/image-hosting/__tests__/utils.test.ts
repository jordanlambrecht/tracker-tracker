// src/lib/image-hosting/__tests__/utils.test.ts
import { describe, expect, it } from "vitest"
import { safeImageUrl, validateImageUrl } from "@/lib/validators"

describe("validateImageUrl", () => {
  it("returns the URL for a valid https URL", () => {
    const url = "https://example.com/img.png"
    expect(validateImageUrl(url)).toBe(url)
  })

  it("returns the URL for a valid http URL", () => {
    const url = "http://example.com/img.png"
    expect(validateImageUrl(url)).toBe(url)
  })

  it("throws for an ftp URL", () => {
    expect(() => validateImageUrl("ftp://example.com/img.png")).toThrow(
      "Invalid URL in image host response"
    )
  })

  it("throws for a non-URL string", () => {
    expect(() => validateImageUrl("not-a-url")).toThrow(
      "Invalid URL in image host response"
    )
  })

  it("throws for an empty string", () => {
    expect(() => validateImageUrl("")).toThrow(
      "Invalid URL in image host response"
    )
  })
})

describe("safeImageUrl", () => {
  it("returns undefined for undefined input", () => {
    expect(safeImageUrl(undefined)).toBeUndefined()
  })

  it("returns the URL for a valid https URL", () => {
    expect(safeImageUrl("https://example.com/img.png")).toBe(
      "https://example.com/img.png"
    )
  })

  it("returns undefined for an ftp URL instead of throwing", () => {
    expect(safeImageUrl("ftp://bad.com/x")).toBeUndefined()
  })

  it("returns undefined for a non-URL string instead of throwing", () => {
    expect(safeImageUrl("not-a-url")).toBeUndefined()
  })

  it("returns undefined for an empty string instead of throwing", () => {
    expect(safeImageUrl("")).toBeUndefined()
  })
})
