// src/lib/tracker-credentials/cookie-header.ts
//
// Functions: validateCookieHeader
//
// Lives with the credential code rather than with the adapters because the
// credential form calls it too, and that form is reachable from a client
// component. Imports nothing, which is what keeps that safe.

/**
 * Cookie names users commonly paste on their own when they meant to copy the
 * whole header value. Entries are regex fragments, not literals.
 */
const COMMON_COOKIE_NAMES = [
  "cf_clearance",
  "[a-z]+x_session",
  "remember_web_\\w+",
  "XSRF-TOKEN",
] as const

/**
 * Normalizes and sanity-checks a pasted Cookie header, returning the cleaned
 * value. Catches the three mistakes that actually reach us: the "Cookie: "
 * prefix, a lone cookie name, and DevTools truncating a long value.
 */
export function validateCookieHeader(
  cookies: string,
  options: { extraCookieNames?: readonly string[]; example: string }
): string {
  // Strip "Cookie: " prefix if user copied from raw headers view
  const trimmed = cookies.trim().replace(/^Cookie:\s*/i, "")

  const names = [...COMMON_COOKIE_NAMES, ...(options.extraCookieNames ?? [])]
  const cookieNameOnly = new RegExp(`^(${names.join("|")})$`, "i")
  if (cookieNameOnly.test(trimmed)) {
    throw new Error(
      `It looks like you pasted a cookie name ("${trimmed}") instead of the full Cookie header value. Copy the entire value after "Cookie:" in DevTools.`
    )
  }

  // Should contain at least one key=value pair
  if (!trimmed.includes("=")) {
    throw new Error(
      `Cookie string doesn't look right. It should contain key=value pairs (i.e. ${options.example})`
    )
  }

  // Control characters, CR and LF above all, are never valid in a header value.
  // They arrive when someone copies a whole raw request-headers block instead of
  // the one value. Caught here rather than left to fetch(): undici rejects the
  // header with a TypeError that quotes it, which classifyFetchError flattens to
  // the bare name, so this is the layer that tells the user what went wrong.
  // The error below names the character by code point and never echoes the value.
  // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional control-char check
  const control = trimmed.match(/[\x00-\x1F\x7F]/)
  if (control) {
    const code = control[0].codePointAt(0)?.toString(16).toUpperCase().padStart(4, "0")
    throw new Error(
      `Cookie string contains a control character (U+${code}) at position ${control.index}. ` +
        "This usually means a whole block of request headers was copied instead of just the " +
        'Cookie value. Copy only the value after "Cookie:".'
    )
  }

  // HTTP headers only allow byte-safe characters (0-255). Non-ASCII chars like
  // ellipsis (U+2026) appear when DevTools truncates long values during copy.
  // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional byte-range check
  const nonAscii = trimmed.match(/[^\x00-\xFF]/)
  if (nonAscii) {
    const char = nonAscii[0]
    const code = char.codePointAt(0)
    const idx = nonAscii.index
    throw new Error(
      `Cookie string contains a non-ASCII character ("${char}", U+${code?.toString(16).toUpperCase().padStart(4, "0")}) at position ${idx}. ` +
        "This usually means the browser truncated a long value when copying. Re-copy the full cookie string from DevTools."
    )
  }

  return trimmed
}
