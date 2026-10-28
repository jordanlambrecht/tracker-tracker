// src/lib/tracker-credentials/gate.ts
//
// Functions: requireCredentialVaultEnabled
// Constants: CREDENTIAL_VAULT_DISABLED_ERROR
//
// The server half of the opt-in gate. The sheet shows an explanation and a link
// to the Settings toggle when the feature is off, but that is a UI courtesy,
// this is the part that actually holds. Without it, /reveal keeps handing out
// passkeys to anyone who can reach the URL while the user believes the feature
// is disabled, which makes the toggle decorative.
//
// GATES THE ROUTES, NOT THE DATA. Turning the toggle off never touches
// trackers.encrypted_credentials: the ciphertext stays, change-password keeps
// re-keying it, backups keep carrying it, and flipping the toggle back on
// restores every vault intact. See the column comment in schema.ts.

import "server-only"

import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { appSettings } from "@/lib/db/schema"

export const CREDENTIAL_VAULT_DISABLED_ERROR =
  "The credential vault is disabled. Enable it in Settings to store tracker credentials."

/**
 * Returns a 403 NextResponse when the vault feature is off, or null when it is
 * on, the same "response means stop" convention as authenticate().
 *
 * NO SETTINGS ROW MEANS DISABLED. A fresh or half-configured install must fail
 * CLOSED: defaulting an absent row to "enabled" would make the feature's default
 * depend on whether the settings row happened to exist yet.
 *
 * The body carries `credentialVaultDisabled: true` so the sheet can tell the
 * gate apart from any other 403 by a field rather than by string-matching an
 * error message that will eventually be reworded.
 */
export async function requireCredentialVaultEnabled(): Promise<NextResponse | null> {
  const [settings] = await db
    .select({ credentialVaultEnabled: appSettings.credentialVaultEnabled })
    .from(appSettings)
    .limit(1)

  if (!settings?.credentialVaultEnabled) {
    return NextResponse.json(
      { error: CREDENTIAL_VAULT_DISABLED_ERROR, credentialVaultDisabled: true },
      { status: 403 }
    )
  }
  return null
}
