// src/lib/download-clients/factory.ts

import { QbtClientAdapter } from "./adapters/qbt"
import { decryptClientCredentials } from "./credentials"
import type { ClientAdapter, ClientType, DownloadClientRow } from "./types"
import { assertClientType } from "./types"

/** Internal: create adapter from decrypted credentials + validated type. */
function createClientAdapter(
  type: ClientType,
  host: string,
  port: number,
  ssl: boolean,
  username: string,
  password: string
): ClientAdapter {
  switch (type) {
    case "qbittorrent":
      return new QbtClientAdapter(host, port, ssl, username, password)
    default:
      throw new Error(`Unsupported client type: "${type}"`)
  }
}

/**
 * Create an adapter from an encrypted client row. Handles credential decryption
 * and client type validation in one call. Eliminates the repeated
 * decrypt-then-create pattern across coordinator, fetch, and scheduler.
 */
export function createAdapterForClient(client: DownloadClientRow, key: Buffer): ClientAdapter {
  const { username, password } = decryptClientCredentials(client, key)
  return createClientAdapter(
    assertClientType(client.type),
    client.host,
    client.port,
    client.useSsl,
    username,
    password
  )
}
