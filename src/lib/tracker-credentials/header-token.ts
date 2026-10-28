// src/lib/tracker-credentials/header-token.ts
//
// Functions: validateHeaderToken
//
// Lives with the credential code rather than with the adapters because the
// credential form calls it too, and that form is reachable from a client
// component. Imports nothing, which is what keeps that safe.

/**
 * Checks an API token an adapter is about to put in a request header, returning
 * it trimmed. A control character or anything above U+00FF is never part of a
 * working token, and left to the transport it either fails the request as a
 * connection error the user cannot act on or, for a TAB, goes out on the wire.
 * The errors name the character by code point and never echo the value, and
 * they open with "Invalid", which the sanitizer reads as a credential fault.
 */
export function validateHeaderToken(token: string): string {
  const trimmed = token.trim()

  // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional control-char check
  const control = trimmed.match(/[\x00-\x1F\x7F]/)
  if (control) {
    const code = control[0].codePointAt(0)?.toString(16).toUpperCase().padStart(4, "0")
    throw new Error(
      `Invalid API token: it contains a control character (U+${code}) at position ${control.index}. Re-copy the token with no surrounding text.`
    )
  }

  // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional byte-range check
  const nonLatin1 = trimmed.match(/[^\x00-\xFF]/)
  if (nonLatin1) {
    const code = nonLatin1[0].codePointAt(0)?.toString(16).toUpperCase().padStart(4, "0")
    throw new Error(
      `Invalid API token: it contains a non-Latin-1 character (U+${code}) at position ${nonLatin1.index}, usually a truncation mark. Re-copy the full token.`
    )
  }

  return trimmed
}
