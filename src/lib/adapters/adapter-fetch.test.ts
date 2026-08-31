// src/lib/adapters/adapter-fetch.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_USER_AGENT } from "@/lib/user-agent"
import { adapterFetch, adapterRequest } from "./adapter-fetch"

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

describe("adapterFetch - TypeError unwrapping (Node.js native fetch)", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("unwraps TypeError wrapping ECONNREFUSED into a readable message", async () => {
    const cause = Object.assign(new Error("connect ECONNREFUSED 104.21.0.1:443"), {
      code: "ECONNREFUSED",
    })
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new TypeError("fetch failed", { cause }))

    await expect(adapterFetch("https://tracker.example/api", "tracker.example")).rejects.toThrow(
      "Failed to connect to tracker.example: ECONNREFUSED"
    )
  })

  it("unwraps TypeError wrapping ENOTFOUND into a readable message", async () => {
    const cause = Object.assign(new Error("getaddrinfo ENOTFOUND tracker.example"), {
      code: "ENOTFOUND",
    })
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new TypeError("fetch failed", { cause }))

    await expect(adapterFetch("https://tracker.example/api", "tracker.example")).rejects.toThrow(
      "Failed to connect to tracker.example: ENOTFOUND"
    )
  })

  it("unwraps TypeError wrapping a DOMException TimeoutError", async () => {
    const cause = new DOMException("The operation was timed out.", "TimeoutError")
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new TypeError("fetch failed", { cause }))

    await expect(adapterFetch("https://tracker.example/api", "tracker.example")).rejects.toThrow(
      "Request to tracker.example timed out"
    )
  })

  it("produces a useful fallback for a TypeError with no cause property", async () => {
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new TypeError("fetch failed"))

    await expect(adapterFetch("https://tracker.example/api", "tracker.example")).rejects.toThrow(
      "Failed to connect to tracker.example"
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

    await expect(adapterFetch(`${urlWithToken}`, "example.com")).rejects.toSatisfy((err: Error) => {
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
    // the status code and statusText, neither of which contains the token, so the
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

describe("adapterFetch - POST support", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it("sends method and body on the direct path", async () => {
    let capturedInit: RequestInit | undefined
    vi.spyOn(global, "fetch").mockImplementationOnce((_url, init) => {
      capturedInit = init
      return Promise.resolve({ ok: true, json: async () => ({ ok: 1 }) } as Response)
    })

    await adapterFetch("https://api.example.test/rpc", "api.example.test", undefined, undefined, {
      method: "POST",
      body: '{"jsonrpc":"2.0"}',
    })

    expect(capturedInit?.method).toBe("POST")
    expect(capturedInit?.body).toBe('{"jsonrpc":"2.0"}')
  })

  it("defaults to GET with no body when no init is given", async () => {
    let capturedInit: RequestInit | undefined
    vi.spyOn(global, "fetch").mockImplementationOnce((_url, init) => {
      capturedInit = init
      return Promise.resolve({ ok: true, json: async () => ({ ok: 1 }) } as Response)
    })

    await adapterFetch("https://api.example.test/u", "api.example.test")

    expect(capturedInit?.method).toBe("GET")
    expect(capturedInit?.body).toBeUndefined()
  })

  it("forwards method and body through the proxy path", async () => {
    const proxyFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ ok: 1 }),
      buffer: async () => Buffer.from(""),
    })
    vi.doMock("@/lib/tunnel", () => ({ proxyFetch }))
    vi.resetModules()
    const { adapterFetch: freshAdapterFetch } = await import("./adapter-fetch")

    const fetchSpy = vi.spyOn(global, "fetch")

    await freshAdapterFetch(
      "https://api.example.test/rpc",
      "api.example.test",
      { proxyAgent: {} as never },
      undefined,
      { method: "POST", body: '{"a":1}' }
    )

    expect(proxyFetch).toHaveBeenCalledTimes(1)
    expect(proxyFetch.mock.calls[0][2]).toMatchObject({ method: "POST", body: '{"a":1}' })
    // Crucially: it must NOT fall through to a direct fetch, which would
    // bypass the user's tunnel.
    expect(fetchSpy).not.toHaveBeenCalled()
    vi.doUnmock("@/lib/tunnel")
  })
})

// ---------------------------------------------------------------------------
// adapterRequest hands a non-2xx back to the caller, so an adapter whose API
// reports errors in the body can read it without hand-rolling its own
// proxy-or-direct branch.
// ---------------------------------------------------------------------------

describe("adapterRequest - non-2xx is returned, not thrown", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("returns the status on the direct path instead of throwing", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: async () => ({ error: "bad session" }),
      text: async () => '{"error":"bad session"}',
    } as unknown as Response)

    const res = await adapterRequest("https://example.test/api", "example.test")

    expect(res.ok).toBe(false)
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: "bad session" })
  })

  it("returns the status on the proxy path instead of throwing", async () => {
    const proxyFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      json: async () => ({ error: { code: 400, message: "nope" } }),
      buffer: async () => Buffer.from('{"error":{"code":400,"message":"nope"}}'),
    })
    vi.doMock("@/lib/tunnel", () => ({ proxyFetch }))
    vi.resetModules()
    const { adapterRequest: fresh } = await import("./adapter-fetch")

    const res = await fresh("https://example.test/api", "example.test", {
      proxyAgent: {} as never,
    })

    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
    // buffer() is normalized to text() so callers need not know which ran
    expect(await res.text()).toContain("nope")
    vi.doUnmock("@/lib/tunnel")
  })
})

describe("adapterRequest - User-Agent", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("sends the app User-Agent on the direct path", async () => {
    let captured: Record<string, string> | undefined
    vi.spyOn(global, "fetch").mockImplementationOnce((_url, init) => {
      captured = init?.headers as Record<string, string>
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({}),
        text: async () => "{}",
      } as unknown as Response)
    })

    await adapterRequest("https://example.test/api", "example.test")

    expect(captured?.["User-Agent"]).toBe(DEFAULT_USER_AGENT)
  })

  it("sends the app User-Agent on the proxy path", async () => {
    const proxyFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({}),
      buffer: async () => Buffer.from("{}"),
    })
    vi.doMock("@/lib/tunnel", () => ({ proxyFetch }))
    vi.resetModules()
    const { adapterRequest: fresh } = await import("./adapter-fetch")

    await fresh("https://example.test/api", "example.test", { proxyAgent: {} as never })

    expect(proxyFetch.mock.calls[0][2].headers["User-Agent"]).toBe(DEFAULT_USER_AGENT)
    vi.doUnmock("@/lib/tunnel")
  })

  it("lets a caller-supplied User-Agent win", async () => {
    let captured: Record<string, string> | undefined
    vi.spyOn(global, "fetch").mockImplementationOnce((_url, init) => {
      captured = init?.headers as Record<string, string>
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({}),
        text: async () => "{}",
      } as unknown as Response)
    })

    await adapterRequest("https://example.test/api", "example.test", undefined, {
      "User-Agent": "Mozilla/5.0",
    })

    expect(captured?.["User-Agent"]).toBe("Mozilla/5.0")
  })
})
