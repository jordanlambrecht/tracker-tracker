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

  it("constructs URL correctly with api_token query param", async () => {
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
    expect(calledUrl).toContain("api_token=my-secret-token")
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
})
