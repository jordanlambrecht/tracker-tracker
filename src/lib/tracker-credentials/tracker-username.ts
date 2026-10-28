// src/lib/tracker-credentials/tracker-username.ts
//
// Functions: validateTrackerUsername
//
// Lives with the credential code for the reason header-token.ts does: the
// credential form calls it too, from a client component. Its one import,
// limits.ts, imports nothing, which is what keeps that safe.

import { TRACKER_USERNAME_MAX } from "@/lib/limits"

/**
 * Checks a username typed for a tracker whose API does not report one,
 * returning it trimmed. Every snapshot stores it and the profile card shows
 * it, so a control character or an overlong paste is refused here. The errors
 * name the character by code point and never echo the value, and they open
 * with "Invalid", which the sanitizer reads as a credential fault.
 */
export function validateTrackerUsername(raw: string): string {
  const username = raw.trim()

  // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional control-char check
  const control = username.match(/[\x00-\x1F\x7F]/)
  if (control) {
    const code = control[0].codePointAt(0)?.toString(16).toUpperCase().padStart(4, "0")
    throw new Error(
      `Invalid username: it contains a control character (U+${code}) at position ${control.index}.`
    )
  }

  if (username.length > TRACKER_USERNAME_MAX) {
    throw new Error(`Invalid username: it is longer than ${TRACKER_USERNAME_MAX} characters.`)
  }

  return username
}
