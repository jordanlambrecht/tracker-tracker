// src/lib/__tests__/tunnel-content-encoding.test.ts
import type { Agent } from "node:http"
import { Readable } from "node:stream"
import zlib from "node:zlib"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { PROXY_DECODED_MAX_BYTES } from "@/lib/limits"

const requestMock = vi.hoisted(() => vi.fn())

vi.mock("node:https", () => ({
  default: { request: requestMock },
}))

import { decodeBody, proxyFetch } from "@/lib/tunnel"

const HOST = "tracker.example"
const HTML = '<html><div class="stats">…</div></html>'

describe("decodeBody", () => {
  it("passes an unencoded body through untouched", () => {
    const raw = Buffer.from(HTML, "utf8")
    expect(decodeBody(raw, undefined, HOST)).toBe(raw)
    expect(decodeBody(raw, "identity", HOST).toString()).toBe(HTML)
  })

  it("gunzips a gzip body", () => {
    expect(decodeBody(zlib.gzipSync(Buffer.from(HTML)), "gzip", HOST).toString()).toBe(HTML)
  })

  it("reads the header case-insensitively and ignores surrounding space", () => {
    expect(decodeBody(zlib.gzipSync(Buffer.from(HTML)), " GZIP ", HOST).toString()).toBe(HTML)
  })

  it("takes the first value when node hands back an array", () => {
    expect(decodeBody(zlib.gzipSync(Buffer.from(HTML)), ["gzip"], HOST).toString()).toBe(HTML)
  })

  it("inflates a zlib-wrapped deflate body", () => {
    expect(decodeBody(zlib.deflateSync(Buffer.from(HTML)), "deflate", HOST).toString()).toBe(HTML)
  })

  it("inflates a raw deflate body", () => {
    expect(decodeBody(zlib.deflateRawSync(Buffer.from(HTML)), "deflate", HOST).toString()).toBe(
      HTML
    )
  })

  it("decompresses brotli", () => {
    expect(decodeBody(zlib.brotliCompressSync(Buffer.from(HTML)), "br", HOST).toString()).toBe(HTML)
  })

  it("returns an empty body as empty in every encoding", () => {
    for (const enc of ["gzip", "deflate", "br"]) {
      expect(decodeBody(Buffer.alloc(0), enc, HOST), enc).toHaveLength(0)
    }
  })

  it("decodes a gzip body that lost its trailer, as fetch() does", () => {
    const truncated = zlib.gzipSync(Buffer.from(HTML)).subarray(0, -8)
    expect(decodeBody(truncated, "gzip", HOST).toString()).toBe(HTML)
  })

  it("refuses an encoding it cannot decode rather than returning the bytes", () => {
    expect(() => decodeBody(Buffer.from(HTML), "zstd", HOST)).toThrow(
      `Unexpected response from ${HOST}: unsupported Content-Encoding zstd`
    )
  })

  it("strips an unknown encoding to header characters before naming it", () => {
    expect(() => decodeBody(Buffer.from(HTML), "timed out", HOST)).toThrow(
      `Unexpected response from ${HOST}: unsupported Content-Encoding timedout`
    )
  })

  it("reports a corrupt body as an unexpected response", () => {
    expect(() => decodeBody(Buffer.from("not gzip at all"), "gzip", HOST)).toThrow(
      `Unexpected response from ${HOST}: could not decode the gzip body`
    )
  })

  describe("output cap", () => {
    it("refuses a body that inflates past the given limit, in every encoding", () => {
      const big = Buffer.alloc(64 * 1024)
      const bodies = [
        ["gzip", zlib.gzipSync(big)],
        ["deflate", zlib.deflateSync(big)],
        ["deflate", zlib.deflateRawSync(big)],
        ["br", zlib.brotliCompressSync(big)],
      ] as const
      for (const [enc, body] of bodies) {
        expect(() => decodeBody(body, enc, HOST, 1024), enc).toThrow(
          "Response exceeded 1024 byte limit"
        )
      }
    })

    it("applies the default cap when the caller sets none", () => {
      const gz = zlib.gzipSync(Buffer.alloc(PROXY_DECODED_MAX_BYTES + 1))
      expect(() => decodeBody(gz, "gzip", HOST)).toThrow(
        `Response exceeded ${PROXY_DECODED_MAX_BYTES} byte limit`
      )
    })

    it("still decodes a body exactly at the limit", () => {
      const body = Buffer.alloc(1024)
      expect(decodeBody(zlib.gzipSync(body), "gzip", HOST, 1024)).toEqual(body)
    })
  })
})

describe("proxyFetch decoding", () => {
  const agent = {} as Agent

  function respond(statusCode: number, headers: Record<string, string>, body: Buffer) {
    requestMock.mockImplementationOnce((_options: unknown, callback: (res: Readable) => void) => {
      const res = Object.assign(Readable.from(body.length > 0 ? [body] : []), {
        statusCode,
        statusMessage: "",
        headers,
      })
      queueMicrotask(() => callback(res))
      return { on: vi.fn(), write: vi.fn(), end: vi.fn(), destroy: vi.fn() }
    })
  }

  beforeEach(() => {
    requestMock.mockReset()
  })

  it("hands the caller the decoded body", async () => {
    respond(200, { "content-encoding": "gzip" }, zlib.gzipSync(Buffer.from(HTML)))

    const res = await proxyFetch(`https://${HOST}/profile`, agent)

    expect(await res.text()).toBe(HTML)
  })

  it("caps the decoded body at the caller's maxBytes", async () => {
    respond(200, { "content-encoding": "gzip" }, zlib.gzipSync(Buffer.alloc(64 * 1024)))

    await expect(proxyFetch(`https://${HOST}/profile`, agent, { maxBytes: 1024 })).rejects.toThrow(
      "Response exceeded 1024 byte limit"
    )
  })

  it("names the host, never the URL, when a body cannot be decoded", async () => {
    respond(200, { "content-encoding": "gzip" }, Buffer.from("not gzip at all"))

    await expect(
      proxyFetch(`https://${HOST}/api?api_token=placeholder`, agent)
    ).rejects.toThrow(`Unexpected response from ${HOST}: could not decode the gzip body`)
  })

  it("returns an empty redirect labelled gzip so the caller can follow it", async () => {
    respond(302, { "content-encoding": "gzip", location: "/index.php" }, Buffer.alloc(0))

    const res = await proxyFetch(`https://${HOST}/login.php`, agent)

    expect(res.status).toBe(302)
    expect(await res.text()).toBe("")
  })
})
