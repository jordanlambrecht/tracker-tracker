// src/lib/adapters/cookie-credentials.ts
//
// Functions: formatFieldList, parseCredentialJson, validateCookieHeader

// ---------------------------------------------------------------------------
// Credential parsing for adapters whose tracker has no API.
//
// These adapters take a JSON blob in the apiToken field rather than a plain
// token, and the cookie-based ones repeated the same hygiene checks verbatim.
// Keeping the checks here means a new scraping adapter inherits them, and the
// wording users see when they paste something wrong stays consistent.
// ---------------------------------------------------------------------------

/** "a, b, and c" / "a and b" / "a" */
function formatFieldList(fields: readonly string[], suffix = ""): string {
  const labelled = fields.map((f) => `${f}${suffix}`)
  if (labelled.length <= 1) return labelled[0] ?? ""
  if (labelled.length === 2) return `${labelled[0]} and ${labelled[1]}`
  return `${labelled.slice(0, -1).join(", ")}, and ${labelled.at(-1)}`
}

/**
 * Parses the JSON credential blob and asserts every required field is a
 * non-empty string. Values are returned as written — callers apply their own
 * normalization, since only some fields tolerate trimming.
 */
export function parseCredentialJson<F extends readonly string[]>(
  apiToken: string,
  label: string,
  fields: F
): Record<F[number], string> {
  let parsed: unknown
  try {
    parsed = JSON.parse(apiToken)
  } catch {
    throw new Error(`${label} credentials must be a JSON object with ${formatFieldList(fields)}`)
  }

  const record = parsed as Record<string, unknown> | null
  const missing =
    typeof parsed !== "object" ||
    record === null ||
    fields.some((field) => typeof record[field] !== "string")

  if (missing) {
    throw new Error(`${label} credentials must contain ${formatFieldList(fields, " (string)")}`)
  }

  for (const field of fields) {
    if (!(record as Record<string, string>)[field].trim()) {
      throw new Error(`${label} credentials: ${field} cannot be empty`)
    }
  }

  return record as Record<F[number], string>
}

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
      `Cookie string doesn't look right — it should contain key=value pairs (i.e. ${options.example})`
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
