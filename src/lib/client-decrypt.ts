// src/lib/client-decrypt.ts
//
// Functions: decryptClientCredentials

import "server-only"

import { decrypt } from "@/lib/crypto"
import { isDecryptionError } from "@/lib/error-utils"

export function decryptClientCredentials(
  client: { name: string; encryptedUsername: string; encryptedPassword: string },
  key: Buffer
): { username: string; password: string } {
  try {
    return {
      username: decrypt(client.encryptedUsername, key),
      password: decrypt(client.encryptedPassword, key),
    }
  } catch (err) {
    // Use "decrypt" prefix only for genuine AES-GCM auth failures so
    // isDecryptionError() in callers correctly classifies key mismatches.
    const cause = err instanceof Error ? err.message : String(err)
    if (isDecryptionError(err)) {
      throw new Error(`decrypt credentials failed for client "${client.name}": ${cause}`, {
        cause: err,
      })
    }
    throw new Error(`Failed to read credentials for client "${client.name}": ${cause}`, {
      cause: err,
    })
  }
}
