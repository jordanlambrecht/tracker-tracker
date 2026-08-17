// src/lib/tracker-credentials/validate.ts
//
// Functions: validateTrackerCredentialVault, isCredentialSlug, serializedVaultBytes
//
// Deliberately PURE and deliberately free of `next/server`: the credentials sheet
// imports this for inline validation, so anything server-only in here would be
// dragged into the browser bundle. Route handlers wrap the returned message in
// their own NextResponse. Same contract as validateNotificationConfig — returns
// null when valid, an error string when not.

import {
  isTrackerCredentialVault,
  TRACKER_CREDENTIAL_VAULT_VERSION,
  type TrackerCredentialVault,
} from "@/lib/tracker-credentials/types"

// ─── Limits ───────────────────────────────────────────────────────────────────
//
// WHY ANY LIMITS AT ALL: the vault is one encrypted blob in one TEXT column, so
// EVERY edit decrypts the whole thing, mutates it, and re-encrypts the whole
// thing. Cost is O(total vault size) per keystroke-ish save, not O(changed
// field). Unbounded input is therefore a denial-of-service vector against the
// single-user server: one 50 MB "field" makes every future read of that tracker
// — including the password-change re-key loop, which touches every row inside
// ONE transaction — allocate and AES that blob again. The re-key path is the
// dangerous one: it is the difference between a rotation that finishes and a
// rotation that times out mid-transaction.

/**
 * Max sections per vault. Sections are user-invented groupings ("IRC", "RSS",
 * "autodl"); a real tracker has a handful. 20 is far past any real layout while
 * still bounding the render loop and the per-section id-uniqueness scan.
 */
export const MAX_SECTIONS = 20

/**
 * Max fields across the WHOLE vault, not per section — the reveal endpoint looks
 * fields up by id alone, so the vault-wide count is what bounds that lookup and
 * what bounds the number of reveal round-trips a single sheet can trigger.
 */
export const MAX_FIELDS_PER_VAULT = 100

/**
 * Max length of a field label or a section title. These are UI strings shown in
 * a side sheet; 100 chars already overflows the column. Capped because they ride
 * inside the same encrypted blob as the secrets and so share its DoS surface.
 */
export const MAX_LABEL_LENGTH = 100

/**
 * Max length of a single field value. Generous on purpose: an autodl-irssi block
 * or a full announce URL list is genuinely multi-kilobyte, so a tight cap would
 * break the exact use case the feature exists for. 10 KB holds all of those and
 * still keeps a maxed-out vault well under the total cap below.
 */
export const MAX_VALUE_LENGTH = 10_000

/**
 * Max length of a field id or section id. Ids are slugs, not prose. 64 matches
 * the slug pattern's own bound so the two can never disagree.
 */
export const MAX_ID_LENGTH = 64

/**
 * Total serialized (UTF-8) size cap for the plaintext JSON, checked LAST as the
 * backstop. The per-item limits above multiply out to well over this, so this is
 * the number that actually decides how much work one decrypt/re-encrypt cycle
 * can ever be — including the change-password loop over every tracker row.
 * 64 KiB of plaintext is roughly 88 KB of base64 ciphertext per tracker.
 */
export const MAX_SERIALIZED_BYTES = 64 * 1024

/**
 * Ids must be STABLE SLUGS. They are the identity a reveal request is keyed on
 * and the join between a registry default definition and a stored field, so they
 * have to survive being put in a URL, a DOM id and a JSON key without escaping.
 * Lowercase alphanumerics, underscore and hyphen; must start alphanumeric so an
 * id can never read as a flag or a hidden-file-ish "-x" / "_x".
 */
const CREDENTIAL_SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/

export function isCredentialSlug(value: string): boolean {
  return CREDENTIAL_SLUG_RE.test(value)
}

/**
 * Truncate a rejected id before quoting it back in an error message.
 *
 * An id is echoed by the "must be a slug" and "duplicate" messages, and those
 * messages fire BEFORE any length check has passed — that is the whole point of
 * the slug check. Interpolating the raw value would let a 5 MB id become a 5 MB
 * error string sent back to the caller, which is the same denial-of-service the
 * limits above exist to prevent, just routed through the error path.
 */
function quoteId(id: string): string {
  return id.length > 80 ? `${id.slice(0, 80)}…` : id
}

/** UTF-8 byte length of the serialized vault. TextEncoder exists in Node and the browser. */
export function serializedVaultBytes(vault: TrackerCredentialVault): number {
  return new TextEncoder().encode(JSON.stringify(vault)).length
}

/**
 * Validate a vault about to be encrypted and stored.
 *
 * Returns null when valid, or a single human-readable error message. Checks run
 * cheapest-first — shape, then counts, then per-item lengths, then the total
 * serialized size — so a hostile payload is rejected before the expensive
 * whole-vault stringify.
 */
export function validateTrackerCredentialVault(value: unknown): string | null {
  if (!isTrackerCredentialVault(value)) {
    return `Credential vault must be a version ${TRACKER_CREDENTIAL_VAULT_VERSION} object with a sections array`
  }

  if (value.sections.length > MAX_SECTIONS) {
    return `Too many sections — the maximum is ${MAX_SECTIONS}`
  }

  const totalFields = value.sections.reduce((sum, section) => sum + section.fields.length, 0)
  if (totalFields > MAX_FIELDS_PER_VAULT) {
    return `Too many fields — the maximum is ${MAX_FIELDS_PER_VAULT} across all sections`
  }

  const sectionIds = new Set<string>()
  // Field ids are unique ACROSS THE VAULT, not per section: the reveal endpoint
  // resolves a field by id with no section context, so a duplicate id in another
  // section would make the reveal ambiguous and could hand back the wrong secret.
  const fieldIds = new Set<string>()

  for (const section of value.sections) {
    if (!isCredentialSlug(section.id)) {
      return `Section id "${quoteId(section.id)}" must be a slug — lowercase letters, digits, "-" and "_", starting with a letter or digit, max ${MAX_ID_LENGTH} characters`
    }
    if (sectionIds.has(section.id)) {
      return `Duplicate section id "${quoteId(section.id)}" — section ids must be unique`
    }
    sectionIds.add(section.id)

    if (!section.title.trim()) {
      return `Section "${quoteId(section.id)}" needs a title`
    }
    if (section.title.length > MAX_LABEL_LENGTH) {
      return `Section title for "${quoteId(section.id)}" is too long — the maximum is ${MAX_LABEL_LENGTH} characters`
    }

    for (const field of section.fields) {
      if (!isCredentialSlug(field.id)) {
        return `Field id "${quoteId(field.id)}" must be a slug — lowercase letters, digits, "-" and "_", starting with a letter or digit, max ${MAX_ID_LENGTH} characters`
      }
      if (fieldIds.has(field.id)) {
        return `Duplicate field id "${quoteId(field.id)}" — field ids must be unique across the whole vault`
      }
      fieldIds.add(field.id)

      if (!field.label.trim()) {
        return `Field "${quoteId(field.id)}" needs a label`
      }
      if (field.label.length > MAX_LABEL_LENGTH) {
        return `Label for "${quoteId(field.id)}" is too long — the maximum is ${MAX_LABEL_LENGTH} characters`
      }
      // An EMPTY value is explicitly allowed. crypto.ts encrypts empty plaintext
      // and its decrypt() bound was widened specifically so empty values survive
      // the change-password re-key; rejecting "" here would recreate that bug at
      // a higher layer. A user who has added the field but not the secret yet is
      // a normal state.
      if (field.value.length > MAX_VALUE_LENGTH) {
        return `Value for "${field.label}" is too long — the maximum is ${MAX_VALUE_LENGTH} characters`
      }
    }
  }

  const bytes = serializedVaultBytes(value)
  if (bytes > MAX_SERIALIZED_BYTES) {
    return `Credential vault is too large — the maximum is ${MAX_SERIALIZED_BYTES} bytes`
  }

  return null
}
