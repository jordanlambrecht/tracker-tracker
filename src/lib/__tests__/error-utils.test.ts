// src/lib/__tests__/error-utils.test.ts

import { describe, expect, it } from "vitest"
import {
  classifyFetchError,
  classifyProxyFetchError,
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

  // The qBittorrent auth outcomes below each need different user action, so
  // they must stay distinct from each other and from the generic rules.
  it("maps a blank-credential rejection to bypass guidance", () => {
    expect(
      sanitizeNetworkError("Authentication failed. qBittorrent rejected the blank credentials")
    ).toBe(
      'Blank credentials rejected. Enable "Bypass authentication for clients on localhost" in qBittorrent'
    )
  })

  it("maps a blank login refused through a URL path to the proxy key, not the bypass", () => {
    expect(
      sanitizeNetworkError(
        "Authentication failed. The login through the URL path was refused with blank credentials"
      )
    ).toBe(
      "Blank login rejected through the URL path. For Qui, check the client API key in the path. Otherwise enter the qBittorrent username and password"
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

  // What the qBittorrent transport raises on a host that did answer. Each fell
  // to the fallback, which isUnreachableMessage reads as a host that never
  // answered, so the card blamed the network.
  it("maps an oversized response body to its own message", () => {
    expect(
      sanitizeNetworkError("Response from qbt.local exceeded 67108864 bytes and was refused")
    ).toBe("qBittorrent returned an oversized response")
  })

  it("maps a session cookie carrying a control character to its own message", () => {
    expect(
      sanitizeNetworkError("Authentication failed. Session cookie contained an unsafe character")
    ).toBe("qBittorrent sent an unsafe session cookie")
  })

  it("maps a refused redirect to its own message", () => {
    expect(sanitizeNetworkError("qBittorrent API error: 307 Temporary Redirect")).toBe(
      "qBittorrent redirected the request"
    )
  })

  // Qui answers a wrong proxy prefix with 405 and a missing one with 404.
  it("maps a 404 or 405 to an API that is not at this address", () => {
    for (const raw of [
      "qBittorrent API error: 404 Not Found",
      "qBittorrent API error: 405 Method Not Allowed",
    ]) {
      expect(sanitizeNetworkError(raw)).toBe(
        "qBittorrent's API was not found at this address. Check the port and URL path"
      )
    }
  })

  // The tracker proxy transport has a cap of its own, worded differently.
  // Through the proxy branch it arrives wrapped as a proxy failure, which the
  // proxy rule below would otherwise turn into a connection failure.
  it("maps the proxy transport's oversized body to its own message", () => {
    expect(sanitizeNetworkError("Response exceeded 65536 byte limit")).toBe(
      "Tracker returned an oversized response"
    )
    expect(
      sanitizeNetworkError(
        "Failed to connect to tracker.example via proxy: Response exceeded 65536 byte limit"
      )
    ).toBe("Tracker returned an oversized response")
  })

  // A body the proxy transport could not decode arrives wrapped the same way.
  it("maps an undecodable proxied body to an unexpected response, not a proxy failure", () => {
    expect(
      sanitizeNetworkError(
        "Failed to connect to tracker.example via proxy: Unexpected response from tracker.example: could not decode the deflate body (invalid block type)"
      )
    ).toBe("Tracker returned an unexpected response")
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

  it("never copies a bare TypeError message other than fetch failed, since undici quotes the header in it", () => {
    const err = new TypeError(
      'Headers.append: "uid=1; pass=SECRETHASH" is an invalid header value.'
    )
    const result = classifyFetchError(err, host)
    expect(result.message).toBe("Failed to connect to avistaz.to: TypeError")
    expect(result.message).not.toContain("SECRETHASH")
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

// classifyProxyFetchError
// ---------------------------------------------------------------------------

describe("classifyProxyFetchError", () => {
  const host = "www.torrentleech.org"

  it("words proxyFetch's own deadline as a proxied timeout", () => {
    const result = classifyProxyFetchError(new Error("Request timed out after 15000ms"), host)
    expect(result.message).toBe("Request to www.torrentleech.org timed out (via proxy)")
    expect(sanitizeNetworkError(result.message, "Poll failed")).toBe("Request timed out")
  })

  it("keeps the reason a proxied request could not connect", () => {
    // A plain Error, which classifyFetchError would reduce to its name.
    const result = classifyProxyFetchError(
      new Error("Proxy connection ended before receiving CONNECT response"),
      host
    )
    expect(result.message).toBe(
      "Failed to connect to www.torrentleech.org via proxy: Proxy connection ended before receiving CONNECT response"
    )
    expect(sanitizeNetworkError(result.message, "Poll failed")).toBe("Proxy connection failed")
  })

  it("returns Unknown for non-Error values", () => {
    const result = classifyProxyFetchError("string error", host)
    expect(result.message).toBe("Failed to connect to www.torrentleech.org via proxy: Unknown")
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

describe("sanitizeNetworkError Cloudflare challenge", () => {
  it("names the challenge instead of falling back to Poll failed", () => {
    expect(
      sanitizeNetworkError("Cloudflare challenge detected. Cookies need refreshing", "Poll failed")
    ).toBe("Cloudflare challenge blocked the request")
  })
})

describe("sanitizeNetworkError redirect refusals", () => {
  // The scrapers refuse a redirect off the tracker's own origin, which would
  // carry the session cookies to another host, and give up on a loop. The
  // tracker answered either way, so neither may read as unreachable.
  it("names an off-site redirect instead of falling back to Poll failed", () => {
    const card = sanitizeNetworkError(
      "IPTorrents redirected off-site; refusing to send credentials",
      "Poll failed"
    )
    expect(card).toBe("Tracker redirected to another site")
    expect(isUnreachableMessage(card)).toBe(false)
  })

  it("names a redirect loop instead of falling back to Poll failed", () => {
    const card = sanitizeNetworkError("Too many redirects from FileList", "Poll failed")
    expect(card).toBe("Tracker redirected too many times")
    expect(isUnreachableMessage(card)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Adapter shape errors (issue #214) read "Unexpected response from <host>: ...".
// They get their own message and must match before the credential rule, whose
// /invalid/ would turn a key named "invalid" into "Invalid credentials".
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

  // parseBytes' messages start with "Invalid", "Negative" and "Unknown".
  // "Invalid" must not reach the credential rule, or a malformed uploaded field
  // tells the user to rotate a key.
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
    "qBittorrent returned an oversized response",
    "qBittorrent sent an unsafe session cookie",
    "qBittorrent redirected the request",
    "Tracker returned an oversized response",
  ])("is false for %j", (message) => {
    expect(isUnreachableMessage(message)).toBe(false)
  })
})
