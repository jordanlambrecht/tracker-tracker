// src/lib/tracker-credentials/view.ts
//
// Functions: toVaultView
//
// The wire shape the sheet loads with, and the boundary that keeps secret
// plaintext out of it. Deliberately PURE and free of `next/server` and
// "server-only": the client imports these types to render the sheet.

import type {
  TrackerCredentialField,
  TrackerCredentialSection,
  TrackerCredentialVault,
} from "@/lib/tracker-credentials/types"
import { isFieldSecret } from "@/lib/tracker-credentials/types"

/**
 * A secret field as it goes over the wire.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THERE IS NO `value` PROPERTY HERE, AND THAT IS THE POINT.
 * Secrets are excluded STRUCTURALLY, not filtered out at the end. A masking
 * approach (copy the field, then blank or delete `value`) is one forgotten branch
 * away from leaking. TypeScript cannot tell you when that happens because the type
 * still has the property. Here the compiler rejects any attempt to put plaintext
 * on a secret field, so the reveal endpoint is the ONLY route a secret value can
 * travel by.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export interface TrackerCredentialSecretFieldView {
  id: string
  label: string
  secret: true
  /**
   * Whether a value is actually stored, so the sheet can distinguish "•••••"
   * from an empty field the user has not filled in yet. A boolean, not a
   * length: a length is a small plaintext oracle for short secrets.
   */
  hasValue: boolean
}

/**
 * A field the vault's owner explicitly marked `secret: false`. Examples are IRC
 * nicks and announce URLs. These carry their value because that's the entire
 * meaning of the flag: no reveal round-trip and no masking for data that isn't
 * secret. Note the fail-closed default: a field with `secret` ABSENT is secret
 * and ends up in the branch above, never here.
 */
export interface TrackerCredentialPublicFieldView {
  id: string
  label: string
  secret: false
  value: string
}

export type TrackerCredentialFieldView =
  TrackerCredentialSecretFieldView | TrackerCredentialPublicFieldView

export interface TrackerCredentialSectionView {
  id: string
  title: string
  /** ARRAY ORDER IS DISPLAY ORDER, preserved from the stored vault. */
  fields: TrackerCredentialFieldView[]
}

export interface TrackerCredentialVaultView {
  v: number
  sections: TrackerCredentialSectionView[]
}

function toFieldView(field: TrackerCredentialField): TrackerCredentialFieldView {
  // Built from named properties, never by spreading `field` and deleting keys.
  // A spread would carry `value` in by default and make the secret path depend
  // on a later delete. The fail-open shape this module exists to make impossible
  // uses explicit property listing. It also drops any unknown extra keys a newer
  // build may have written, which is the correct direction: unknown keys
  // round-trip through STORAGE untouched, but they have no business being echoed
  // to the client.
  if (isFieldSecret(field)) {
    return {
      id: field.id,
      label: field.label,
      secret: true,
      hasValue: field.value.length > 0,
    }
  }
  return {
    id: field.id,
    label: field.label,
    secret: false,
    value: field.value,
  }
}

function toSectionView(section: TrackerCredentialSection): TrackerCredentialSectionView {
  return {
    id: section.id,
    title: section.title,
    fields: section.fields.map(toFieldView),
  }
}

/**
 * Project a decrypted vault down to the shape the sheet loads with.
 *
 * Every secret value is dropped. The result is safe to hand to
 * NextResponse.json() as-is.
 */
export function toVaultView(vault: TrackerCredentialVault): TrackerCredentialVaultView {
  return {
    v: vault.v,
    sections: vault.sections.map(toSectionView),
  }
}
