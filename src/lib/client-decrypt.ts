// src/lib/client-decrypt.ts
//
// Functions: decryptClientCredentials

import "server-only"

import { decrypt } from "@/lib/crypto"

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
    const cause = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to decrypt credentials for client "${client.name}": ${cause}`)
  }
}
