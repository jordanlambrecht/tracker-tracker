// src/lib/download-clients/__tests__/factory.test.ts

import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/download-clients/qbt/transport", () => ({
  buildBaseUrl: vi.fn(() => "http://localhost:8080"),
  login: vi.fn(),
  getTorrents: vi.fn(),
  getTransferInfo: vi.fn(),
  syncMaindata: vi.fn(),
  invalidateSession: vi.fn(),
  withSessionRetry: vi.fn(),
}))

vi.mock("@/lib/download-clients/credentials", () => ({
  decryptClientCredentials: vi.fn(() => ({
    authMethod: "password",
    username: "admin",
    password: "pass",
  })),
}))

import {
  getTransferInfo,
  login,
  withSessionRetry,
} from "@/lib/download-clients/qbt/transport"
import { decryptClientCredentials } from "../credentials"
import { createAdapterForClient } from "../factory"

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
