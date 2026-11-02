// src/lib/__tests__/tunnel-proxy-password.test.ts
//
// A stored proxy password that won't decrypt must not become a request without
// the proxy's auth, nor one that skips the proxy. The agent built for it fails
// every request before any connection opens, and the poll stores a line that
// names the password and is never retried. No password, or one that decrypts,
// keeps the agent it always had.

import net from "node:net"
import type { SocksProxyAgent } from "socks-proxy-agent"
import { afterEach, describe, expect, it, vi } from "vitest"
import { encrypt } from "@/lib/crypto"
import { PROXY_PASSWORD_UNREADABLE_ERROR, sanitizeNetworkError } from "@/lib/error-utils"
import { adapterFetch } from "@/lib/tracker-platforms/helpers/adapter-fetch"
import { isRetryablePollError } from "@/lib/tracker-status"
import { buildProxyAgentFromSettings } from "@/lib/tunnel"

const KEY = Buffer.alloc(32, 1)
const OTHER_KEY = Buffer.alloc(32, 2)
const CANARY = "CANARY-proxy-password"
const CANARY_SPECIAL = "CANARY p@ss:w/rd?#%25 é😀 !~*'()"
const USER_SPECIAL = "us er@home/?#%"

function proxySettings(encryptedProxyPassword: string | null) {
  return {
    proxyEnabled: true,
    proxyType: "socks5",
    proxyHost: "proxy.example.test",
    proxyPort: 1080,
    proxyUsername: "user",
    encryptedProxyPassword,
  }
}

describe("buildProxyAgentFromSettings and the stored proxy password", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  // Every TCP and TLS connection, the SOCKS client's own included, goes through
  // net.Socket's connect.
  it("refuses every proxied request before any connection opens", async () => {
    const connect = vi.spyOn(net.Socket.prototype, "connect")
    const proxyAgent = buildProxyAgentFromSettings(proxySettings(encrypt(CANARY, OTHER_KEY)), KEY)

    const err = await adapterFetch("https://tracker.example/api/user", "tracker.example", {
      proxyAgent,
    }).then(
      () => null,
      (e: unknown) => (e instanceof Error ? e : null)
    )

    expect(err?.message).toBe(
      "Failed to connect to tracker.example via proxy: Unreadable stored proxy password"
    )
    expect(connect).not.toHaveBeenCalled()
  })

  it("would see a proxy connection being opened", async () => {
    // A local proxy that hangs up at once, so the attempt ends quickly.
    const server = net.createServer((socket) => socket.destroy())
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
    const { port } = server.address() as net.AddressInfo
    const connect = vi.spyOn(net.Socket.prototype, "connect")
    try {
      const proxyAgent = buildProxyAgentFromSettings(
        { ...proxySettings(encrypt(CANARY, KEY)), proxyHost: "127.0.0.1", proxyPort: port },
        KEY
      )

      await adapterFetch("https://tracker.example/api/user", "tracker.example", {
        proxyAgent,
      }).catch(() => {})

      expect(connect).toHaveBeenCalled()
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })

  it("stores a line that names the password, which is never retried", () => {
    const message = sanitizeNetworkError(
      "Failed to connect to tracker.example via proxy: Unreadable stored proxy password",
      "Poll failed"
    )

    expect(message).toBe(PROXY_PASSWORD_UNREADABLE_ERROR)
    expect(isRetryablePollError(message)).toBe(false)
  })

  it("reads that line only from the proxy wrapper, never from a tracker's text", () => {
    expect(
      sanitizeNetworkError(
        "Hawke API request failed on hawke.uno: Unreadable stored proxy password",
        "Poll failed"
      )
    ).not.toBe(PROXY_PASSWORD_UNREADABLE_ERROR)
  })

  it("keeps the agent without auth when no password is stored", () => {
    const agent = buildProxyAgentFromSettings(proxySettings(null), KEY) as SocksProxyAgent

    expect(agent.proxyUrl).toBe("socks5h://user@proxy.example.test:1080")
  })

  it("keeps the password's auth when it decrypts", () => {
    const agent = buildProxyAgentFromSettings(
      proxySettings(encrypt(CANARY, KEY)),
      KEY
    ) as SocksProxyAgent

    expect(agent.proxyUrl).toBe(`socks5h://user:${CANARY}@proxy.example.test:1080`)
  })

  // Both credentials are percent-encoded into the proxy URL, so no character in
  // them can stop the agent building or reach the proxy changed.
  it("builds a SOCKS agent from credentials full of URL-special characters", () => {
    const agent = buildProxyAgentFromSettings(
      { ...proxySettings(encrypt(CANARY_SPECIAL, KEY)), proxyUsername: USER_SPECIAL },
      KEY
    ) as SocksProxyAgent

    expect(agent.proxy.userId).toBe(USER_SPECIAL)
    expect(agent.proxy.password).toBe(CANARY_SPECIAL)
  })

  it("sends credentials full of URL-special characters to an HTTP proxy intact", async () => {
    // A local proxy that records the CONNECT request's auth, then hangs up.
    let auth = ""
    const server = net.createServer((socket) => {
      let head = ""
      socket.on("data", (chunk) => {
        head += chunk.toString("latin1")
        if (!head.includes("\r\n\r\n")) return
        auth = /^proxy-authorization: basic (\S+)\r$/im.exec(head)?.[1] ?? ""
        socket.destroy()
      })
    })
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
    const { port } = server.address() as net.AddressInfo
    try {
      const proxyAgent = buildProxyAgentFromSettings(
        {
          proxyEnabled: true,
          proxyType: "http",
          proxyHost: "127.0.0.1",
          proxyPort: port,
          proxyUsername: USER_SPECIAL,
          encryptedProxyPassword: encrypt(CANARY_SPECIAL, KEY),
        },
        KEY
      )

      await adapterFetch("https://tracker.example/api/user", "tracker.example", {
        proxyAgent,
      }).catch(() => {})

      expect(Buffer.from(auth, "base64").toString("utf8")).toBe(`${USER_SPECIAL}:${CANARY_SPECIAL}`)
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })
})
