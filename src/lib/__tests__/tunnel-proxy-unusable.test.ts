// src/lib/__tests__/tunnel-proxy-unusable.test.ts
//
// A proxy that is on but whose settings can't make an agent must not let a
// request go out directly. The agent built for it fails every request before any
// connection opens, and the poll stores a line that names the settings and is
// never retried. Only a proxy that is off builds no agent.

import net from "node:net"
import { afterEach, describe, expect, it, vi } from "vitest"
import { PROXY_UNUSABLE_ERROR, sanitizeNetworkError } from "@/lib/error-utils"
import { OUTBOUND_DISABLED_ERROR } from "@/lib/network"
import { adapterFetch } from "@/lib/tracker-platforms/helpers/adapter-fetch"
import { isRetryablePollError } from "@/lib/tracker-status"
import { buildProxyAgentFromSettings, type ProxySettings } from "@/lib/tunnel"

const KEY = Buffer.alloc(32, 1)

const SETTINGS: ProxySettings = {
  proxyEnabled: true,
  proxyType: "socks5",
  proxyHost: "proxy.example.test",
  proxyPort: 1080,
  proxyUsername: null,
  encryptedProxyPassword: null,
}

describe("buildProxyAgentFromSettings and settings it can't use", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  // Every TCP and TLS connection, the proxy clients' own included, goes through
  // net.Socket's connect.
  it.each<[string, Partial<ProxySettings>]>([
    ["no host", { proxyHost: null }],
    ["an empty host", { proxyHost: "" }],
    ["a type it has no agent for", { proxyType: "socks4" }],
    ["a port typed into the host", { proxyHost: "proxy.example.test:1080" }],
    ["a bare IPv6 host", { proxyHost: "::1" }],
    ["an http proxy with a port in the host", { proxyType: "http", proxyHost: "proxy.test:8080" }],
  ])("refuses every proxied request for %s, before any connection opens", async (_case, change) => {
    const connect = vi.spyOn(net.Socket.prototype, "connect")
    const proxyAgent = buildProxyAgentFromSettings({ ...SETTINGS, ...change }, KEY)

    const err = await adapterFetch("https://tracker.example/api/user", "tracker.example", {
      proxyAgent,
    }).then(
      () => null,
      (e: unknown) => (e instanceof Error ? e : null)
    )

    expect(err?.message).toBe(
      "Failed to connect to tracker.example via proxy: Unusable proxy settings"
    )
    expect(connect).not.toHaveBeenCalled()
  })

  it("lets DISABLE_OUTBOUND_REQUESTS refuse first when it is on", async () => {
    vi.stubEnv("DISABLE_OUTBOUND_REQUESTS", "true")
    const connect = vi.spyOn(net.Socket.prototype, "connect")
    const proxyAgent = buildProxyAgentFromSettings({ ...SETTINGS, proxyHost: null }, KEY)

    const err = await adapterFetch("https://tracker.example/api/user", "tracker.example", {
      proxyAgent,
    }).then(
      () => null,
      (e: unknown) => (e instanceof Error ? e : null)
    )

    expect(err?.message).toBe(OUTBOUND_DISABLED_ERROR)
    expect(connect).not.toHaveBeenCalled()
  })

  it("builds no agent while the proxy is off, whatever its settings", () => {
    expect(
      buildProxyAgentFromSettings({ ...SETTINGS, proxyEnabled: false, proxyHost: "::1" }, KEY)
    ).toBeUndefined()
  })

  it("stores a line that names the settings, which is never retried", () => {
    const message = sanitizeNetworkError(
      "Failed to connect to tracker.example via proxy: Unusable proxy settings",
      "Poll failed"
    )

    expect(message).toBe(PROXY_UNUSABLE_ERROR)
    expect(isRetryablePollError(message)).toBe(false)
  })

  it("reads that line only from the proxy wrapper, never from a tracker's text", () => {
    expect(
      sanitizeNetworkError(
        "Hawke API request failed on hawke.uno: Unusable proxy settings",
        "Poll failed"
      )
    ).not.toBe(PROXY_UNUSABLE_ERROR)
  })
})
