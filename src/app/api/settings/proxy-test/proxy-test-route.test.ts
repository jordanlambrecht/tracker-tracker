// src/app/api/settings/proxy-test/proxy-test-route.test.ts
//
// Testing with the stored proxy password needs it to decrypt. One that won't is
// a value to enter again, the same text the poll stores, and no request goes out.

import { beforeEach, describe, expect, it, vi } from "vitest"
import { authenticate } from "@/lib/api-helpers"
import { encrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { PROXY_PASSWORD_UNREADABLE_ERROR } from "@/lib/error-utils"
import { proxyFetch } from "@/lib/tunnel"
import { POST } from "./route"

vi.mock("@/lib/api-helpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-helpers")>()
  return { ...actual, authenticate: vi.fn() }
})

vi.mock("@/lib/db", () => ({ db: { select: vi.fn() } }))

vi.mock("@/lib/tunnel", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tunnel")>()
  return { ...actual, proxyFetch: vi.fn() }
})

const VALID_KEY = "abcd1234".repeat(8)

function storedPassword(encryptedProxyPassword: string) {
  vi.mocked(db.select).mockReturnValue({
    from: () => ({ limit: async () => [{ encryptedProxyPassword }] }),
  } as unknown as ReturnType<typeof db.select>)
}

function testRequest() {
  return new Request("http://localhost/api/settings/proxy-test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      proxyType: "socks5",
      proxyHost: "proxy.example.test",
      proxyPort: 1080,
      proxyUsername: "user",
      useStoredPassword: true,
    }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(authenticate).mockResolvedValue({ encryptionKey: VALID_KEY })
})

describe("POST /api/settings/proxy-test with the stored password", () => {
  it("asks for a password that won't decrypt to be entered again", async () => {
    storedPassword(encrypt("CANARY-proxy-password", Buffer.alloc(32, 9)))

    const res = await POST(testRequest())

    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({ success: false, error: PROXY_PASSWORD_UNREADABLE_ERROR })
    expect(proxyFetch).not.toHaveBeenCalled()
  })
})
