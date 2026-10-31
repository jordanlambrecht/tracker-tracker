// src/lib/__tests__/tunnel-socks-dns.test.ts
//
// A SOCKS5 agent that looks hostnames up locally sends every tracker name to
// the user's own DNS before the proxy sees the request.

import { SocksProxyAgent } from "socks-proxy-agent"
import { describe, expect, it } from "vitest"

import { createProxyAgent } from "@/lib/tunnel"

describe("SOCKS5 proxy DNS", () => {
  it("leaves hostname resolution to the proxy", () => {
    const agent = createProxyAgent({
      type: "socks5",
      host: "proxy.example.test",
      port: 1080,
    })
    expect(agent).toBeInstanceOf(SocksProxyAgent)
    const socks = agent as SocksProxyAgent
    expect(socks.shouldLookup).toBe(false)
    expect(socks.proxy).toMatchObject({ host: "proxy.example.test", port: 1080, type: 5 })
  })
})
