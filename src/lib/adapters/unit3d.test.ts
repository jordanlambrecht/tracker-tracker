// src/lib/adapters/unit3d.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"
import { Unit3dAdapter } from "./unit3d"

describe("Unit3dAdapter", () => {
  const adapter = new Unit3dAdapter()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("parses a valid API response into TrackerStats", async () => {
    const mockResponse = {
      username: "JohnDoe",
      group: "Power User",
      uploaded: "500.25 GiB",
      downloaded: "125.50 GiB",
      ratio: "3.99",
      buffer: "374.75 GiB",
      seeding: 156,
      leeching: 2,
      seedbonus: "12500.00",
      hit_and_runs: 0,
    }

    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    const stats = await adapter.fetchStats("https://aither.cc", "fake-token", "/api/user")

    expect(stats.username).toBe("JohnDoe")
    expect(stats.group).toBe("Power User")
    expect(stats.uploadedBytes).toBeGreaterThan(BigInt(0))
    expect(stats.downloadedBytes).toBeGreaterThan(BigInt(0))
    expect(stats.ratio).toBeCloseTo(3.99)
    expect(stats.seedingCount).toBe(156)
    expect(stats.leechingCount).toBe(2)
    expect(stats.seedbonus).toBe(12500)
    expect(stats.hitAndRuns).toBe(0)
  })

  it("throws on non-ok response", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
    } as Response)

    await expect(adapter.fetchStats("https://aither.cc", "bad-token", "/api/user")).rejects.toThrow(
      "401"
    )
  })

  it("throws a sanitized error on network failure", async () => {
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("fetch failed"))

    await expect(adapter.fetchStats("https://aither.cc", "token", "/api/user")).rejects.toThrow(
      "Failed to connect to aither.cc"
    )
  })

  it("constructs the URL correctly and keeps the token out of the query string", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        username: "Test",
        group: "User",
        uploaded: "0 GiB",
        downloaded: "0 GiB",
        ratio: "0",
        buffer: "0 GiB",
        seeding: 0,
        leeching: 0,
        seedbonus: "0",
        hit_and_runs: 0,
      }),
    } as Response)

    await adapter.fetchStats("https://example.com", "my-secret-token", "/api/user")

    const calledUrl = fetchSpy.mock.calls[0][0] as string
    expect(calledUrl).toContain("https://example.com/api/user")
    // Bearer is now the default, so the token must not appear in the URL —
    // query strings leak into access logs and Referer headers.
    expect(calledUrl).not.toContain("api_token")
  })
})

describe("Unit3dAdapter - security", () => {
  const adapter = new Unit3dAdapter()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("does not expose the API token in non-ok response errors", async () => {
    const secretToken = "super-secret-api-token-12345"

    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: "Forbidden",
    } as Response)

    await expect(
      adapter.fetchStats("https://example.com", secretToken, "/api/user")
    ).rejects.toSatisfy((err: Error) => {
      expect(err.message).not.toContain(secretToken)
      return true
    })
  })

  it("does not expose the API token when fetch itself throws with a URL in the message", async () => {
    const secretToken = "super-secret-api-token-12345"
    const urlWithToken = `https://example.com/api/user?api_token=${secretToken}`

    vi.spyOn(global, "fetch").mockRejectedValueOnce(
      new Error(`request to ${urlWithToken} failed, reason: connect ECONNREFUSED`)
    )

    await expect(
      adapter.fetchStats("https://example.com", secretToken, "/api/user")
    ).rejects.toSatisfy((err: Error) => {
      expect(err.message).not.toContain(secretToken)
      expect(err.message).toContain("example.com")
      return true
    })
  })

  it("throws a timeout-specific message when AbortSignal fires", async () => {
    const timeoutError = new DOMException("signal timed out", "TimeoutError")
    vi.spyOn(global, "fetch").mockRejectedValueOnce(timeoutError)

    await expect(adapter.fetchStats("https://example.com", "token", "/api/user")).rejects.toThrow(
      "Request to example.com timed out"
    )
  })

  // AbortSignal timeout coverage is in adapterFetch — tested via timeout-message test above

  it("derives bufferBytes from totals when the build reports an unlimited buffer", async () => {
    // Zenith's UNIT3D build returns "∞" for buffer; parseBytes rejects that,
    // so the adapter falls back to uploaded - downloaded rather than
    // reporting a confident 0 B.
    for (const infinite of ["∞", "-∞", "Inf", "inf"]) {
      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          username: "ZenithUser",
          group: "User",
          uploaded: "100 GiB",
          downloaded: "40 GiB",
          ratio: "2.5",
          buffer: infinite,
          seeding: 10,
          leeching: 0,
          seedbonus: "0",
          hit_and_runs: 0,
        }),
      } as Response)

      const stats = await adapter.fetchStats("https://znth.cx", "fake-token", "/api/user")
      expect(stats.bufferBytes).toBe(stats.uploadedBytes - stats.downloadedBytes)
      expect(stats.bufferBytes).toBeGreaterThan(BigInt(0))
    }
  })


  it("sends a Bearer header by default and no api_token query param", async () => {
    let capturedUrl: string | undefined
    let capturedInit: RequestInit | undefined
    vi.spyOn(global, "fetch").mockImplementationOnce((url, init) => {
      capturedUrl = String(url)
      capturedInit = init
      return Promise.resolve({
        ok: true,
        json: async () => ({
          username: "u", group: "g", uploaded: "1 GiB", downloaded: "1 GiB",
          ratio: "1", buffer: "0 B", seeding: 0, leeching: 0,
          seedbonus: "0", hit_and_runs: 0,
        }),
      } as Response)
    })

    await adapter.fetchStats("https://aither.cc", "secret-token", "/api/user")

    expect((capturedInit?.headers as Record<string, string>).Authorization).toBe(
      "Bearer secret-token"
    )
    expect(capturedUrl).not.toContain("api_token")
  })

  it("falls back to the legacy query param when a tracker opts into query auth", async () => {
    let capturedUrl: string | undefined
    let capturedInit: RequestInit | undefined
    vi.spyOn(global, "fetch").mockImplementationOnce((url, init) => {
      capturedUrl = String(url)
      capturedInit = init
      return Promise.resolve({
        ok: true,
        json: async () => ({
          username: "u", group: "g", uploaded: "1 GiB", downloaded: "1 GiB",
          ratio: "1", buffer: "0 B", seeding: 0, leeching: 0,
          seedbonus: "0", hit_and_runs: 0,
        }),
      } as Response)
    })

    await adapter.fetchStats("https://aither.cc", "secret-token", "/api/user", {
      unit3dAuthStyle: "query",
    })

    expect(capturedUrl).toContain("api_token=secret-token")
    expect((capturedInit?.headers as Record<string, string>).Authorization).toBeUndefined()
  })

})

describe("Unit3dAdapter - auth fallback", () => {
  const adapter = new Unit3dAdapter()

  beforeEach(() => {
    vi.restoreAllMocks()
    ;(
      globalThis as { __unit3dAuthStyleCache?: Map<string, string> }
    ).__unit3dAuthStyleCache?.clear()
  })

  const okBody = () => ({ ok: true, json: async () => ({
          username: "u", group: "g", uploaded: "1 GiB", downloaded: "1 GiB",
          ratio: "1", buffer: "0 B", seeding: 0, leeching: 0,
          seedbonus: "0", hit_and_runs: 0,
        }) }) as Response
  const unauthorized = () =>
    ({ ok: false, status: 401, statusText: "Unauthorized" }) as Response

  it("falls back to the api_token query param when bearer is rejected", async () => {
    const spy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(unauthorized())
      .mockResolvedValueOnce(okBody())

    const stats = await adapter.fetchStats("https://old.example", "tok", "/api/user")
    expect(stats.username).toBe("u")
    expect(spy).toHaveBeenCalledTimes(2)
    expect(String(spy.mock.calls[0][0])).not.toContain("api_token")
    expect(String(spy.mock.calls[1][0])).toContain("api_token=tok")
  })

  it("remembers the working style so later polls only make one request", async () => {
    const spy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(unauthorized())
      .mockResolvedValueOnce(okBody())
      .mockResolvedValueOnce(okBody())

    await adapter.fetchStats("https://old.example", "tok", "/api/user")
    await adapter.fetchStats("https://old.example", "tok", "/api/user")

    // 2 for the first (probe + fallback), 1 for the second — not 4.
    expect(spy).toHaveBeenCalledTimes(3)
    expect(String(spy.mock.calls[2][0])).toContain("api_token=tok")
  })

  it("does NOT fall back on a non-auth failure", async () => {
    const spy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce({ ok: false, status: 500, statusText: "Server Error" } as Response)

    await expect(
      adapter.fetchStats("https://broken.example", "tok", "/api/user")
    ).rejects.toThrow()
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it("never probes when a tracker pins its auth style", async () => {
    const spy = vi.spyOn(global, "fetch").mockResolvedValueOnce(unauthorized())

    await expect(
      adapter.fetchStats("https://pinned.example", "tok", "/api/user", {
        unit3dAuthStyle: "bearer",
      })
    ).rejects.toThrow()
    expect(spy).toHaveBeenCalledTimes(1)
  })
})
