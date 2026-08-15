// src/lib/download-clients/credentials.ts
import "server-only"

import { decrypt } from "@/lib/crypto"
import { downloadClients } from "@/lib/db/schema"
import { isDecryptionError } from "@/lib/error-utils"
import { assertAuthMethod, type ClientCredentials } from "./types"

/** Columns needed for client connection + credential decryption. */
export const CLIENT_CONNECTION_COLUMNS = {
  name: downloadClients.name,
  host: downloadClients.host,
  port: downloadClients.port,
  useSsl: downloadClients.useSsl,
  authMethod: downloadClients.authMethod,
  encryptedUsername: downloadClients.encryptedUsername,
  encryptedPassword: downloadClients.encryptedPassword,
} as const

export function decryptClientCredentials(
  client: { name: string; authMethod: string; encryptedUsername: string; encryptedPassword: string },
  key: Buffer
): ClientCredentials {
  try {
    const authMethod = assertAuthMethod(client.authMethod)
    // apikey mode stores the key encrypted in encryptedPassword and leaves
    // encryptedUsername as an encrypted empty string (unused) — see schema.ts.
    if (authMethod === "apikey") {
      return { authMethod, apiKey: decrypt(client.encryptedPassword, key) }
    }
    return {
      authMethod,
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
