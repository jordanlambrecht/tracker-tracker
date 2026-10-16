// src/lib/tracker-platforms/helpers/cookie-credentials.ts
//
// Functions: formatFieldList, parseCredentialJson

// ---------------------------------------------------------------------------
// Credential parsing for adapters whose tracker has no API. They take a JSON
// blob in the apiToken field, and sharing the checks keeps the wording users
// see consistent.
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
 * non-empty string. Values are returned as written, callers apply their own
 * normalization, since only some fields tolerate trimming.
 *
 * `optionalFields` may be absent from the blob entirely, but when present must
 * be strings; blank is allowed, callers decide whether blank means absent.
 * This is where credential fields only some accounts need are parsed
 * (TorrentLeech alt2FAToken), so adapters do not each re-parse the blob.
 */
export function parseCredentialJson<
  F extends readonly string[],
  O extends readonly string[] = readonly never[],
>(
  apiToken: string,
  label: string,
  fields: F,
  optionalFields?: O
): Record<F[number], string> & Partial<Record<O[number], string>> {
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

  for (const field of optionalFields ?? []) {
    const value = (record as Record<string, unknown>)[field]
    if (value !== undefined && typeof value !== "string") {
      throw new Error(`${label} credentials: ${field} must be a string`)
    }
  }

  return record as Record<F[number], string> & Partial<Record<O[number], string>>
}
