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
  decryptClientCredentials: vi.fn(() => ({ username: "admin", password: "pass" })),
}))

import { createAdapterForClient } from "../factory"

describe("createAdapterForClient", () => {
  it("decrypts credentials and creates a qbittorrent adapter", () => {
    const client = {
      name: "Test",
      host: "localhost",
      port: 8080,
      useSsl: false,
      encryptedUsername: "enc-user",
      encryptedPassword: "enc-pass",
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
      encryptedUsername: "enc-user",
      encryptedPassword: "enc-pass",
      crossSeedTags: null,
      type: "deluge",
    }
    expect(() => createAdapterForClient(client, Buffer.alloc(32))).toThrow(
      /unsupported client type/i
    )
  })
})
