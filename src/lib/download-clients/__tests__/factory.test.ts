// src/lib/download-clients/__tests__/factory.test.ts

import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/download-clients/qbt/transport", () => ({
  buildBaseUrl: vi.fn(() => "http://localhost:8080"),
  login: vi.fn(),
  getTorrents: vi.fn(),
  getTransferInfo: vi.fn(),
  syncMaindata: vi.fn(),
  invalidateSession: vi.fn(),
  clearAuthBlocks: vi.fn(),
  withSessionRetry: vi.fn(),
}))

vi.mock("@/lib/download-clients/credentials", () => ({
  decryptClientCredentials: vi.fn(() => ({
    authMethod: "password",
    username: "admin",
    password: "pass",
    urlPath: "",
  })),
}))

import {
  getTransferInfo,
  invalidateSession,
  login,
  withSessionRetry,
} from "@/lib/download-clients/qbt/transport"
import { decryptClientCredentials } from "../credentials"
import { createAdapterForClient, disposeClient } from "../factory"

describe("createAdapterForClient", () => {
  it("decrypts credentials and creates a qbittorrent adapter", () => {
    const client = {
      name: "Test",
      host: "localhost",
      port: 8080,
      useSsl: false,
      authMethod: "password",
      encryptedUsername: "enc-user",
      encryptedPassword: "enc-pass",
      encryptedApiKey: "",
      encryptedUrlPath: "",
      crossSeedTags: null,
      type: "qbittorrent",
    }
    const key = Buffer.alloc(32, 0xab)
    const adapter = createAdapterForClient(client, key)
    expect(adapter.type).toBe("qbittorrent")
    expect(adapter.baseUrl).toBe("http://localhost:8080")
    expect(adapter.getDeltaSync).toBeDefined()
  })

  it("throws for unsupported client type", () => {
    const client = {
      name: "Bad",
      host: "localhost",
      port: 8080,
      useSsl: false,
      authMethod: "password",
      encryptedUsername: "enc-user",
      encryptedPassword: "enc-pass",
      encryptedApiKey: "",
      encryptedUrlPath: "",
      crossSeedTags: null,
      type: "deluge",
    }
    expect(() => createAdapterForClient(client, Buffer.alloc(32))).toThrow(
      /unsupported client type/i
    )
  })

  it("carries an apikey row through to an adapter that never opens a session", async () => {
    // The factory is where the auth mode crosses from the DB row into the
    // adapter. Pinning it here means a row saved as apikey cannot silently
    // come back as a password client.
    vi.mocked(decryptClientCredentials).mockReturnValueOnce({
      authMethod: "apikey",
      apiKey: "qbt_x",
      urlPath: "",
    })

    const adapter = createAdapterForClient(
      {
        name: "Test",
        host: "localhost",
        port: 8080,
        useSsl: false,
        authMethod: "apikey",
        encryptedUsername: "",
        encryptedPassword: "",
        encryptedApiKey: "enc-key",
        encryptedUrlPath: "",
        crossSeedTags: null,
        type: "qbittorrent",
      },
      Buffer.alloc(32)
    )

    vi.mocked(getTransferInfo).mockResolvedValueOnce({
      up_info_speed: 0,
      dl_info_speed: 0,
    } as Awaited<ReturnType<typeof getTransferInfo>>)

    await adapter.getTransferInfo()

    expect(getTransferInfo).toHaveBeenCalledWith("http://localhost:8080", {
      mode: "apikey",
      key: "qbt_x",
    })
    expect(withSessionRetry).not.toHaveBeenCalled()
    expect(login).not.toHaveBeenCalled()
  })
})

describe("disposeClient", () => {
  const row = {
    name: "Test",
    host: "localhost",
    port: 8080,
    useSsl: false,
    authMethod: "password",
    encryptedUsername: "enc-user",
    encryptedPassword: "enc-pass",
    encryptedApiKey: "",
    encryptedUrlPath: "",
    crossSeedTags: null,
    type: "qbittorrent",
  }

  it("drops what was cached under the row's URL", () => {
    vi.mocked(invalidateSession).mockClear()

    disposeClient(row, Buffer.alloc(32))

    expect(invalidateSession).toHaveBeenCalledWith("http://localhost:8080")
  })

  // The routes call this after the row is already written or deleted, so a
  // throw here would report a finished change as failed.
  it("does nothing for a row that will not decrypt under the key", () => {
    vi.mocked(invalidateSession).mockClear()
    vi.mocked(decryptClientCredentials).mockImplementationOnce(() => {
      throw new Error('decrypt credentials failed for client "Test": bad decrypt')
    })

    expect(() => disposeClient(row, Buffer.alloc(32))).not.toThrow()
    expect(invalidateSession).not.toHaveBeenCalled()
  })
})
