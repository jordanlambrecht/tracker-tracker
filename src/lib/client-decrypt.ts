// src/lib/client-decrypt.ts
import "server-only"

import { decrypt } from "@/lib/crypto"
import { downloadClients } from "@/lib/db/schema"
import { isDecryptionError } from "@/lib/error-utils"

/** Columns needed for client connection + credential decryption. */
export const CLIENT_CONNECTION_COLUMNS = {
  name: downloadClients.name,
  host: downloadClients.host,
  port: downloadClients.port,
  useSsl: downloadClients.useSsl,
  encryptedUsername: downloadClients.encryptedUsername,
  encryptedPassword: downloadClients.encryptedPassword,
} as const

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
    // Use "decrypt" prefix only for AES-GCM auth failures so
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
