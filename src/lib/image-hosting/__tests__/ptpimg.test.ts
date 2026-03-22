// src/lib/image-hosting/__tests__/ptpimg.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"

const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

import { ptpimgAdapter } from "../ptpimg"

describe("ptpimgAdapter", () => {
  beforeEach(() => { mockFetch.mockReset() })

  it("has correct id", () => {
    expect(ptpimgAdapter.id).toBe("ptpimg")
  })

  it("sends correct multipart request and parses response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ code: "abc123", ext: "png" }],
    })

    const result = await ptpimgAdapter.upload(
      Buffer.from("fake-image"),
      "test.png",
      "my-api-key"
    )

    expect(result.url).toBe("https://ptpimg.me/abc123.png")
    expect(result.host).toBe("ptpimg")

    expect(mockFetch).toHaveBeenCalledWith(
      "https://ptpimg.me/upload.php",
      expect.objectContaining({ method: "POST" })
    )

    const body = mockFetch.mock.calls[0][1].body as FormData
    expect(body.get("api_key")).toBe("my-api-key")
    expect(body.get("file-upload[]")).toBeTruthy()
  })

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => "Forbidden",
    })

    await expect(
      ptpimgAdapter.upload(Buffer.from("img"), "test.png", "bad-key")
    ).rejects.toThrow("PTPImg upload failed (403)")
  })

  it("throws on empty response array", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    })

    await expect(
      ptpimgAdapter.upload(Buffer.from("img"), "test.png", "key")
    ).rejects.toThrow("PTPImg returned no image data")
  })

  it("ignores expirationSeconds (not supported)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ code: "xyz", ext: "jpg" }],
    })

    const result = await ptpimgAdapter.upload(
      Buffer.from("img"),
      "test.jpg",
      "key",
      { expirationSeconds: 3600 }
    )

    expect(result.url).toBe("https://ptpimg.me/xyz.jpg")
  })
})
