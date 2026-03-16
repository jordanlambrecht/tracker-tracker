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
  } catch {
    throw new Error(`Credentials are missing or invalid for client "${client.name}"`)
  }
}
