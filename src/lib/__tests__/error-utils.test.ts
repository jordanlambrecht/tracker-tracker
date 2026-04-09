// src/lib/__tests__/error-utils.test.ts

import { describe, expect, it } from "vitest"
import { classifyFetchError, isDecryptionError, sanitizeNetworkError } from "@/lib/error-utils"

// ---------------------------------------------------------------------------
// isDecryptionError
// ---------------------------------------------------------------------------

describe("isDecryptionError", () => {
  // Positive cases — messages that indicate AES-GCM authentication failure

  it("returns true for 'Unsupported state or unable to authenticate data'", () => {
    expect(isDecryptionError(new Error("Unsupported state or unable to authenticate data"))).toBe(
      true
    )
  })

  it("returns true for 'bad decrypt'", () => {
    expect(isDecryptionError(new Error("bad decrypt"))).toBe(true)
  })

  it("returns true for 'bad decrypt' with mixed casing", () => {
    expect(isDecryptionError(new Error("Bad Decrypt"))).toBe(true)
  })

  it("returns true for 'Invalid key length'", () => {
    expect(isDecryptionError(new Error("Invalid key length"))).toBe(true)
  })

  it("returns true for messages containing 'EVP_' (OpenSSL error codes)", () => {
    expect(
      isDecryptionError(
        new Error("error:1e000065:Cipher functions:OPENSSL_internal:EVP_DecryptFinal_ex")
      )
    ).toBe(true)
  })

  it("returns true for messages containing 'decrypt' anywhere", () => {
    expect(isDecryptionError(new Error("Failed to decrypt cipher text"))).toBe(true)
  })

  it("returns true for 'authenticate data' partial match", () => {
    expect(isDecryptionError(new Error("unable to authenticate data"))).toBe(true)
  })

  it("is case-insensitive for 'DECRYPT'", () => {
    expect(isDecryptionError(new Error("DECRYPT failed"))).toBe(true)
  })

  it("is case-insensitive for 'INVALID KEY'", () => {
    expect(isDecryptionError(new Error("INVALID KEY supplied"))).toBe(true)
  })

  // Negative cases — errors unrelated to decryption

  it("returns false for 'Connection refused'", () => {
    expect(isDecryptionError(new Error("Connection refused"))).toBe(false)
  })

  it("returns false for 'Timeout'", () => {
    expect(isDecryptionError(new Error("Timeout"))).toBe(false)
  })

  it("returns false for 'ECONNREFUSED'", () => {
    expect(isDecryptionError(new Error("ECONNREFUSED"))).toBe(false)
  })

  it("returns false for 'Not found'", () => {
    expect(isDecryptionError(new Error("Not found"))).toBe(false)
  })

  it("returns false for a generic empty error message", () => {
    expect(isDecryptionError(new Error(""))).toBe(false)
  })

  // Non-Error inputs

  it("returns false for a plain string (not an Error instance)", () => {
    expect(isDecryptionError("bad decrypt")).toBe(false)
  })

  it("returns false for null", () => {
    expect(isDecryptionError(null)).toBe(false)
  })

  it("returns false for undefined", () => {
    expect(isDecryptionError(undefined)).toBe(false)
  })

  it("returns false for a number", () => {
    expect(isDecryptionError(42)).toBe(false)
  })

  it("returns false for a plain object", () => {
    expect(isDecryptionError({ message: "bad decrypt" })).toBe(false)
  })

  it("returns false for an array", () => {
    expect(isDecryptionError(["bad decrypt"])).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// sanitizeNetworkError
// ---------------------------------------------------------------------------

describe("sanitizeNetworkError", () => {
  it("maps 'timed out' to 'Request timed out'", () => {
    expect(sanitizeNetworkError("Request timed out after 15s")).toBe("Request timed out")
  })

  it("maps 'timeout' variant to 'Request timed out'", () => {
    expect(sanitizeNetworkError("Connection timeout")).toBe("Request timed out")
  })

  it("maps 'ECONNREFUSED' to 'Connection refused'", () => {
    expect(sanitizeNetworkError("ECONNREFUSED 127.0.0.1:8080")).toBe("Connection refused")
  })

  it("maps 'ENOTFOUND' to 'Host not found'", () => {
    expect(sanitizeNetworkError("getaddrinfo ENOTFOUND example.invalid")).toBe("Host not found")
  })

  it("maps 'EHOSTUNREACH' to 'Host unreachable'", () => {
    expect(sanitizeNetworkError("EHOSTUNREACH")).toBe("Host unreachable")
  })

  it("maps 'ECONNRESET' to 'Connection reset'", () => {
    expect(sanitizeNetworkError("ECONNRESET")).toBe("Connection reset")
  })

  it("maps 'ip ban' to IP ban message", () => {
    expect(sanitizeNetworkError("ip ban detected")).toBe("IP temporarily banned by tracker")
  })

  it("maps 'rate-limit' to IP ban message", () => {
    expect(sanitizeNetworkError("rate-limit exceeded")).toBe("IP temporarily banned by tracker")
  })

  it("maps '401' to 'Authentication failed'", () => {
    expect(sanitizeNetworkError("HTTP 401 Unauthorized")).toBe("Authentication failed")
  })

  it("maps 'Unauthorized' to 'Authentication failed'", () => {
    expect(sanitizeNetworkError("Unauthorized")).toBe("Authentication failed")
  })

  it("maps 'Session expired' to 'Session expired'", () => {
    expect(sanitizeNetworkError("Session expired")).toBe("Session expired")
  })

  it("maps 'proxy' to 'Proxy connection failed'", () => {
    expect(sanitizeNetworkError("Could not connect via proxy")).toBe("Proxy connection failed")
  })

  it("extracts status code from 'Tracker API error: 404'", () => {
    expect(sanitizeNetworkError("Tracker API error: 404")).toBe("API returned 404")
  })

  it("extracts status code from 'Tracker API error: 500'", () => {
    expect(sanitizeNetworkError("Tracker API error: 500")).toBe("API returned 500")
  })

  it("returns the default fallback for an unrecognized message", () => {
    expect(sanitizeNetworkError("Something completely unexpected happened")).toBe(
      "Connection failed"
    )
  })

  it("uses a custom fallback when provided", () => {
    expect(sanitizeNetworkError("Unknown error", "Polling failed")).toBe("Polling failed")
  })
})

// classifyFetchError
// ---------------------------------------------------------------------------

describe("classifyFetchError", () => {
  const host = "avistaz.to"

  it("unwraps TypeError wrapping ECONNREFUSED (Node.js native fetch)", () => {
    const cause = Object.assign(new Error("connect ECONNREFUSED 104.21.0.1:443"), {
      code: "ECONNREFUSED",
    })
    const outer = new TypeError("fetch failed", { cause })
    const result = classifyFetchError(outer, host)
    expect(result.message).toBe("Failed to connect to avistaz.to: ECONNREFUSED")
  })

  it("unwraps TypeError wrapping ENOTFOUND", () => {
    const cause = Object.assign(new Error("getaddrinfo ENOTFOUND avistaz.to"), {
      code: "ENOTFOUND",
    })
    const outer = new TypeError("fetch failed", { cause })
    const result = classifyFetchError(outer, host)
    expect(result.message).toBe("Failed to connect to avistaz.to: ENOTFOUND")
  })

  it("unwraps TypeError wrapping a timeout DOMException", () => {
    const cause = new DOMException("The operation was timed out.", "TimeoutError")
    const outer = new TypeError("fetch failed", { cause })
    const result = classifyFetchError(outer, host)
    expect(result.message).toBe("Request to avistaz.to timed out")
  })

  it("handles direct DOMException TimeoutError (non-wrapped)", () => {
    const err = new DOMException("timeout", "TimeoutError")
    const result = classifyFetchError(err, host)
    expect(result.message).toBe("Request to avistaz.to timed out")
  })

  it("handles direct DOMException AbortError", () => {
    const err = new DOMException("aborted", "AbortError")
    const result = classifyFetchError(err, host)
    expect(result.message).toBe("Request to avistaz.to timed out")
  })

  it("handles direct ECONNREFUSED error (no TypeError wrapper)", () => {
    const err = Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" })
    const result = classifyFetchError(err, host)
    expect(result.message).toBe("Failed to connect to avistaz.to: ECONNREFUSED")
  })

  it("uses inner message when cause has no code", () => {
    const cause = new Error("some TLS error")
    const outer = new TypeError("fetch failed", { cause })
    const result = classifyFetchError(outer, host)
    expect(result.message).toBe("Failed to connect to avistaz.to: some TLS error")
  })

  it("returns TypeError for bare TypeError with no cause", () => {
    const err = new TypeError("fetch failed")
    const result = classifyFetchError(err, host)
    expect(result.message).toBe("Failed to connect to avistaz.to: TypeError")
  })

  it("returns Unknown for non-Error values", () => {
    const result = classifyFetchError("string error", host)
    expect(result.message).toBe("Failed to connect to avistaz.to: Unknown")
  })
})
