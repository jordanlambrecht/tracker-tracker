// src/lib/__tests__/tunnel-deadline.test.ts
//
// A proxy that completes the TCP handshake and then never answers CONNECT is
// what a hung or overloaded HTTP proxy looks like on the wire. https.request's
// timeout option only arms once a socket is assigned, and the proxy agent
// withholds the socket until the CONNECT reply arrives, so without a deadline
// of its own proxyFetch never settled on such a proxy and the scheduler's
// in-flight latch never cleared.

import net from "node:net"
import { HttpsProxyAgent } from "https-proxy-agent"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { proxyFetch } from "@/lib/tunnel"

describe("proxyFetch deadline", () => {
  let server: net.Server | undefined
  const sockets: net.Socket[] = []

  afterEach(async () => {
    for (const socket of sockets.splice(0)) socket.destroy()
    await new Promise<void>((resolve) => {
      if (!server) return resolve()
      server.close(() => resolve())
    })
    server = undefined
  })

  it("rejects when the proxy accepts the connection and never answers CONNECT", async () => {
    server = net.createServer((socket) => {
      sockets.push(socket)
    })
    await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve))
    const { port } = server.address() as net.AddressInfo
    const agent = new HttpsProxyAgent(`http://127.0.0.1:${port}`)

    const started = Date.now()
    await expect(
      proxyFetch("https://tracker.example/api/user", agent, { timeoutMs: 300 })
    ).rejects.toThrow("Request timed out after 300ms")
    expect(Date.now() - started).toBeLessThan(4000)
  })
})

// https.request validates headers before it returns, so a value Node refuses
// throws before req exists. A stored User-Agent carrying CR or LF still gets
// this far, since digitalcore.ts leaves that check to the request layer. A
// deadline armed ahead of the request would fire after the rejection and throw
// on req outside any handler.
describe("proxyFetch deadline when https.request throws", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("rejects a header Node refuses and leaves no timer behind", async () => {
    const agent = new HttpsProxyAgent("http://127.0.0.1:9")

    await expect(
      proxyFetch("https://tracker.example/api/user", agent, {
        timeoutMs: 300,
        headers: { "User-Agent": "Mozilla/5.0\r\nX-Injected: 1" },
      })
    ).rejects.toMatchObject({ code: "ERR_INVALID_CHAR" })
    expect(vi.getTimerCount()).toBe(0)
  })
})
