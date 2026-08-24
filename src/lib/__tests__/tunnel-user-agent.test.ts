// src/lib/__tests__/tunnel-user-agent.test.ts
//
// Regression cover for the proxied request path, which used to send no
// User-Agent at all: node's https.request adds none, unlike fetch(). Trackers
// that require the header answered 400 whenever the proxy was switched on and
// worked with it off, which reads as a proxy fault rather than a missing header.

import type { Agent } from "node:http"
import { Readable } from "node:stream"
import { beforeEach, describe, expect, it, vi } from "vitest"

const requestMock = vi.hoisted(() => vi.fn())

vi.mock("node:https", () => ({
  default: { request: requestMock },
}))

import { proxyFetch } from "@/lib/tunnel"
import { DEFAULT_USER_AGENT } from "@/lib/user-agent"

function captureHeaders(): Record<string, string> {
  return requestMock.mock.calls[0][0].headers
}

beforeEach(() => {
  requestMock.mockReset()
  requestMock.mockImplementation((_options: unknown, callback: (res: Readable) => void) => {
    const res = Object.assign(Readable.from([Buffer.from('{"ok":true}')]), {
      statusCode: 200,
      statusMessage: "OK",
    })
    queueMicrotask(() => callback(res))
    return { on: vi.fn(), write: vi.fn(), end: vi.fn(), destroy: vi.fn() }
  })
})

const agent = {} as Agent

describe("proxyFetch User-Agent", () => {
  it("sends the app's User-Agent when the caller sets none", async () => {
    await proxyFetch("https://example.test/api", agent)
    expect(captureHeaders()["User-Agent"]).toBe(DEFAULT_USER_AGENT)
  })

  it("keeps a caller-supplied browser User-Agent", async () => {
    const browserUa = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"
    await proxyFetch("https://example.test/api", agent, {
      headers: { "User-Agent": browserUa },
    })
    const headers = captureHeaders()
    expect(headers["User-Agent"]).toBe(browserUa)
    expect(Object.keys(headers).filter((k) => k.toLowerCase() === "user-agent")).toHaveLength(1)
  })

  it("still sends other headers alongside it", async () => {
    await proxyFetch("https://example.test/api", agent, {
      headers: { Cookie: "session=placeholder" },
    })
    const headers = captureHeaders()
    expect(headers.Cookie).toBe("session=placeholder")
    expect(headers["User-Agent"]).toBe(DEFAULT_USER_AGENT)
  })
})
