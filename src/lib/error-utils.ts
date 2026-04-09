// src/lib/error-utils.ts
//
// Functions: errMsg, sanitizeNetworkError, isDecryptionError, classifyFetchError

/** Extracts a string message from an unknown error value. */
export function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/**
 * Returns true when an error originates from AES-256-GCM authentication failure
 * or key/ciphertext mismatch — i.e. the session encryption key is stale.
 * Used by route handlers to distinguish key-mismatch (→ 401) from genuinely
 * missing or corrupt stored credentials (→ 422).
 */
export function isDecryptionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return /decrypt|authenticate\s*data|bad\s*decrypt|invalid\s*key|EVP_/i.test(error.message)
}

/**
 * Maps raw network/auth error messages to safe user-facing messages.
 * Raw errors go to server logs only — this produces the string stored in DB
 * and potentially shown in the UI.
 */
export function sanitizeNetworkError(raw: string, fallback = "Connection failed"): string {
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
  // Use inner cause message if available. For the outer error, only use
  // message from TypeError (always "fetch failed", safe). Other error messages
  // may contain URLs with embedded API tokens, so fall back to name only.
  const detail =
    inner?.message || (err instanceof TypeError ? effective?.message : null) || name || "Unknown"
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
