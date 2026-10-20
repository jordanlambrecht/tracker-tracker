// src/lib/__tests__/tracker-credential-header-token.test.ts

import { describe, expect, it } from "vitest"
import { sanitizeNetworkError } from "@/lib/error-utils"
import { validateHeaderToken } from "@/lib/tracker-credentials/header-token"

describe("validateHeaderToken", () => {
  it("returns working tokens unchanged", () => {
    // Too broad a character class fails every poll on every header-token tracker.
    for (const token of [
      "a3f9c2e1b7d4f6a8c0e2b4d6f8a1c3e5",
      "12|Xq7Lm2Np9Rt4Vw6Yz8Ab1Cd3Ef5Gh7Ij9Kl0Mn",
      "dGhpcyBpcyBhIHRva2Vu+/w==",
      "A".repeat(100),
    ]) {
      expect(validateHeaderToken(token)).toBe(token)
    }
  })

  it("trims surrounding whitespace, so a stored line break cannot reach a proxied request", () => {
    expect(validateHeaderToken("  a3f9c2e1b7d4\n")).toBe("a3f9c2e1b7d4")
  })

  it("rejects a control character inside the token, by code point and position", () => {
    expect(() => validateHeaderToken("a3f9\nX-Other: 1")).toThrow(
      "Invalid API token: it contains a control character (U+000A) at position 4. Re-copy the token with no surrounding text."
    )
  })

  it("rejects the mark a browser leaves when it truncates a copied token", () => {
    expect(() => validateHeaderToken("a3f9c2e1b7d4…")).toThrow(
      "Invalid API token: it contains a non-Latin-1 character (U+2026) at position 12, usually a truncation mark. Re-copy the full token."
    )
  })

  it("words both rejections so the card reads as a credential fault", () => {
    // The card text comes from sanitizeNetworkError matching the message, so a
    // reword that drops "Invalid" turns it back into "Poll failed".
    for (const token of ["a3f9\nb", "a3f9…"]) {
      let message = ""
      try {
        validateHeaderToken(token)
      } catch (err) {
        message = err instanceof Error ? err.message : ""
      }
      expect(sanitizeNetworkError(message, "Poll failed")).toBe("Invalid credentials")
    }
  })
})
