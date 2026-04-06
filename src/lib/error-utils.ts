// src/lib/error-utils.ts
//
// Functions: sanitizeNetworkError, isDecryptionError, classifyConnectionError

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
 * Classify a connection error for user-facing display. Returns a parenthesized
 * detail suffix (i.e. " (timed out)") or empty string if unrecognized.
 * Used by route handlers and coordinator to append context to error messages.
 */
export function classifyConnectionError(raw: string): string {
  if (/timed?\s*out/i.test(raw)) return " (timed out)"
  if (/ECONNREFUSED/i.test(raw)) return " (connection refused)"
  if (/40[13]/.test(raw)) return " (auth failed)"
  return ""
}
