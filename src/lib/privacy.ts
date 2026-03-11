// src/lib/privacy.ts
//
// Functions: maskUsername, isRedacted, redactedLength, REDACTED_PREFIX

/**
 * Prefix used to identify redacted values in the database.
 * Format: "▓<length>" i.e "▓7" for a 7-character original string.
 */
export const REDACTED_PREFIX = "▓"

/**
 * Replaces a plaintext string with a length-preserving redacted marker.
 * Returns null if input is null/undefined.
 */
export function maskUsername(value: string | null | undefined): string | null {
  if (!value) return null
  return `${REDACTED_PREFIX}${value.length}`
}

/**
 * Checks whether a stored value is a redacted marker.
 */
export function isRedacted(value: string | null | undefined): boolean {
  if (!value) return false
  return value.startsWith(REDACTED_PREFIX)
}

/**
 * Extracts the original character count from a redacted marker.
 * Returns null if the value is not redacted or has no valid length.
 */
export function redactedLength(value: string | null | undefined): number | null {
  if (!value || !isRedacted(value)) return null
  const num = parseInt(value.slice(REDACTED_PREFIX.length), 10)
  return Number.isFinite(num) ? num : null
}
