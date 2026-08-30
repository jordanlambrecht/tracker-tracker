// src/lib/__tests__/error-utils.test.ts

import { describe, expect, it } from "vitest"
import {
  classifyFetchError,
  isDecryptionError,
  isUnreachableMessage,
  sanitizeNetworkError,
} from "@/lib/error-utils"

// ---------------------------------------------------------------------------
// isDecryptionError
// ---------------------------------------------------------------------------

describe("isDecryptionError", () => {
  // Positive cases, messages that indicate AES-GCM authentication failure

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

  // Negative cases, errors unrelated to decryption

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

  // The three qBittorrent auth outcomes below each need different user action,
  // so they must stay distinct from each other and from the generic rules.
  it("maps a blank-credential rejection to bypass guidance", () => {
    expect(
      sanitizeNetworkError("Authentication failed. qBittorrent rejected the blank credentials")
    ).toBe(
      'Blank credentials rejected. Enable "Bypass authentication for clients on localhost" in qBittorrent'
    )
  })

  it("maps a username/password rejection to a credentials message", () => {
    expect(
      sanitizeNetworkError("Authentication failed. qBittorrent rejected the username and password")
    ).toBe("Credentials rejected by qBittorrent. Check the username and password")
  })

  it("maps a qBittorrent IP ban to a self-clearing ban message, not the tracker one", () => {
    expect(
      sanitizeNetworkError(
        "qBittorrent has temporarily banned this IP after too many failed login attempts"
      )
    ).toBe("Banned by qBittorrent after too many failed logins. It will clear on its own")
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

  it("uses err.message for bare TypeError with no cause", () => {
    const err = new TypeError("fetch failed")
    const result = classifyFetchError(err, host)
    expect(result.message).toBe("Failed to connect to avistaz.to: fetch failed")
  })

  it("unwraps string cause from TypeError", () => {
    const err = new TypeError("fetch failed", { cause: "connect ECONNREFUSED 10.0.0.1:443" })
    const result = classifyFetchError(err, host)
    expect(result.message).toBe(
      "Failed to connect to avistaz.to: connect ECONNREFUSED 10.0.0.1:443"
    )
  })

  it("returns Unknown for non-Error values", () => {
    const result = classifyFetchError("string error", host)
    expect(result.message).toBe("Failed to connect to avistaz.to: Unknown")
  })
})

describe("sanitizeNetworkError TorrentLeech auth outcomes", () => {
  it("lets the 2FA guidance through instead of the generic fallback", () => {
    const raw =
      "TorrentLeech requires 2FA. Add your Alt 2FA Token (Site Profile => Alt 2FA Token) to this tracker's credentials"
    expect(sanitizeNetworkError(raw, "Tracker test failed")).toBe(raw)
  })

  it("keeps the token hint when 2FA credentials are refused", () => {
    expect(sanitizeNetworkError("Invalid TorrentLeech credentials or Alt 2FA Token")).toBe(
      "Invalid credentials or Alt 2FA Token"
    )
  })
})

// ---------------------------------------------------------------------------
// Adapter shape errors (issue #214). An adapter that gets a 2xx body it cannot
// read throws "Unexpected response from <host>: ...", the wording the Gazelle,
// BTN, GGn, MAM, Nebulance, Hawke and UNIT3D adapters share. That must reach
// the UI as its own message rather than the generic fallback, and it must be
// matched BEFORE the credential rule, whose /invalid/ alternation would
// otherwise turn a tracker key literally named "invalid" into "Invalid
// credentials".
// ---------------------------------------------------------------------------

describe("sanitizeNetworkError - unexpected response shape", () => {
  it("maps an adapter shape error to an unexpected-response message, not the fallback", () => {
    expect(
      sanitizeNetworkError(
        'Unexpected response from lst.gg: missing "uploaded", "downloaded", "buffer"; top-level keys: data',
        "Poll failed"
      )
    ).toBe("Tracker returned an unexpected response")
  })

  it("wins over the credential rule when a reported key happens to say invalid", () => {
    expect(
      sanitizeNetworkError(
        'Unexpected response from lst.gg: missing "buffer"; top-level keys: invalid'
      )
    ).toBe("Tracker returned an unexpected response")
  })

  it("covers the shape errors the Gazelle, BTN, GGn, MAM and Hawke adapters already throw", () => {
    expect(sanitizeNetworkError("Unexpected response from aither.cc: missing userstats")).toBe(
      "Tracker returned an unexpected response"
    )
  })

  // parseBytes' own messages start with "Invalid", "Negative" and "Unknown".
  // The first of those used to fall into the credential rule, so a tracker
  // sending "" or "1,024.50 GiB" for uploaded told the user to rotate a key.
  it("maps a byte-string parse failure to the unexpected-response message, not to credentials", () => {
    expect(sanitizeNetworkError('Invalid byte format: ""', "Poll failed")).toBe(
      "Tracker returned an unexpected response"
    )
    expect(sanitizeNetworkError('Unknown unit: "GiBs"', "Poll failed")).toBe(
      "Tracker returned an unexpected response"
    )
    expect(sanitizeNetworkError('Negative byte values are not allowed: "-1 GiB"')).toBe(
      "Tracker returned an unexpected response"
    )
  })
})

// ---------------------------------------------------------------------------
// isUnreachableMessage
//
// The tracker_down notification says "<name> is unreachable" for every poll
// failure. Only the connectivity outputs of sanitizeNetworkError justify that
// wording; an auth rejection or a changed payload means the host answered.
// ---------------------------------------------------------------------------

describe("isUnreachableMessage", () => {
  // Driven through the sanitizer so a reworded connectivity message fails
  // here as well as in the sanitizeNetworkError tests above.
  it.each([
    "Request timed out after 15s",
    "ECONNREFUSED 127.0.0.1:443",
    "getaddrinfo ENOTFOUND lst.gg",
    "EHOSTUNREACH",
    "ECONNRESET",
    "Could not connect via proxy",
  ])("is true for the sanitized form of %j", (raw) => {
    expect(isUnreachableMessage(sanitizeNetworkError(raw))).toBe(true)
  })

  it("is true for the sanitizer's own connection fallback", () => {
    expect(isUnreachableMessage(sanitizeNetworkError("Something odd"))).toBe(true)
    expect(isUnreachableMessage("Connection failed")).toBe(true)
  })

  it.each([
    "Poll failed",
    "Authentication failed",
    "Tracker returned an unexpected response",
    "IP temporarily banned by tracker",
    "API returned 500",
    "Unknown error",
  ])("is false for %j", (message) => {
    expect(isUnreachableMessage(message)).toBe(false)
  })
})
