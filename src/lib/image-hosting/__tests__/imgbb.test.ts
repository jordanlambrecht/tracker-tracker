// src/lib/image-hosting/__tests__/imgbb.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"

const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

import { imgbbAdapter } from "../imgbb"

const IMGBB_RESPONSE = {
  success: true,
  status: 200,
  data: {
    id: "2ndCYJK",
    url: "https://i.ibb.co/w04Prt6/test.png",
    url_viewer: "https://ibb.co/2ndCYJK",
    image: { url: "https://i.ibb.co/w04Prt6/test.png" },
    thumb: { url: "https://i.ibb.co/2ndCYJK/test.png" },
    delete_url: "https://ibb.co/2ndCYJK/abc123",
  },
}

describe("imgbbAdapter", () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it("sends api key as form field and parses response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => IMGBB_RESPONSE,
    })

    const result = await imgbbAdapter.upload(Buffer.from("fake"), "test.png", "my-key")

    expect(result.url).toBe("https://i.ibb.co/w04Prt6/test.png")
    expect(result.viewerUrl).toBe("https://ibb.co/2ndCYJK")
    expect(result.thumbUrl).toBe("https://i.ibb.co/2ndCYJK/test.png")
    expect(result.deleteId).toBe("2ndCYJK")
    expect(result.host).toBe("imgbb")

    const body = mockFetch.mock.calls[0][1].body as FormData
    expect(body.get("key")).toBe("my-key")
  })

  it("passes expiration parameter in seconds", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => IMGBB_RESPONSE,
    })

    await imgbbAdapter.upload(Buffer.from("img"), "test.png", "key", { expirationSeconds: 3600 })

    const body = mockFetch.mock.calls[0][1].body as FormData
    expect(body.get("expiration")).toBe("3600")
  })

  it("clamps expiration to valid range", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => IMGBB_RESPONSE,
    })

    await imgbbAdapter.upload(Buffer.from("img"), "test.png", "key", { expirationSeconds: 10 })

    const body = mockFetch.mock.calls[0][1].body as FormData
    expect(body.get("expiration")).toBe("60")
  })

  it("throws on failed upload", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: false, status: 400, error: { message: "Bad" } }),
    })

    await expect(imgbbAdapter.upload(Buffer.from("img"), "t.png", "key")).rejects.toThrow(
      "ImgBB upload failed"
    )
  })

  it("throws on HTTP error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => "Rate limited",
    })

    await expect(imgbbAdapter.upload(Buffer.from("img"), "t.png", "key")).rejects.toThrow(
      "ImgBB upload failed (429)"
    )
  })
})
