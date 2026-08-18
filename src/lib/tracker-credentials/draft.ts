// src/lib/tracker-credentials/draft.ts
//
// Functions: draftFromView, draftToInput, draftToValidationVault, isDraftDirty,
//            slugifyCredentialId, newDraftSection, newDraftField
//
// The sheet's editing model, kept OUT of the component so the rules below can be
// tested without rendering anything.
//
// The model exists because the sheet edits something it cannot see. A stored
// secret is never sent to the browser, so a draft field has to be able to say "I
// do not hold this value" as distinct from "I hold an empty value". That is
// `value: null` vs `value: ""`, and it maps straight onto the omitted-vs-present
// `value` that merge.ts keys on. Collapse those two and you either wipe secrets
// on every edit or make the Clear button do nothing.
//
// Deliberately PURE and client-safe: no "server-only", no next/server.

import type {
  TrackerCredentialFieldInput,
  TrackerCredentialVaultInput,
} from "@/lib/tracker-credentials/merge"
import type { TrackerCredentialFieldDefinition, TrackerCredentialVault } from "@/lib/tracker-credentials/types"
import { TRACKER_CREDENTIAL_VAULT_VERSION } from "@/lib/tracker-credentials/types"
import { MAX_ID_LENGTH } from "@/lib/tracker-credentials/validate"
import type { TrackerCredentialVaultView } from "@/lib/tracker-credentials/view"

export interface DraftField {
  /**
   * CLIENT identity only — a React key and nothing else. Never sent, never
   * stored. Separate from `id` because a brand-new field has no id yet, and
   * React still needs something stable to keep the input's cursor from jumping.
   */
  key: string
  /**
   * The STORED id, or null for a field the user just added.
   *
   * Null until the first save, at which point draftToInput() derives one from
   * the label. Deriving it lazily is what lets a field the user labelled
   * "Passkey" land as `passkey` instead of as `new_field`, while an id that has
   * already been stored stays frozen — it is the key the reveal endpoint uses,
   * so renaming a label must never move it.
   */
  id: string | null
  label: string
  secret: boolean
  /** Whether the SERVER reported a stored value at load time. Drives the •••• placeholder. */
  hasStoredValue: boolean
  /**
   * What the client holds. NULL MEANS "NOT HELD" — an unrevealed, unedited
   * secret — and serializes to an OMITTED `value`, which merge.ts reads as "keep
   * what is stored". `""` is a real value meaning "make it empty".
   */
  value: string | null
  /** Whether the value is currently rendered in cleartext. Always false for a fresh secret. */
  shown: boolean
}

export interface DraftSection {
  key: string
  /** Null for a section the user just added; derived from the title on save. */
  id: string | null
  title: string
  /** ARRAY ORDER IS DISPLAY ORDER — reordering is a splice, never a sortOrder field. */
  fields: DraftField[]
}

export interface DraftVault {
  sections: DraftSection[]
}

let draftKeySeq = 0
function nextKey(prefix: string): string {
  draftKeySeq += 1
  return `${prefix}${draftKeySeq}`
}

/**
 * Turn arbitrary text into a credential slug, matching validate.ts's rule
 * exactly: lowercase alphanumerics, `_` and `-`, starting alphanumeric, max 64.
 *
 * Returns "" when nothing usable survives (a label of "!!!" or of pure CJK), and
 * callers MUST handle that — see the `field_N` fallback in assignIds(). Returning
 * an empty string rather than inventing something here keeps the "is this
 * usable?" decision at the one place that knows what to count from.
 */
export function slugifyCredentialId(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, MAX_ID_LENGTH)
  // The pattern demands an alphanumeric FIRST character; a leading digit is fine
  // but a leading separator is not, and slice() above can leave a trailing one.
  return /^[a-z0-9]/.test(slug) ? slug.replace(/_+$/g, "") : ""
}

export function newDraftField(label = "New field", secret = true): DraftField {
  return {
    key: nextKey("f"),
    id: null,
    label,
    secret,
    hasStoredValue: false,
    // A brand-new field HOLDS an empty value rather than holding nothing: there
    // is nothing stored to preserve, and "" is what should be written if the
    // user saves without typing.
    value: "",
    shown: !secret,
  }
}

export function newDraftSection(title = "New section"): DraftSection {
  return { key: nextKey("s"), id: null, title, fields: [] }
}

/**
 * Build the editable draft for a sheet that has just opened.
 *
 * `view` null means the tracker has NO vault; defaults are consulted only then.
 * They SEED, they never merge.
 *
 * WHAT HAPPENS WHEN REGISTRY DEFAULTS CHANGE LATER: Nothing. Once a vault is
 * saved, `view` is non-null forever and this function never looks at `defaults`
 * again. The user's sections and fields are the whole truth.
 *
 * Deliberately chosen over merging new defaults in on open. A merge would
 * resurrect every field the user had deliberately deleted, on every open, with
 * no way to say no. Because a default's `label` would have to win to be worth
 * anything, it would also stomp labels the user had renamed. Not merging means a
 * user doesn't see newly-known fields until they add them. Merging means the app
 * argues with the user about their own data. The first is missing convenience.
 * The second is a bug report.
 */
export function draftFromView(
  view: TrackerCredentialVaultView | null,
  defaults: readonly TrackerCredentialFieldDefinition[]
): DraftVault {
  if (!view) {
    return {
      sections: [
        {
          key: nextKey("s"),
          id: "credentials",
          title: "Credentials",
          fields: defaults.map((definition) => ({
            key: nextKey("f"),
            // Seeded ids come STRAIGHT from the registry rather than from the
            // label, so the id a tracker's definition declares is the id that
            // ends up stored and revealed against.
            id: definition.id,
            label: definition.label,
            // ABSENT MEANS SECRET. Same fail-closed rule as everywhere else.
            secret: definition.secret !== false,
            hasStoredValue: false,
            value: "",
            shown: definition.secret === false,
          })),
        },
      ],
    }
  }

  return {
    sections: view.sections.map((section) => ({
      key: nextKey("s"),
      id: section.id,
      title: section.title,
      fields: section.fields.map((field) =>
        field.secret
          ? {
              key: nextKey("f"),
              id: field.id,
              label: field.label,
              secret: true,
              hasStoredValue: field.hasValue,
              // NOT HELD. The server never sent it, and this null is what keeps
              // it out of the next PUT.
              value: null,
              shown: false,
            }
          : {
              key: nextKey("f"),
              id: field.id,
              label: field.label,
              secret: false,
              hasStoredValue: field.value.length > 0,
              value: field.value,
              shown: true,
            }
      ),
    })),
  }
}

/**
 * Resolve every null id, so new sections and fields get stable slugs derived
 * from what the user typed.
 *
 * Uniqueness is checked against ids ALREADY TAKEN in this vault, including ones
 * assigned moments ago in the same pass — two fields both labelled "API key"
 * must not both become `api_key`, because the reveal endpoint resolves by id
 * alone and a duplicate would be ambiguous.
 */
function assignId(source: string, fallbackPrefix: string, taken: Set<string>): string {
  const base = slugifyCredentialId(source) || fallbackPrefix
  if (!taken.has(base)) {
    taken.add(base)
    return base
  }
  let n = 2
  while (taken.has(`${base}_${n}`)) n += 1
  const unique = `${base}_${n}`
  taken.add(unique)
  return unique
}

/**
 * Serialize the draft into the wire shape merge.ts expects.
 *
 * THE LOAD-BEARING RULE: a field whose `value` is null contributes NO `value`
 * key at all. Sending `value: null` or `value: ""` instead would blank the
 * user's stored secret; sending nothing tells the server to keep it.
 */
export function draftToInput(draft: DraftVault): TrackerCredentialVaultInput {
  const takenSectionIds = new Set<string>()
  const takenFieldIds = new Set<string>()
  // Ids that already exist are reserved FIRST, so a newly-derived id can never
  // collide with one that is already stored and already being revealed against.
  for (const section of draft.sections) {
    if (section.id) takenSectionIds.add(section.id)
    for (const field of section.fields) {
      if (field.id) takenFieldIds.add(field.id)
    }
  }

  return {
    v: TRACKER_CREDENTIAL_VAULT_VERSION,
    sections: draft.sections.map((section) => ({
      id: section.id ?? assignId(section.title, "section", takenSectionIds),
      title: section.title.trim(),
      fields: section.fields.map((field) => {
        const base: TrackerCredentialFieldInput = {
          id: field.id ?? assignId(field.label, "field", takenFieldIds),
          label: field.label.trim(),
          // ALWAYS sent explicitly, never omitted. merge.ts takes `secret` from
          // the input alone, so an omitted flag would silently re-secret a field
          // the user had marked public.
          secret: field.secret,
        }
        return field.value === null ? base : { ...base, value: field.value }
      }),
    })),
  }
}

/**
 * Project the draft into a complete vault for INLINE validation only.
 *
 * Values the client does not hold stand in as "", which makes the size-related
 * limits (MAX_VALUE_LENGTH, MAX_SERIALIZED_BYTES) an UNDER-estimate here. That
 * is fine and deliberate: this pass exists to catch the errors the user can
 * actually see and fix — a blank label, a duplicate id, too many sections —
 * before a round trip. The server re-validates the MERGED vault, and that check
 * is the authoritative one.
 */
export function draftToValidationVault(draft: DraftVault): TrackerCredentialVault {
  const input = draftToInput(draft)
  return {
    v: input.v,
    sections: input.sections.map((section) => ({
      id: section.id,
      title: section.title,
      fields: section.fields.map((field) => ({
        id: field.id,
        label: field.label,
        value: field.value ?? "",
        ...(field.secret === undefined ? {} : { secret: field.secret }),
      })),
    })),
  }
}

/**
 * Has the user changed anything worth warning about on close?
 *
 * Compares everything EXCEPT `key` and `shown`. Revealing a value is not an
 * edit — the sheet un-holds a revealed-but-unmodified value on hide precisely so
 * that looking at a secret never marks the form dirty and never prompts the user
 * to discard changes they did not make.
 */
export function isDraftDirty(current: DraftVault, original: DraftVault): boolean {
  const strip = (draft: DraftVault) =>
    JSON.stringify(
      draft.sections.map((section) => ({
        id: section.id,
        title: section.title,
        fields: section.fields.map((field) => ({
          id: field.id,
          label: field.label,
          secret: field.secret,
          value: field.value,
        })),
      }))
    )
  return strip(current) !== strip(original)
}
