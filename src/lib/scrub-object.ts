// src/lib/scrub-object.ts
//
// Functions: scrubObject
// Redacts sensitive keys from raw API response objects before sending to clients.

export const SCRUB_KEYS = new Set(["authkey", "passkey", "ip", "api_token", "key", "torrent_pass"])

export function scrubObject(obj: unknown, depth = 0): unknown {
  if (depth > 10) return obj
  if (obj === null || typeof obj !== "object") {
    return typeof obj === "bigint" ? obj.toString() : obj
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => scrubObject(item, depth + 1))
  }
  const result: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (SCRUB_KEYS.has(k.toLowerCase())) {
      result[k] = "[redacted]"
    } else {
      result[k] = scrubObject(v, depth + 1)
    }
  }
  return result
}
