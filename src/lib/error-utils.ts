// src/lib/error-utils.ts
//
// Functions: errMsg, sanitizeNetworkError, isUnreachableMessage, isDecryptionError,
//            classifyFetchError, classifyProxyFetchError

/** Extracts a string message from an unknown error value. */
export function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/**
 * Returns true when an error originates from AES-256-GCM authentication failure
 * or key/ciphertext mismatch. That is, the session encryption key is stale.
 * Used by route handlers to distinguish key-mismatch (→ 401) from genuinely
 * missing or corrupt stored credentials (→ 422).
 */
export function isDecryptionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return /decrypt|authenticate\s*data|bad\s*decrypt|invalid\s*key|EVP_/i.test(error.message)
}

/**
 * Maps raw network/auth error messages to safe user-facing messages.
 * Raw errors go to server logs only, this produces the string stored in DB
 * and potentially shown in the UI.
 */
export function sanitizeNetworkError(raw: string, fallback = "Connection failed"): string {
  // qBittorrent auth outcomes first, these need different user action from
  // each other and from a plain connection fault, so they must not fall
  // through to the generic ban/401 rules below (which would flatten them to
  // "IP temporarily banned by tracker" and "Authentication failed").
  if (/login through the URL path was refused/i.test(raw)) {
    return "Blank login rejected through the URL path. For Qui, check the client API key in the path. Otherwise enter the qBittorrent username and password"
  }
  if (/rejected the blank credentials/i.test(raw)) {
    return 'Blank credentials rejected. Enable "Bypass authentication for clients on localhost" in qBittorrent'
  }
  if (/rejected the username and password/i.test(raw)) {
    return "Credentials rejected by qBittorrent. Check the username and password"
  }
  if (/rejected the API key/i.test(raw)) {
    return "API key rejected by qBittorrent. Check it has not been rotated, and that the server is 5.2.0 or newer"
  }
  if (/banned this IP/i.test(raw)) {
    return "Banned by qBittorrent after too many failed logins. It will clear on its own"
  }
  // Three refusals the qBittorrent transport raises on a host that did answer.
  // The fallback would read as unreachable to isUnreachableMessage.
  if (/exceeded \d+ bytes and was refused/i.test(raw)) {
    return "qBittorrent returned an oversized response"
  }
  if (/session cookie contained an unsafe character/i.test(raw)) {
    return "qBittorrent sent an unsafe session cookie"
  }
  // `redirect: "manual"` surfaces a 3xx as a non-ok status rather than
  // following it, and the transport words every non-ok status the same way.
  if (/qBittorrent API error: 3\d\d/i.test(raw)) {
    return "qBittorrent redirected the request"
  }
  // A wrong port or URL path reaches a server, or a proxy route, with no
  // qBittorrent API behind it. Something answered, so the fallback, which reads
  // as unreachable, would be wrong.
  if (/qBittorrent API error: 40[45]/i.test(raw)) {
    return "qBittorrent's API was not found at this address. Check the port and URL path"
  }
  // The tracker proxy transport's own cap, worded differently and, through the
  // proxy branch, wrapped as a proxy failure that the rule further down would
  // otherwise read as the proxy being down.
  if (/Response exceeded \d+ byte limit/i.test(raw)) {
    return "Tracker returned an oversized response"
  }
  // TorrentLeech auth outcomes. Static strings the adapter throws verbatim,
  // kept because each needs different user action, like the qBittorrent rules.
  if (/requires 2FA/i.test(raw)) {
    return "TorrentLeech requires 2FA. Add your Alt 2FA Token (Site Profile => Alt 2FA Token) to this tracker's credentials"
  }
  if (/Alt 2FA Token/i.test(raw)) return "Invalid credentials or Alt 2FA Token"
  // FlareSolverr errors. An unreachable FlareSolverr makes the tracker unreachable
  // too. Other FlareSolverr failures are named as such, because the fix is in
  // FlareSolverr and not in the tracker.
  if (/FlareSolverr unreachable/i.test(raw)) return "FlareSolverr unreachable"
  if (/no FlareSolverr URL is set/i.test(raw)) return "FlareSolverr is not set up in Settings"
  if (/^FlareSolverr: .*time ?out/i.test(raw)) return "FlareSolverr timed out"
  if (/^FlareSolverr: /i.test(raw)) return "FlareSolverr could not load the page"
  // A tracker answer the adapter could not use, such as a 2xx body it could
  // not read or a scraper's redirect with no readable Location. "Unexpected
  // response from <host>: ..." is the wording the adapters and the shared fetch
  // helpers use (issue #214); the other three are parseBytes rejecting a byte
  // string ("", "1,024.50 GiB").
  // Matched before the generic rules on purpose: "Invalid byte format" and a
  // key called "invalid" in a listed payload would otherwise both fall into
  // the credential rule below and surface as "Invalid credentials".
  if (/Unexpected response from|Invalid byte format|Negative byte values|Unknown unit/i.test(raw)) {
    return "Tracker returned an unexpected response"
  }
  // The scrapers' Cloudflare challenge messages all open this way. What to do
  // differs (fresh cookies for most, nothing to refresh for TorrentLeech), so
  // the card names only the cause.
  if (/Cloudflare challenge detected/i.test(raw)) {
    return "Cloudflare challenge blocked the request"
  }
  // Scrapers that opt into following redirects refuse one off the tracker's own
  // origin, which would carry the session cookies to another host, and give up
  // on a loop. JSON API requests refuse every redirect. The tracker answered in
  // all three cases, so none is an unreachable host.
  if (/redirected off-site/i.test(raw)) return "Tracker redirected to another site"
  if (/Too many redirects from/i.test(raw)) return "Tracker redirected too many times"
  if (/answered with a \d{3} redirect/i.test(raw)) return "Tracker redirected the request"
  if (/timed?\s*out/i.test(raw)) return "Request timed out"
  if (/ECONNREFUSED/i.test(raw)) return "Connection refused"
  if (/ENOTFOUND/i.test(raw)) return "Host not found"
  if (/EHOSTUNREACH/i.test(raw)) return "Host unreachable"
  if (/ECONNRESET/i.test(raw)) return "Connection reset"
  if (/ip.*ban|ban.*ip|rate.?limit/i.test(raw)) return "IP temporarily banned by tracker"
  if (/401|403|Unauthorized|Forbidden/i.test(raw)) return "Authentication failed"
  if (/Session expired/i.test(raw)) return "Session expired"
  if (/Credentials.*missing|invalid/i.test(raw)) return "Invalid credentials"
  if (/proxy/i.test(raw)) return "Proxy connection failed"
  const apiMatch = raw.match(/Tracker API error: (\d+)/i)
  if (apiMatch) return `API returned ${apiMatch[1]}`
  return fallback
}

/**
 * True for the sanitizeNetworkError outputs that mean the host never
 * answered. Everything else is either a tracker that did answer
 * ("Authentication failed", "Tracker returned an unexpected response") or the
 * scheduler's catch-all ("Poll failed"), which covers connection faults whose
 * error code no rule here recognizes. A notification must not call either of
 * those unreachable.
 */
export function isUnreachableMessage(message: string): boolean {
  return UNREACHABLE_MESSAGES.has(message)
}

const UNREACHABLE_MESSAGES: ReadonlySet<string> = new Set([
  "Request timed out",
  "Connection refused",
  "Host not found",
  "Host unreachable",
  "Connection reset",
  "Proxy connection failed",
  "Connection failed",
  "FlareSolverr unreachable",
])

/**
 * Classifies a fetch() error into a human-readable Error.
 *
 * Node.js native fetch (undici) wraps all network failures in a TypeError
 * per the Fetch spec. The actual cause (ECONNREFUSED, timeout, TLS error,
 * etc.) is in `err.cause`. This helper unwraps the cause chain so callers
 * get a useful error message instead of the opaque "TypeError".
 */
export function classifyFetchError(err: unknown, hostname: string): Error {
  const inner = err instanceof TypeError ? unwrapCause(err) : null
  const effective =
    inner ??
    (err instanceof Error
      ? {
          name: err.name,
          message: err.message,
          code: "code" in err ? String((err as NodeJS.ErrnoException).code) : undefined,
        }
      : err !== null &&
          typeof err === "object" &&
          typeof (err as Record<string, unknown>).name === "string"
        ? { name: String((err as Record<string, unknown>).name), message: "", code: undefined }
        : null)

  const name = effective?.name ?? ""
  if (name === "TimeoutError" || name === "AbortError") {
    return new Error(`Request to ${hostname} timed out`)
  }
  if (effective?.code) {
    return new Error(`Failed to connect to ${hostname}: ${effective.code}`)
  }
  // Use the inner cause message if there is one. A bare TypeError is trusted
  // only when it says exactly "fetch failed": undici's header validation throws
  // a TypeError with no cause that quotes the whole header value, so any other
  // message falls back to the name.
  const outerMessage =
    err instanceof TypeError && effective?.message === "fetch failed" ? effective.message : null
  const detail = inner?.message || outerMessage || name || "Unknown"
  return new Error(`Failed to connect to ${hostname}: ${detail}`)
}

function unwrapCause(err: TypeError): { name: string; message: string; code?: string } | null {
  const cause = (err as { cause?: unknown }).cause
  if (!cause) return null
  // Some undici versions set cause to a string
  if (typeof cause === "string") return { name: "", message: cause, code: undefined }
  if (typeof cause !== "object") return null
  const c = cause as Record<string, unknown>
  if (typeof c.name === "string" || typeof c.message === "string" || typeof c.code === "string") {
    return {
      name: typeof c.name === "string" ? c.name : "",
      message: typeof c.message === "string" ? c.message : "",
      code: typeof c.code === "string" ? c.code : undefined,
    }
  }
  return null
}

/**
 * Classifies a proxyFetch rejection, worded the same for every tracker
 * transport so one sanitizer rule covers them all. proxyFetch rejects with a
 * plain Error that carries its reason in the message, which classifyFetchError
 * would reduce to the error's name or code.
 */
export function classifyProxyFetchError(err: unknown, hostname: string): Error {
  if (err instanceof Error && err.message.includes("timed out")) {
    return new Error(`Request to ${hostname} timed out (via proxy)`)
  }
  const detail = err instanceof Error ? err.message : "Unknown"
  return new Error(`Failed to connect to ${hostname} via proxy: ${detail}`)
}
