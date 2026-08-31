// src/lib/tracker-credentials/decrypt.ts
import "server-only"

import { decrypt } from "@/lib/crypto"
import type { TrackerCredentialVault } from "@/lib/tracker-credentials/types"
import { isTrackerCredentialVault } from "@/lib/tracker-credentials/types"

/**
 * Decrypt → JSON.parse → shape guard, mirroring decryptNotificationConfig.
 *
 * Every failure mode collapses to ONE generic message. Crypto failures leak
 * oracle-ish detail ("unsupported state or unable to authenticate data" says the
 * auth tag was wrong, i.e. the key was wrong) and parse failures leak fragments
 * of plaintext in the SyntaxError ("Unexpected token h in JSON at position 12").
 * Neither ever reaches a caller.
 *
 * Callers must handle NULL themselves: NULL is "no vault", not an error, and
 * must never be passed here, an empty or marker string handed to decrypt() is
 * exactly the trap that produced LOCKDOWN_REVOKED.
 */
export function decryptTrackerCredentials(
  tracker: { name: string; encryptedCredentials: string },
  key: Buffer
): TrackerCredentialVault {
  let parsed: unknown
  try {
    const json = decrypt(tracker.encryptedCredentials, key)
    parsed = JSON.parse(json)
  } catch {
    // never surface raw crypto or parse error details
    throw new Error(`Credentials are missing or invalid for tracker "${tracker.name}"`)
  }
  if (!isTrackerCredentialVault(parsed)) {
    throw new Error(`Credentials are missing or invalid for tracker "${tracker.name}"`)
  }
  return parsed
}
