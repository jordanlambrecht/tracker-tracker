// src/lib/image-hosting/__tests__/onlyimage.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"

const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

import { onlyimageAdapter, secondsToIsoDuration } from "../onlyimage"

const CHEVERETO_RESPONSE = {
  status_code: 200,
  image: {
    url: "https://onlyimage.org/images/2026/03/20/test.png",
    url_viewer: "https://onlyimage.org/image/AbCdE",
    thumb: { url: "https://onlyimage.org/images/2026/03/20/test.th.png" },
    medium: { url: "https://onlyimage.org/images/2026/03/20/test.md.png" },
  },
}

describe("secondsToIsoDuration", () => {
  it("converts clean day multiples", () => {
    expect(secondsToIsoDuration(86400)).toBe("P1D")
    expect(secondsToIsoDuration(259200)).toBe("P3D")
  })

  it("converts clean hour multiples", () => {
    expect(secondsToIsoDuration(3600)).toBe("PT1H")
    expect(secondsToIsoDuration(7200)).toBe("PT2H")
  })

  it("converts clean minute multiples", () => {
    expect(secondsToIsoDuration(60)).toBe("PT1M")
    expect(secondsToIsoDuration(300)).toBe("PT5M")
  })

  it("falls back to seconds for non-clean values", () => {
    expect(secondsToIsoDuration(90)).toBe("PT90S")
    expect(secondsToIsoDuration(3661)).toBe("PT3661S")
  })
})

describe("onlyimageAdapter", () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it("sends X-API-Key header and parses Chevereto response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => CHEVERETO_RESPONSE,
    })

    const result = await onlyimageAdapter.upload(Buffer.from("fake"), "test.png", "my-key")

    expect(result.url).toBe("https://onlyimage.org/images/2026/03/20/test.png")
    expect(result.viewerUrl).toBe("https://onlyimage.org/image/AbCdE")
    expect(result.thumbUrl).toBe("https://onlyimage.org/images/2026/03/20/test.th.png")
    expect(result.host).toBe("onlyimage")

    const callArgs = mockFetch.mock.calls[0]
    const headers = callArgs[1].headers as Record<string, string>
    expect(headers["X-API-Key"]).toBe("my-key")
  })

  it("converts expirationSeconds to ISO 8601 duration", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => CHEVERETO_RESPONSE,
    })

    await onlyimageAdapter.upload(Buffer.from("img"), "test.png", "key", {
      expirationSeconds: 86400,
    })

    const body = mockFetch.mock.calls[0][1].body as FormData
    expect(body.get("expiration_date")).toBe("P1D")
  })

  it("throws on error response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        status_code: 400,
        error: { message: "Invalid API key" },
      }),
    })

    await expect(onlyimageAdapter.upload(Buffer.from("img"), "t.png", "bad")).rejects.toThrow(
      "OnlyImage upload failed (400)"
    )
  })
})
