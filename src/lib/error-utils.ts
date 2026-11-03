// src/lib/error-utils.ts
//
// Functions: errMsg, sanitizeNetworkError, isUnreachableMessage, isDecryptionError,
//            isUnreadableClientCredential, classifyFetchError, classifyProxyFetchError

/** Extracts a string message from an unknown error value. */
export function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/**
 * Returns true when decrypt() could not read a stored value: an AES-256-GCM
 * authentication failure, a key/ciphertext mismatch, or a ciphertext too short
 * to hold its IV and tag. authenticate() has already refused a stale session, so
 * the value was sealed under another key or cut short, which a restore or a
 * recover.cjs reset can leave. Logging in again never fixes that. Entering the
 * credential again does. Run it over decrypt()'s own error only, since a TLS
 * ERR_SSL_DECRYPTION_FAILED code from a network call matches it too.
 */
export function isDecryptionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return /decrypt|authenticate\s*data|bad\s*decrypt|invalid\s*key|invalid\s*ciphertext|EVP_/i.test(
    error.message
  )
}

// The two wrappers credentials.ts puts around a decrypt() failure. Behind either
// one is a stored value that will not read: sealed under another key, or a
// ciphertext too short to hold its IV and tag.
const UNREADABLE_CLIENT_CREDENTIAL =
  /^(decrypt credentials failed|Failed to read credentials) for client /

/** True for credentials.ts's errors alone, never for a network fault that mentions decryption. */
export function isUnreadableClientCredential(error: unknown): boolean {
  return error instanceof Error && UNREADABLE_CLIENT_CREDENTIAL.test(error.message)
}

// What an unreadable stored credential shows, one line per kind. credentials.ts
// wraps a client's URL path the same way as its password or API key.
export const TRACKER_CREDENTIALS_UNREADABLE_ERROR =
  "Stored credentials for this tracker can't be read. Enter them again in its settings"
export const CLIENT_CREDENTIALS_UNREADABLE_ERROR =
  "Stored credentials or URL path can't be read. Enter them again in this client's settings"
export const PROWLARR_KEY_UNREADABLE_ERROR =
  "Stored API key can't be read. Enter it again in this Prowlarr instance's settings"
// A Prowlarr instance saved with no API key.
export const PROWLARR_NO_API_KEY_ERROR = "No API key stored. Enter the Prowlarr API key"
export const MOUSEHOLE_TOKEN_UNREADABLE_ERROR =
  "Stored Mousehole API token can't be read. Enter it again in this tracker's settings"
export const PROXY_PASSWORD_UNREADABLE_ERROR =
  "Stored proxy password can't be read. Enter it again in the proxy settings"
export const PROXY_UNUSABLE_ERROR =
  "Proxy settings can't be used. Check the proxy type, host and port in Settings"
// What a proxy save or test answers for a host the agent build refuses. Worded
// to fit a port in the host, a bare IPv6 address and an address the type can't
// parse alike.
export const PROXY_HOST_UNUSABLE_ERROR =
  "Proxy host can't be used. Enter a hostname or IP address without a port (use the Port field), and write an IPv6 address in brackets, like [::1]"
// What tunnel.ts's refusing agent fails every proxied request with, one per fault.
export const PROXY_PASSWORD_UNREADABLE_CAUSE = "Unreadable stored proxy password"
export const PROXY_UNUSABLE_CAUSE = "Unusable proxy settings"
// What the tracker transports fail a request with when the proxy refuses its own login.
export const PROXY_AUTH_REQUIRED_CAUSE = "407 Proxy Authentication Required"
const PROXY_PASSWORD_UNREADABLE = new RegExp(
  `^Failed to connect to \\S+ via proxy: ${PROXY_PASSWORD_UNREADABLE_CAUSE}$`
)
const PROXY_UNUSABLE = new RegExp(`^Failed to connect to \\S+ via proxy: ${PROXY_UNUSABLE_CAUSE}$`)

// The app's own credential refusals, each anchored to the start of the message,
// where only the app puts these phrases, so a tracker's or a library's text
// saying "invalid" can't read as one.
const CREDENTIAL_REFUSALS: readonly RegExp[] = [
  /^(?:API key is|Credentials are) missing or invalid for tracker "/,
  /^Invalid (?:API token|username): /,
  /^Invalid (?:TorrentLeech|Luminance) credentials$/,
  /^Invalid BTN API key$/,
  /^DigitalCore credentials: (?:uid|pass) contains invalid characters /,
  /^MAM session cookie \(mam_id\) contains invalid characters /,
]

// How four adapters open the error of a reply that came back as a 200 envelope.
export const GAZELLE_STATUS_ERROR = "Gazelle API returned status"
export const GGN_STATUS_ERROR = "GGn API returned status"
export const HAWKE_REQUEST_ERROR = "Hawke API request failed on"
export const BTN_RPC_ERROR = "BTN API returned an error"
const ENVELOPE_ERROR = new RegExp(
  `^(?:${GAZELLE_STATUS_ERROR}: |${GGN_STATUS_ERROR}: |${HAWKE_REQUEST_ERROR} \\S+: |${BTN_RPC_ERROR}: )`
)

/**
 * Maps raw network/auth error messages to safe user-facing messages.
 * Raw errors go to server logs only, this produces the string stored in DB
 * and potentially shown in the UI.
 */
export function sanitizeNetworkError(raw: string, fallback = "Connection failed"): string {
  // The wrappers pollTracker and credentials.ts put around a stored credential
  // that will not decrypt. Matched from the start, where only they put the phrase.
  if (/^Unreadable stored credential for tracker /.test(raw)) {
    return TRACKER_CREDENTIALS_UNREADABLE_ERROR
  }
  if (UNREADABLE_CLIENT_CREDENTIAL.test(raw)) return CLIENT_CREDENTIALS_UNREADABLE_ERROR
  // classifyProxyFetchError's wrapper around the refusing agent's failures.
  if (PROXY_PASSWORD_UNREADABLE.test(raw)) return PROXY_PASSWORD_UNREADABLE_ERROR
  if (PROXY_UNUSABLE.test(raw)) return PROXY_UNUSABLE_ERROR
  // Ahead of every looser rule: the scheduler's wrappers quote the tracker's
  // name, and a tracker called "Timeout Club" must not read as a timeout.
  if (CREDENTIAL_REFUSALS.some((rule) => rule.test(raw))) return "Invalid credentials"
  // validateCookieHeader's refusals, raised by the cookie adapters before any
  // request. Their own text is long and matches no rule, so each read "Poll failed".
  if (/^Cookie string contains a control character /.test(raw)) {
    return "Stored cookie contains a control character. Paste the full Cookie value again in this tracker's settings"
  }
  if (/^Cookie string contains a non-ASCII character /.test(raw)) {
    return "Stored cookie contains a non-ASCII character, usually a truncation mark. Paste the full Cookie value again in this tracker's settings"
  }
  if (/^It looks like you pasted a cookie name \(/.test(raw)) {
    return "Stored cookie is a cookie name, not the Cookie value. Paste the full Cookie value again in this tracker's settings"
  }
  if (/^Cookie string doesn't look right\. It should contain key=value pairs /.test(raw)) {
    return "Stored cookie has no name=value pairs. Paste the full Cookie value again in this tracker's settings"
  }
  // The name comes from the adapter's own list, never from the stored value.
  const missingCookie = raw.match(/^Cookie string has no ([\w.-]+) cookie\. /)
  if (missingCookie) {
    return `Stored cookie has no ${missingCookie[1]} cookie. Paste the full Cookie value again in this tracker's settings`
  }
  // The one place a tracker's text classifies. On these four platforms a bad key
  // comes back as a 200 envelope whose text is the only signal, so envelope text
  // saying "invalid" reads as credentials. A rare request error worded that way,
  // such as "invalid id parameter", reads as credentials too.
  const envelope = raw.match(ENVELOPE_ERROR)
  if (envelope && /invalid/i.test(raw.slice(envelope[0].length))) return "Invalid credentials"
  // Transmission outcomes come next. Its credential and oversized messages
  // would match the qBittorrent rules below and name the wrong client, and the
  // rest would reach the fallback, which reads as unreachable. Each rule matches
  // a whole phrase, since a hostname can contain the word Transmission.
  if (/Transmission (rejected the|requires a) username and password/i.test(raw)) {
    return "Credentials rejected by Transmission. Check the username and password"
  }
  if (/Transmission has no API-key authentication/i.test(raw)) {
    return "Transmission has no API key login. Set this client to username and password"
  }
  if (/Transmission refused the request\. Either its IP whitelist/i.test(raw)) {
    return "Transmission refused the connection. Check its IP whitelist, or restart it if its anti-brute-force lockout tripped"
  }
  if (/Transmission refused the hostname/i.test(raw)) {
    return "Transmission refused this hostname. Add it to rpc-host-whitelist, or turn on password authentication"
  }
  if (/Transmission returned an oversized response/i.test(raw)) {
    return "Transmission returned an oversized response"
  }
  if (/Transmission RPC error: 3\d\d/i.test(raw)) {
    return "Transmission redirected the request. Check the URL path"
  }
  if (/Transmission RPC error: 40[45]/i.test(raw)) {
    return "Transmission's RPC was not found at this address. Check the port and URL path"
  }
  // The replay carried the id the first 409 handed back, so a second 409 means
  // the id did not reach the daemon, or rotated between the two requests.
  if (/Transmission RPC error: 409/i.test(raw)) {
    return "Transmission did not accept the session id. Check that any proxy in front of it passes the X-Transmission-Session-Id header"
  }
  if (/Transmission sent an unexpected response|Transmission returned 409 without/i.test(raw)) {
    return "Transmission sent an unexpected response"
  }
  if (/Transmission refused the RPC call/i.test(raw)) return "Transmission refused the request"
  // Any status left over. Only the digits are kept, never the status text.
  const transmissionStatus = raw.match(/Transmission RPC error: (\d{3})/i)
  if (transmissionStatus) return `Transmission returned HTTP ${transmissionStatus[1]}`
  // qBittorrent auth outcomes next. These need different user action from
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
  // Refusals the qBittorrent transport raises on a host that did answer. The
  // fallback would read as unreachable to isUnreachableMessage.
  if (/exceeded \d+ bytes and was refused/i.test(raw)) {
    return "qBittorrent returned an oversized response"
  }
  if (/session cookie contained an unsafe character/i.test(raw)) {
    return "qBittorrent sent an unsafe session cookie"
  }
  if (/^qBittorrent sent an unexpected (?:maindata|torrent list|non-JSON) response$/.test(raw)) {
    return "qBittorrent sent an unexpected response"
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
  // Any status left over except 401 and 403, which the auth rule below reads.
  // Only the digits are kept, never the status text.
  const qbtStatus = raw.match(/qBittorrent API error: (?!40[13]\b)(\d{3})/i)
  if (qbtStatus) return `qBittorrent returned HTTP ${qbtStatus[1]}`
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
  // Luminance login refusals, the same kind of static strings. A wrong password
  // reads "Invalid credentials" from the list at the top.
  if (/Luminance login refused: the account is disabled/i.test(raw)) {
    return "Account is disabled on the tracker. Log in on the site to see why"
  }
  if (/Luminance login refused: the password is in a known breach/i.test(raw)) {
    return "Tracker refused the password as breached. Change it on the site, then update it here"
  }
  if (/Luminance login refused: the account uses two-factor login/i.test(raw)) {
    return "Two-factor login is on for this account. Add a session cookie from a browser login to the tracker's credentials"
  }
  // A tracker answer the adapter could not use, such as a 2xx body it could
  // not read or a scraper's redirect with no readable Location. "Unexpected
  // response from <host>: ..." is the wording the adapters and the shared fetch
  // helpers use (issue #214); the other three are parseBytes rejecting a byte
  // string ("", "1,024.50 GiB").
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
  // Anchored to the "API error: <status>" shape every caller throws. Log lines
  // that reach this carry ids, counts and durations with the same digits. Ahead
  // of the connection rules, since c411 and Nebulance append the tracker's own
  // text, and a refused key must not read as a timeout that gets retried.
  if (/API error: 40[13]\b/i.test(raw)) return "Authentication failed"
  if (/timed?\s*out/i.test(raw)) return "Request timed out"
  if (/ECONNREFUSED/i.test(raw)) return "Connection refused"
  // EAI_AGAIN is a DNS lookup that failed for now, not a name that is gone.
  if (/ENOTFOUND|EAI_AGAIN/i.test(raw)) return "Host not found"
  if (/EHOSTUNREACH/i.test(raw)) return "Host unreachable"
  if (/ECONNRESET/i.test(raw)) return "Connection reset"
  // Socket faults from Node and undici, matched only inside the transport
  // wrappers' "Failed to connect to <host>" shape. A tracker's own text can
  // quote its backend's errors.
  if (/^Failed to connect to .*\bENETUNREACH\b/.test(raw)) return "Host unreachable"
  if (/^Failed to connect to .*\b(ECONNABORTED|EPIPE|UND_ERR_SOCKET)\b/.test(raw)) {
    return "Connection reset"
  }
  if (/ip.*ban|ban.*ip|rate.?limit/i.test(raw)) return "IP temporarily banned by tracker"
  if (/Session expired/i.test(raw)) return "Session expired"
  // classifyProxyFetchError's wrapper. A tracker's own text that mentions a
  // proxy falls through to the rules below.
  if (/^Failed to connect to \S+ via proxy: /.test(raw)) return "Proxy connection failed"
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
