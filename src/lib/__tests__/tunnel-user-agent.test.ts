// src/lib/__tests__/tunnel-user-agent.test.ts
//
// proxyFetch is transport and takes no view on the User-Agent. adapterRequest
// applies the default a layer up, which is what lets the scraping adapters keep
// the UA their cookie was issued to and TorrentLeech send none. A default here
// would silently override both.

import type { Agent } from "node:http"
import { Readable } from "node:stream"
import { beforeEach, describe, expect, it, vi } from "vitest"

const requestMock = vi.hoisted(() => vi.fn())

vi.mock("node:https", () => ({
  default: { request: requestMock },
}))

import { proxyFetch } from "@/lib/tunnel"

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
  it("does not invent a User-Agent when the caller sets none", async () => {
    await proxyFetch("https://example.test/api", agent)
    const keys = Object.keys(captureHeaders()).filter((k) => k.toLowerCase() === "user-agent")
    expect(keys).toHaveLength(0)
  })

  it("passes a caller-supplied User-Agent through untouched", async () => {
    const browserUa = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"
    await proxyFetch("https://example.test/api", agent, {
      headers: { "User-Agent": browserUa },
    })
    const headers = captureHeaders()
    expect(headers["User-Agent"]).toBe(browserUa)
    // A second header differing only in case would be sent alongside the
    // first rather than replacing it, which is the mismatch trackers
    // fingerprint on.
    expect(Object.keys(headers).filter((k) => k.toLowerCase() === "user-agent")).toHaveLength(1)
  })

  it("still sends other headers alongside it", async () => {
    await proxyFetch("https://example.test/api", agent, {
      headers: { Cookie: "session=placeholder" },
    })
    const headers = captureHeaders()
    expect(headers.Cookie).toBe("session=placeholder")
    expect(headers.Accept).toBe("application/json")
  })
})
