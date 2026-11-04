// src/lib/__tests__/error-utils.test.ts

import { describe, expect, it } from "vitest"
import { decrypt, encrypt } from "@/lib/crypto"
import {
  BTN_RATE_LIMITED_CAUSE,
  BTN_RATE_LIMITED_ERROR,
  BTN_RPC_ERROR,
  classifyFetchError,
  classifyProxyFetchError,
  GAZELLE_STATUS_ERROR,
  GGN_STATUS_ERROR,
  HAWKE_REQUEST_ERROR,
  isDecryptionError,
  isUnreachableMessage,
  isUnreadableClientCredential,
  PROXY_AUTH_REQUIRED_CAUSE,
  sanitizeNetworkError,
} from "@/lib/error-utils"
import { validateCookieHeader } from "@/lib/tracker-credentials/cookie-header"
import { isRetryablePollError } from "@/lib/tracker-status"

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

  // The key is the wrong size, not the stored value unreadable, so asking for the
  // credential again would not help.
  it("returns false for decrypt()'s error on a key of the wrong size", () => {
    const sealed = encrypt("secret", Buffer.alloc(32, 1))
    const error = (() => {
      try {
        decrypt(sealed, Buffer.alloc(16, 1))
      } catch (err) {
        return err
      }
    })()
    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toMatch(/Invalid key length/i)
    expect(isDecryptionError(error)).toBe(false)
  })

  it("returns true for decrypt()'s error under another key of the right size", () => {
    const sealed = encrypt("secret", Buffer.alloc(32, 1))
    const error = (() => {
      try {
        decrypt(sealed, Buffer.alloc(32, 2))
      } catch (err) {
        return err
      }
    })()
    expect(isDecryptionError(error)).toBe(true)
  })

  // A bad restore can leave a value too short to hold its IV and auth tag.
  it("returns true for decrypt()'s own error on a value cut short", () => {
    const error = (() => {
      try {
        decrypt("AAAA", Buffer.alloc(32, 1))
      } catch (err) {
        return err
      }
    })()
    expect(isDecryptionError(error)).toBe(true)
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

  it("is case-insensitive for 'INVALID CIPHERTEXT'", () => {
    expect(isDecryptionError(new Error("INVALID CIPHERTEXT: too short"))).toBe(true)
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

  it("maps a DNS lookup that failed for now, EAI_AGAIN, to 'Host not found'", () => {
    expect(sanitizeNetworkError("Failed to connect to aither.cc: EAI_AGAIN", "Poll failed")).toBe(
      "Host not found"
    )
  })

  // Through classifyFetchError, which words every direct transport fault.
  it.each([
    ["ECONNREFUSED", "Connection refused"],
    ["ENOTFOUND", "Host not found"],
    ["EHOSTUNREACH", "Host unreachable"],
    ["ECONNRESET", "Connection reset"],
    ["ENETUNREACH", "Host unreachable"],
    ["ECONNABORTED", "Connection reset"],
    ["EPIPE", "Connection reset"],
    ["UND_ERR_SOCKET", "Connection reset"],
  ])("maps a socket fault, %s, to %j", (code, message) => {
    const cause = Object.assign(new Error("socket fault"), { code })
    const fault = Object.assign(new TypeError("fetch failed"), { cause })
    const raw = classifyFetchError(fault, "aither.cc").message
    expect(sanitizeNetworkError(raw, "Poll failed")).toBe(message)
  })

  it.each([
    ["write EPIPE", "Connection reset"],
    ["connect ECONNREFUSED 127.0.0.1:1080", "Connection refused"],
    ["getaddrinfo ENOTFOUND proxy.example.test", "Host not found"],
  ])("maps a socket fault behind the proxy too, %s", (cause, message) => {
    const raw = classifyProxyFetchError(new Error(cause), "aither.cc").message
    expect(sanitizeNetworkError(raw, "Poll failed")).toBe(message)
  })

  // The qBittorrent login names the client by its whole address.
  it("maps a socket fault after a client's URL", () => {
    expect(
      sanitizeNetworkError("Failed to connect to http://192.168.1.50:8080: ECONNREFUSED")
    ).toBe("Connection refused")
  })

  it.each([
    "write EPIPE",
    "connect ECONNREFUSED 10.0.0.5:5432",
    "getaddrinfo ENOTFOUND db.internal",
    "connect EHOSTUNREACH 10.0.0.5:5432",
    "read ECONNRESET",
  ])("leaves a socket fault quoted in a tracker's own answer to the status, %s", (quoted) => {
    expect(
      sanitizeNetworkError(`Tracker API error: 500 Internal Server Error: ${quoted}`, "Poll failed")
    ).toBe("API returned 500")
  })

  it("maps 'ip ban' to IP ban message", () => {
    expect(sanitizeNetworkError("ip ban detected")).toBe("IP temporarily banned by tracker")
  })

  it("maps BTN's rate limit to its own message, not the IP ban one", () => {
    expect(sanitizeNetworkError(BTN_RATE_LIMITED_CAUSE, "Poll failed")).toBe(BTN_RATE_LIMITED_ERROR)
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

  // Fixed strings in, fixed strings out: no part of the raw message, which the
  // adapter builds from no tracker text, is passed through.
  it("maps each Luminance login refusal to its own card, clear of the TorrentLeech rules", () => {
    expect(sanitizeNetworkError("Luminance login refused: the account is disabled")).toBe(
      "Account is disabled on the tracker. Log in on the site to see why"
    )
    expect(sanitizeNetworkError("Luminance login refused: the password is in a known breach")).toBe(
      "Tracker refused the password as breached. Change it on the site, then update it here"
    )
    expect(sanitizeNetworkError("Luminance login refused: the account uses two-factor login")).toBe(
      "Two-factor login is on for this account. Add a session cookie from a browser login to the tracker's credentials"
    )
    expect(sanitizeNetworkError("Invalid Luminance credentials")).toBe("Invalid credentials")
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

  it("maps a tracker 401 to 'Authentication failed'", () => {
    expect(sanitizeNetworkError("Tracker API error: 401 Unauthorized")).toBe(
      "Authentication failed"
    )
  })

  it("maps a qBittorrent 403 to 'Authentication failed'", () => {
    expect(sanitizeNetworkError("qBittorrent API error: 403 Forbidden")).toBe(
      "Authentication failed"
    )
  })

  // c411 appends the tracker's message after the status, as here.
  it("reads a 401 whose message says timed out as a refused key", () => {
    expect(sanitizeNetworkError("Tracker API error: 401 Unauthorized: token timed out")).toBe(
      "Authentication failed"
    )
  })

  it("maps 'Session expired' to 'Session expired'", () => {
    expect(sanitizeNetworkError("Session expired")).toBe("Session expired")
  })

  it("maps the proxy wrapper's failure to 'Proxy connection failed'", () => {
    expect(
      sanitizeNetworkError(
        "Failed to connect to aither.cc via proxy: Proxy connection ended before receiving CONNECT response"
      )
    ).toBe("Proxy connection failed")
  })

  // The tracker transports wrap a 407 from the configured proxy. Any other 407
  // is a host's answer.
  it("maps the proxy's own 407 to 'Proxy connection failed'", () => {
    expect(
      sanitizeNetworkError(`Failed to connect to aither.cc via proxy: ${PROXY_AUTH_REQUIRED_CAUSE}`)
    ).toBe("Proxy connection failed")
  })

  it.each([
    ["Tracker API error: 407 Proxy Authentication Required", "Poll failed", "API returned 407"],
    ["Webhook API error: 407 Proxy Authentication Required", "Delivery failed", "Delivery failed"],
  ])("reads a 407 that no proxied request threw as the host's: %s", (raw, fallback, message) => {
    expect(sanitizeNetworkError(raw, fallback)).toBe(message)
  })

  it.each([
    ["Hawke API request failed on hawke.uno: VPN or proxy detected", "Poll failed"],
    ["Gazelle API returned status: failure: Proxy users are not allowed", "Poll failed"],
    ["Tracker API error: 500 Internal Server Error: proxy upstream", "API returned 500"],
  ])("leaves a tracker's own text that mentions a proxy to the later rules: %s", (raw, message) => {
    expect(sanitizeNetworkError(raw, "Poll failed")).toBe(message)
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
      "TorrentLeech requires 2FA. Add your Alt 2FA Token (Site Profile › Alt 2FA Token) to this tracker's credentials"
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
  // carry the session cookies to another host, and give up on a loop. JSON API
  // requests refuse every redirect. The tracker answered in each case, so none
  // may read as unreachable.
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

  it("names a refused API redirect instead of falling back to Poll failed", () => {
    const card = sanitizeNetworkError(
      "aither.cc answered with a 302 redirect, which is not followed",
      "Poll failed"
    )
    expect(card).toBe("Tracker redirected the request")
    expect(isUnreachableMessage(card)).toBe(false)
  })
})

describe("sanitizeNetworkError unreadable stored credentials", () => {
  // The wrappers pollTracker and credentials.ts throw when a stored credential
  // will not decrypt. Nothing was contacted, so neither may read as unreachable.
  const CAUSE = "Unsupported state or unable to authenticate data"

  it("tells the user to enter a tracker's credentials again", () => {
    const card = sanitizeNetworkError(
      `Unreadable stored credential for tracker "Aither": ${CAUSE}`,
      "Poll failed"
    )
    expect(card).toBe(
      "Stored credentials for this tracker can't be read. Enter them again in its settings"
    )
    expect(isUnreachableMessage(card)).toBe(false)
  })

  it("tells the user to enter a client's credentials again instead of Connection failed", () => {
    const card = sanitizeNetworkError(`decrypt credentials failed for client "qBT": ${CAUSE}`)
    expect(card).toBe(
      "Stored credentials or URL path can't be read. Enter them again in this client's settings"
    )
    expect(isUnreachableMessage(card)).toBe(false)
  })

  // A bad restore can leave a ciphertext too short to hold its IV and tag.
  it("asks for a truncated client credential again instead of Invalid credentials", () => {
    const card = sanitizeNetworkError(
      'Failed to read credentials for client "qBT": Invalid ciphertext: too short'
    )
    expect(card).toBe(
      "Stored credentials or URL path can't be read. Enter them again in this client's settings"
    )
  })
})

describe("sanitizeNetworkError cookie control characters", () => {
  // The validator's own message, so the rule cannot drift from what a poll throws.
  it("asks for the Cookie value again instead of Poll failed", () => {
    let raw = ""
    try {
      validateCookieHeader("session=CANARY\nHost: tracker.example", { example: "session=abc" })
    } catch (error) {
      raw = error instanceof Error ? error.message : ""
    }
    expect(raw).not.toBe("")

    const card = sanitizeNetworkError(raw, "Poll failed")
    expect(card).toBe(
      "Stored cookie contains a control character. Paste the full Cookie value again in this tracker's settings"
    )
    expect(isUnreachableMessage(card)).toBe(false)
  })

  // The validator's other refusals, each run for real for the same reason.
  it.each<[string, string, string[], string]>([
    [
      "a cookie name on its own",
      "cf_clearance",
      [],
      "Stored cookie is a cookie name, not the Cookie value. Paste the full Cookie value again in this tracker's settings",
    ],
    [
      "no name=value pair",
      "CANARY",
      [],
      "Stored cookie has no name=value pairs. Paste the full Cookie value again in this tracker's settings",
    ],
    [
      "a non-ASCII character",
      "session=CANARY…",
      [],
      "Stored cookie contains a non-ASCII character, usually a truncation mark. Paste the full Cookie value again in this tracker's settings",
    ],
    [
      "a required cookie missing",
      "other=CANARY",
      ["sid"],
      "Stored cookie has no sid cookie. Paste the full Cookie value again in this tracker's settings",
    ],
    [
      "a required cookie with a hyphen in its name missing",
      "other=CANARY",
      ["XSRF-TOKEN"],
      "Stored cookie has no XSRF-TOKEN cookie. Paste the full Cookie value again in this tracker's settings",
    ],
  ])("asks for the Cookie value again for %s", (_case, cookies, requiredCookieNames, expected) => {
    let raw = ""
    try {
      validateCookieHeader(cookies, { example: "session=abc", requiredCookieNames })
    } catch (error) {
      raw = error instanceof Error ? error.message : ""
    }
    expect(raw).not.toBe("")

    const card = sanitizeNetworkError(raw, "Poll failed")
    expect(card).toBe(expected)
    expect(card).not.toContain("CANARY")
  })

  // Anchored, so a tracker's own answer that quotes one of these phrases reads as
  // the tracker's, never as a cookie to paste again.
  it.each<[string, string, string[]]>([
    ["a control character", "session=CANARY\nHost: tracker.example", []],
    ["a non-ASCII character", "session=CANARY…", []],
    ["a cookie name on its own", "cf_clearance", []],
    ["no name=value pair", "CANARY", []],
    ["a required cookie missing", "other=CANARY", ["sid"]],
  ])("leaves %s quoted in a tracker's answer to the status", (_case, cookies, required) => {
    let raw = ""
    try {
      validateCookieHeader(cookies, { example: "session=abc", requiredCookieNames: required })
    } catch (error) {
      raw = error instanceof Error ? error.message : ""
    }
    expect(raw).not.toBe("")

    const quoted = `Tracker API error: 500 Internal Server Error: ${raw}`
    expect(sanitizeNetworkError(quoted, "Poll failed")).toBe("API returned 500")
  })
})

describe("isUnreadableClientCredential", () => {
  it.each([
    'decrypt credentials failed for client "qBT": bad decrypt',
    'Failed to read credentials for client "qBT": Invalid ciphertext: too short',
  ])("is true for credentials.ts's %j", (message) => {
    expect(isUnreadableClientCredential(new Error(message))).toBe(true)
  })

  // isDecryptionError matches this TLS code, so the client paths key on the wrapper.
  it("is false for a TLS failure that mentions decryption", () => {
    const tls = new Error(
      "Failed to connect to qbt.lan: ERR_SSL_DECRYPTION_FAILED_OR_BAD_RECORD_MAC"
    )
    expect(isDecryptionError(tls)).toBe(true)
    expect(isUnreadableClientCredential(tls)).toBe(false)
    expect(sanitizeNetworkError(tls.message)).toBe("Connection failed")
  })
})

// ---------------------------------------------------------------------------
// Adapter shape errors (issue #214) read "Unexpected response from <host>: ...".
// They get their own message, whatever key names the payload lists.
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

  it("stays a shape error when a reported key happens to say invalid", () => {
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

  // parseBytes' messages start with "Invalid", "Negative" and "Unknown". A
  // malformed uploaded field must not tell the user to rotate a key.
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
  // here as well as in the sanitizeNetworkError tests above. The poll's own
  // fallback is not an unreachable message, so a raw form that stops matching
  // fails too.
  it.each([
    "Request timed out after 15s",
    "Failed to connect to lst.gg: ECONNREFUSED",
    "Failed to connect to lst.gg: ENOTFOUND",
    "Failed to connect to lst.gg: EAI_AGAIN",
    "Failed to connect to lst.gg: EHOSTUNREACH",
    "Failed to connect to lst.gg: ECONNRESET",
    "Failed to connect to lst.gg via proxy: Socket closed",
  ])("is true for the sanitized form of %j", (raw) => {
    expect(isUnreachableMessage(sanitizeNetworkError(raw, "Poll failed"))).toBe(true)
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

// ---------------------------------------------------------------------------
// "Invalid credentials" comes from the app's own refusal phrases, plus the one
// envelope exception, never from "invalid" anywhere in a message.
// ---------------------------------------------------------------------------

describe("sanitizeNetworkError - credential refusals", () => {
  it.each([
    'API key is missing or invalid for tracker "LST": token is empty',
    'Credentials are missing or invalid for tracker "TL"',
    "Invalid API token: it contains a control character (U+000A) at position 3. Re-copy the token with no surrounding text.",
    "Invalid username: it contains a control character (U+0000) at position 4.",
    "Invalid TorrentLeech credentials",
    "Invalid Luminance credentials",
    "Invalid BTN API key",
    "DigitalCore credentials: uid contains invalid characters (a semicolon or a control character)",
    "DigitalCore credentials: pass contains invalid characters (a semicolon or a control character)",
    "MAM session cookie (mam_id) contains invalid characters (a semicolon or a control character)",
  ])("reads %j as invalid credentials, never retried", (raw) => {
    const message = sanitizeNetworkError(raw, "Poll failed")

    expect(message).toBe("Invalid credentials")
    expect(isRetryablePollError(message)).toBe(false)
  })

  // The wrappers quote the tracker's name, which a looser rule further down
  // would otherwise read first.
  it.each([
    ["Timeout Club", "a timeout"],
    ["Zip Banana", "an IP ban"],
    ["Unknown Unit", "a byte-string parse failure"],
  ])("reads a credential refusal for %j as credentials, not %s", (name) => {
    for (const raw of [
      `API key is missing or invalid for tracker "${name}": token is empty`,
      `Credentials are missing or invalid for tracker "${name}"`,
    ]) {
      expect(sanitizeNetworkError(raw, "Poll failed")).toBe("Invalid credentials")
    }
  })

  it.each([
    `${GAZELLE_STATUS_ERROR}: failure: Invalid API key`,
    `${GGN_STATUS_ERROR}: failure: Invalid API key`,
    `${HAWKE_REQUEST_ERROR} hawke.uno: Invalid API key.`,
    `${BTN_RPC_ERROR}: Invalid API key`,
  ])("reads the envelope %j as invalid credentials, never retried", (raw) => {
    const message = sanitizeNetworkError(raw, "Poll failed")

    expect(message).toBe("Invalid credentials")
    expect(isRetryablePollError(message)).toBe(false)
  })

  it.each([
    `${GAZELLE_STATUS_ERROR}: failure: bad credentials`,
    `${GGN_STATUS_ERROR}: failure: bad id parameter`,
    `${HAWKE_REQUEST_ERROR} hawke.uno: Too many requests.`,
    `${BTN_RPC_ERROR}: API key not found`,
    `${BTN_RPC_ERROR} with no message`,
  ])("leaves the envelope %j that never says invalid to the fallback", (raw) => {
    expect(sanitizeNetworkError(raw, "Poll failed")).toBe("Poll failed")
  })

  // A tracker's text, a library's message, or a log line saying "invalid"
  // outside those places reads as whatever else it is.
  it.each<[string, string | undefined, string]>([
    [
      'Tracker API error: 500 Credentials are missing or invalid for tracker "x"',
      "Poll failed",
      "API returned 500",
    ],
    ["Tracker API error: 400 Bad Request: invalid token", "Poll failed", "API returned 400"],
    ["Tracker API error: 503 invalid upstream", "Poll failed", "API returned 503"],
    ["Failed to connect to lst.gg: ERR_TLS_CERT_ALTNAME_INVALID", "Poll failed", "Poll failed"],
    ["Failed to connect to qbt.lan: ERR_TLS_CERT_ALTNAME_INVALID", undefined, "Connection failed"],
    ["Invalid time value", "Poll failed", "Poll failed"],
    [
      "Failed to connect to lst.gg via proxy: Received invalid Socks5 initial handshake (no accepted authentication type)",
      "Poll failed",
      "Proxy connection failed",
    ],
    [
      'Failed to connect to lst.gg via proxy: Invalid header from proxy CONNECT response: "x"',
      "Poll failed",
      "Proxy connection failed",
    ],
    [
      "TOTP verify rejected: invalid or expired pending token",
      "TOTP verify rejected: invalid or expired pending token",
      "TOTP verify rejected: invalid or expired pending token",
    ],
  ])("does not read %j as credentials", (raw, fallback, expected) => {
    expect(sanitizeNetworkError(raw, fallback)).toBe(expected)
  })

  it("maps qBittorrent's unreadable maindata to its own message, not the unreachable fallback", () => {
    const message = sanitizeNetworkError("qBittorrent sent an unexpected maindata response")

    expect(message).toBe("qBittorrent sent an unexpected response")
    expect(isUnreachableMessage(message)).toBe(false)
  })
})
