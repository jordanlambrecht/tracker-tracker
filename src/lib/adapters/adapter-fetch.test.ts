// src/lib/adapters/adapter-fetch.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"
import { adapterFetch } from "./adapter-fetch"

describe("adapterFetch - AbortSignal", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("uses AbortSignal.timeout for request cancellation", async () => {
    let capturedSignal: AbortSignal | undefined

    vi.spyOn(global, "fetch").mockImplementationOnce((_url, init) => {
      capturedSignal = init?.signal as AbortSignal | undefined
      return Promise.resolve({
        ok: true,
        json: async () => ({ result: "ok" }),
      } as Response)
    })

    await adapterFetch("https://example.com/api", "example.com")

    expect(capturedSignal).toBeDefined()
    expect(capturedSignal).toBeInstanceOf(AbortSignal)
    // AbortSignal.timeout() produces a signal whose abortReason is a TimeoutError
    // i.e. it has a finite timeout rather than being manually abortable with no reason
    expect(capturedSignal?.aborted).toBe(false)
  })

  it("throws a timeout-specific message when AbortSignal fires", async () => {
    const timeoutError = new DOMException("signal timed out", "TimeoutError")
    vi.spyOn(global, "fetch").mockRejectedValueOnce(timeoutError)

    await expect(adapterFetch("https://example.com/api", "example.com")).rejects.toThrow(
      "Request to example.com timed out"
    )
  })
})

describe("adapterFetch - token sanitization", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("does not expose the API token in error messages when fetch throws with a URL containing the token", async () => {
    const secretToken = "super-secret-api-token-12345"
    const urlWithToken = `https://example.com/api/user?api_token=${secretToken}`

    vi.spyOn(global, "fetch").mockRejectedValueOnce(
      new Error(`request to ${urlWithToken} failed, reason: connect ECONNREFUSED`)
    )

    await expect(
      adapterFetch(`${urlWithToken}`, "example.com")
    ).rejects.toSatisfy((err: Error) => {
      expect(err.message).not.toContain(secretToken)
      expect(err.message).toContain("example.com")
      return true
    })
  })

  it("does not expose the API token in HTTP error responses", async () => {
    const secretToken = "super-secret-api-token-12345"

    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: "Forbidden",
    } as Response)

    // The token lives in the URL query string (i.e. ?api_token=…). adapterFetch receives
    // the fully-constructed URL as its first argument. A non-ok response throws using only
    // the status code and statusText — neither of which contains the token — so the
    // caller-supplied token must not appear in the thrown message.
    await expect(
      adapterFetch(`https://example.com/api/user?api_token=${secretToken}`, "example.com")
    ).rejects.toSatisfy((err: Error) => {
      expect(err.message).not.toContain(secretToken)
      expect(err.message).toContain("403")
      return true
    })
  })
})
