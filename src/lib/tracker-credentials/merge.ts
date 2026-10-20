// src/lib/tracker-credentials/merge.ts
//
// Functions: isTrackerCredentialVaultInput, mergeVaultInput
//
// WHY THIS MODULE HAS TO EXIST
//
// The reveal model and the storage model pull in opposite directions:
//   - the sheet loads MASKED, so the client never holds the secret plaintexts;
//   - the column is ONE encrypted blob, so a save rewrites the WHOLE vault.
//
// Put those together naively and the first time a user renames a section, the
// PUT carries every secret back as `undefined` and silently wipes the lot. That
// is the single most destructive bug this feature could ship with, and it would
// look like a successful save.
//
// So the write path takes an INPUT vault whose `value` is OPTIONAL, and this
// module fills the gaps from what is already stored:
//
//     value present (INCLUDING "")  →  replace with it
//     value absent                  →  keep the stored value for that field id
//     value absent, nothing stored  →  "" (a field the user added but left blank)
//
// The merged result is a complete vault, and only then does validate.ts run on
// it. Every limit is enforced in exactly one place, against what will actually
// be encrypted.
//
// Deliberately PURE and free of `next/server` and "server-only": the merge is
// unit-tested directly and the input types describe the wire shape the sheet
// sends, so both sides can share them.

import {
  TRACKER_CREDENTIAL_VAULT_VERSION,
  type TrackerCredentialField,
  type TrackerCredentialSection,
  type TrackerCredentialVault,
} from "@/lib/tracker-credentials/types"

/**
 * A field as the SHEET sends it.
 *
 * The one and only difference from the stored `TrackerCredentialField` is that
 * `value` is optional. That optionality is the entire point of the type. An
 * absent `value` is not "empty"; it is "I was not shown this secret, keep
 * whatever you have". The two are distinguished by `undefined` vs `""`, which is
 * why nothing on this path may coerce one into the other.
 */
export interface TrackerCredentialFieldInput {
  id: string
  label: string
  /** ABSENT MEANS SECRET. Same fail-closed rule as the stored shape. */
  secret?: boolean
  /** ABSENT MEANS "KEEP THE STORED VALUE". `""` means "make it empty". */
  value?: string
}

export interface TrackerCredentialSectionInput {
  id: string
  title: string
  /** ARRAY ORDER IS DISPLAY ORDER. The merge preserves it exactly. */
  fields: TrackerCredentialFieldInput[]
}

export interface TrackerCredentialVaultInput {
  v: number
  sections: TrackerCredentialSectionInput[]
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isFieldInput(value: unknown): value is TrackerCredentialFieldInput {
  if (!isPlainObject(value)) return false
  if (typeof value.id !== "string" || value.id.length === 0) return false
  if (typeof value.label !== "string") return false
  // `undefined` is meaningful here (keep stored), so it is allowed. But a null,
  // a number or an object is not and must not be coerced into a string later.
  if (value.value !== undefined && typeof value.value !== "string") return false
  if (value.secret !== undefined && typeof value.secret !== "boolean") return false
  return true
}

function isSectionInput(value: unknown): value is TrackerCredentialSectionInput {
  if (!isPlainObject(value)) return false
  if (typeof value.id !== "string" || value.id.length === 0) return false
  if (typeof value.title !== "string") return false
  if (!Array.isArray(value.fields)) return false
  return value.fields.every(isFieldInput)
}

/**
 * Shape guard for an incoming write. Never throws.
 *
 * Same tolerance/strictness split as the stored guard: unknown extra keys are
 * ALLOWED through (additive optional keys must survive a round trip), `v` is
 * PINNED (an unknown version is a shape this code has never seen). Slug rules,
 * lengths and id uniqueness are NOT checked here, they run in validate.ts on
 * the merged result, so they are enforced against the bytes actually stored.
 */
export function isTrackerCredentialVaultInput(
  value: unknown
): value is TrackerCredentialVaultInput {
  if (!isPlainObject(value)) return false
  if (value.v !== TRACKER_CREDENTIAL_VAULT_VERSION) return false
  if (!Array.isArray(value.sections)) return false
  return value.sections.every(isSectionInput)
}

// The keys this module knows how to merge. Anything else on a STORED object is
// an additive optional key written by some other (newer) build and gets carried
// across untouched. See the `v` contract in types.ts. The sheet never sends such
// keys, and the view layer strips them on the way out, so storage is the only
// place they survive. Dropping them here would quietly undo that contract the
// first time a user edited a label.
const KNOWN_FIELD_KEYS = new Set(["id", "label", "value", "secret"])
const KNOWN_SECTION_KEYS = new Set(["id", "title", "fields"])
const KNOWN_VAULT_KEYS = new Set(["v", "sections"])

function extraKeys(source: object, known: Set<string>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(source)) {
    if (!known.has(key)) out[key] = value
  }
  return out
}

/**
 * Index every stored field by id, ACROSS THE WHOLE VAULT rather than per
 * section. Field ids are unique vault-wide (validate.ts enforces it), so this
 * lookup is unambiguous. Being section-blind is a feature: moving a field from
 * one section to another carries its secret instead of blanking it.
 */
function indexStoredFields(vault: TrackerCredentialVault): Map<string, TrackerCredentialField> {
  const byId = new Map<string, TrackerCredentialField>()
  for (const section of vault.sections) {
    for (const field of section.fields) {
      if (!byId.has(field.id)) byId.set(field.id, field)
    }
  }
  return byId
}

function mergeField(
  input: TrackerCredentialFieldInput,
  stored: TrackerCredentialField | undefined
): TrackerCredentialField {
  const merged: TrackerCredentialField = {
    ...(stored ? extraKeys(stored, KNOWN_FIELD_KEYS) : {}),
    id: input.id,
    label: input.label,
    // THE LOAD-BEARING LINE. `!== undefined`, not a truthiness check. `""` is a
    // real, user-chosen value meaning "blank this out". `||` would turn that into
    // "keep the old secret", a clear that silently does nothing.
    value: input.value !== undefined ? input.value : (stored?.value ?? ""),
  }
  // `secret` comes from the INPUT alone, never from the stored field. Carrying a
  // stored `secret: false` forward under an input that omitted the flag would
  // fail OPEN. isFieldSecret() prevents exactly that direction. Omitted stays
  // omitted, which means secret.
  if (input.secret !== undefined) merged.secret = input.secret
  return merged
}

/**
 * Complete an incoming vault against what is currently stored.
 *
 * `existing` is null when there is no vault yet (the column is NULL). Every
 * field then starts from "". The result is a full `TrackerCredentialVault` and
 * still has to pass validateTrackerCredentialVault() before it is encrypted.
 * This function deliberately enforces no limits of its own so there is only one
 * place those live.
 */
export function mergeVaultInput(
  input: TrackerCredentialVaultInput,
  existing: TrackerCredentialVault | null
): TrackerCredentialVault {
  const storedFields = existing ? indexStoredFields(existing) : new Map()
  const storedSections = new Map<string, TrackerCredentialSection>()
  for (const section of existing?.sections ?? []) {
    if (!storedSections.has(section.id)) storedSections.set(section.id, section)
  }

  return {
    ...(existing ? extraKeys(existing, KNOWN_VAULT_KEYS) : {}),
    v: TRACKER_CREDENTIAL_VAULT_VERSION,
    sections: input.sections.map((section) => {
      const storedSection = storedSections.get(section.id)
      return {
        ...(storedSection ? extraKeys(storedSection, KNOWN_SECTION_KEYS) : {}),
        id: section.id,
        title: section.title,
        fields: section.fields.map((field) => mergeField(field, storedFields.get(field.id))),
      }
    }),
  }
}
