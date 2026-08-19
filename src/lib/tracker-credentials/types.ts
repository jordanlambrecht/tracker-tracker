// src/lib/tracker-credentials/types.ts
//
// Plaintext shape of a tracker's credential vault. This module deliberately has
// NO `import "server-only"`: the client sheet imports these types and the pure
// guard for inline validation, exactly like src/lib/notifications/types.ts.
//
// The ciphertext lives in ONE nullable TEXT column, `trackers.encrypted_credentials`
// — base64(iv[12] + authTag[16] + AES-256-GCM(json)). NULL means "no vault".
// Never write "" and never write a marker string: a truthy non-ciphertext value
// handed to decrypt() is exactly the LOCKDOWN_REVOKED trap.

/** Current plaintext schema version. Readers must keep handling v1 indefinitely. */
export const TRACKER_CREDENTIAL_VAULT_VERSION = 1

export interface TrackerCredentialField {
  /**
   * UNIQUE ACROSS THE WHOLE VAULT, not per-section — the reveal endpoint looks a
   * field up by id alone, with no section context.
   */
  id: string
  /** Human label shown next to the input, i.e. "NickServ password". */
  label: string
  /** The secret itself. May be an empty string; crypto.ts encrypts empty plaintext fine. */
  value: string
  /**
   * ABSENT MEANS SECRET. Fail closed.
   *
   * Do NOT read this property directly — an absent value is `undefined`, which is
   * falsy, so `if (field.secret)` fails OPEN and would render a NickServ password
   * in cleartext. Always go through `isFieldSecret()`.
   */
  secret?: boolean
}

export interface TrackerCredentialSection {
  /** Unique across the vault's sections, i.e. "irc". */
  id: string
  /** Section heading, i.e. "IRC". */
  title: string
  /** ARRAY ORDER IS DISPLAY ORDER. No sortOrder field, no reindex on delete. */
  fields: TrackerCredentialField[]
}

export interface TrackerCredentialVault {
  /**
   * Version hinge. Additive OPTIONAL keys (kind, hint, lastRotatedAt, section
   * icon, top-level notes) need NO migration — absent means default, and the
   * guard below tolerates unknown keys so they survive a round trip. A breaking
   * reshape bumps `v` and migrates LAZILY on read-then-write, because migration
   * needs the master key and therefore cannot run as a background job.
   */
  v: number
  /** ARRAY ORDER IS DISPLAY ORDER. */
  sections: TrackerCredentialSection[]
}

/**
 * The ONLY correct way to ask whether a field is a secret.
 *
 * `secret` is optional and absent means secret, so a bare truthiness check on
 * the property fails open. This accessor fails closed: anything that is not
 * literally `false` is treated as a secret.
 */
export function isFieldSecret(field: Pick<TrackerCredentialField, "secret">): boolean {
  return field.secret !== false
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isCredentialField(value: unknown): value is TrackerCredentialField {
  if (!isPlainObject(value)) return false
  if (typeof value.id !== "string" || value.id.length === 0) return false
  if (typeof value.label !== "string") return false
  if (typeof value.value !== "string") return false
  // Absent is allowed (means secret). Present must be a real boolean — a string
  // "false" or a 0 would otherwise sneak through and be compared against `false`.
  if (value.secret !== undefined && typeof value.secret !== "boolean") return false
  return true
}

function isCredentialSection(value: unknown): value is TrackerCredentialSection {
  if (!isPlainObject(value)) return false
  if (typeof value.id !== "string" || value.id.length === 0) return false
  if (typeof value.title !== "string") return false
  if (!Array.isArray(value.fields)) return false
  return value.fields.every(isCredentialField)
}

/**
 * Shape guard for a decrypted vault. Returns false on ANY malformed input and
 * never throws. The sheet calls this on user-edited JSON and the reveal path
 * calls it on whatever came out of decrypt().
 *
 * Deliberately TOLERANT of unknown extra keys so that additive optional keys
 * written by a newer build round-trip unchanged through an older reader. It is
 * deliberately STRICT about `v`: an unknown version is a shape this code has
 * never seen, so it fails closed rather than guessing.
 *
 * This is a shape check only. Length limits, slug rules and vault-wide id
 * uniqueness are enforced by validate.ts on the write path.
 */
export function isTrackerCredentialVault(value: unknown): value is TrackerCredentialVault {
  if (!isPlainObject(value)) return false
  if (value.v !== TRACKER_CREDENTIAL_VAULT_VERSION) return false
  if (!Array.isArray(value.sections)) return false
  return value.sections.every(isCredentialSection)
}

/**
 * A definition of which credential fields a tracker HAS.
 *
 * CRITICAL BOUNDARY: this type structurally has NO `value`, and that is the
 * whole point. Definitions live in src/data/**, which is PUBLIC, git-committed
 * data describing which fields EXIST. They must NEVER hold a user's actual
 * VALUES. A contributor pasting their own passkey into a registry file would
 * leak it into git history forever, where it cannot be deleted.
 */
export interface TrackerCredentialFieldDefinition {
  /** Slug, unique within the definition set, i.e. "api_key". */
  id: string
  /** Human label, i.e. "API key". */
  label: string
  /** ABSENT MEANS SECRET. Same fail-closed rule as TrackerCredentialField. */
  secret?: boolean
  /** Optional hint rendered under the input, i.e. where to find the value. */
  hint?: string
}
