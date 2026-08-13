// src/lib/adapters/btn.test.ts

import { beforeEach, describe, expect, it, vi } from "vitest"
import { BtnAdapter } from "./btn"

const API_URL = "https://api.broadcasthe.net/"

describe("BtnAdapter", () => {
  const adapter = new BtnAdapter()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("parses a valid JSON-RPC userInfo response into TrackerStats", async () => {
    const mockResponse = {
      id: 1,
      result: {
        UserID: "9900001",
        Username: "testuser",
        Email: "user@example.test",
        Upload: "5000000000",
        Download: "1000000000",
        Lumens: "10",
        Bonus: "2.5",
        JoinDate: "1784775609",
        Title: "",
        Enabled: "1",
        Paranoia: "0",
        Invites: "0",
        Snatches: "0",
        UploadsSnatched: "0",
        Class: "User",
        ClassLevel: "100",
        HnR: "3",
      },
    }

    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    } as Response)

    const stats = await adapter.fetchStats("https://broadcasthe.net", "fake-api-key", API_URL)

    expect(stats.username).toBe("testuser")
    expect(stats.group).toBe("User")
    expect(stats.uploadedBytes).toBe(5000000000n)
    expect(stats.downloadedBytes).toBe(1000000000n)
    expect(stats.ratio).toBeCloseTo(5)
    expect(stats.bufferBytes).toBe(4000000000n)
    // BTN does not report these — null means unknown, not zero.
    expect(stats.seedingCount).toBeNull()
    expect(stats.leechingCount).toBeNull()
    expect(stats.seedbonus).toBeNull()
    expect(stats.freeleechTokens).toBeNull()
    expect(stats.hitAndRuns).toBe(3)
    expect(stats.requiredRatio).toBeNull()
    expect(stats.warned).toBeNull()
    expect(stats.remoteUserId).toBe(9900001)
    expect(stats.joinedDate).toContain("2026")
  })

  it("leaves the undocumented Lumens/Bonus fields unmapped until they can be verified", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: 1,
        result: {
          UserID: "9900001",
          Username: "testuser",
          Upload: "1000000",
          Download: "500000",
          Lumens: "10.5",
          Bonus: "2614.58",
        },
      }),
    } as Response)

    const stats = await adapter.fetchStats("https://broadcasthe.net", "fake-api-key", API_URL)
    expect(stats.seedbonus).toBeNull()
    expect(stats.freeleechTokens).toBeNull()
  })

  it("falls back to safe defaults when undocumented fields are missing", async () => {
    const mockResponse = {
      id: 1,
      result: {
        UserID: "42",
        Username: "minimal",
        Upload: "100",
        Download: "50",
      },
    }

    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    } as Response)

    const stats = await adapter.fetchStats("https://broadcasthe.net", "fake-api-key", API_URL)

    expect(stats.username).toBe("minimal")
    expect(stats.group).toBe("Unknown")
    expect(stats.uploadedBytes).toBe(100n)
    expect(stats.downloadedBytes).toBe(50n)
    expect(stats.seedbonus).toBeNull()
    expect(stats.freeleechTokens).toBeNull()
    expect(stats.hitAndRuns).toBeNull()
    expect(stats.joinedDate).toBeUndefined()
    expect(stats.remoteUserId).toBe(42)
  })

  it("handles zero upload/download without producing Infinity", async () => {
    const mockResponse = {
      id: 1,
      result: {
        UserID: "1",
        Username: "newuser",
        Upload: "0",
        Download: "0",
        Class: "User",
        Lumens: "0",
        Bonus: "0",
        HnR: "0",
        JoinDate: "1700000000",
      },
    }

    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    } as Response)

    const stats = await adapter.fetchStats("https://broadcasthe.net", "fake-api-key", API_URL)
    expect(stats.ratio).toBe(0)
  })

  it("stores ratio as 0 when upload > 0 but download = 0 (avoids Infinity)", async () => {
    const mockResponse = {
      id: 1,
      result: {
        UserID: "1",
        Username: "seeder",
        Upload: "1000",
        Download: "0",
        Class: "User",
        Lumens: "0",
        Bonus: "0",
        HnR: "0",
        JoinDate: "1700000000",
      },
    }

    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    } as Response)

    const stats = await adapter.fetchStats("https://broadcasthe.net", "fake-api-key", API_URL)
    expect(stats.ratio).toBe(0)
    expect(Number.isFinite(stats.ratio)).toBe(true)
  })

  it("throws 'Invalid BTN API key' on 401", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
    } as Response)

    await expect(
      adapter.fetchStats("https://broadcasthe.net", "bad-key", API_URL)
    ).rejects.toThrow("Invalid BTN API key")
  })

  it("throws rate-limit message on 503", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
    } as Response)

    await expect(
      adapter.fetchStats("https://broadcasthe.net", "fake-key", API_URL)
    ).rejects.toThrow("rate limited")
  })

  it("extracts message from a JSON-RPC error body", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        jsonrpc: "2.0",
        id: 1,
        error: { code: -32001, message: "API key not found" },
      }),
    } as Response)

    await expect(
      adapter.fetchStats("https://broadcasthe.net", "fake-key", API_URL)
    ).rejects.toThrow("API key not found")
  })

  it("throws a sanitized error on network failure", async () => {
    const cause = Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" })
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new TypeError("fetch failed", { cause }))

    await expect(
      adapter.fetchStats("https://broadcasthe.net", "fake-key", API_URL)
    ).rejects.toThrow("Failed to connect to api.broadcasthe.net")
  })

  it("sends a correctly structured JSON-RPC POST body with the API key in params", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: 1,
        result: {
          UserID: "1",
          Username: "user",
          Upload: "0",
          Download: "0",
          Class: "User",
          Lumens: "0",
          Bonus: "0",
          HnR: "0",
          JoinDate: "1700000000",
        },
      }),
    } as Response)

    await adapter.fetchStats("https://broadcasthe.net", "my-secret-api-key", API_URL)

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [calledUrl, init] = fetchSpy.mock.calls[0]
    expect(calledUrl).toBe(API_URL)
    expect(init?.method).toBe("POST")
    const body = JSON.parse(init?.body as string)
    expect(body).toEqual({
      jsonrpc: "2.0",
      id: 1,
      method: "userInfo",
      params: ["my-secret-api-key"],
    })
  })
})

describe("BtnAdapter - proxy handling", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it("routes the request through the configured proxy instead of a direct fetch", async () => {
    const proxyFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        id: 1,
        result: { UserID: "9900001", Username: "testuser", Upload: "1000", Download: "500" },
      }),
      buffer: async () => Buffer.from(""),
    })
    vi.doMock("@/lib/tunnel", () => ({ proxyFetch }))
    vi.resetModules()
    const { BtnAdapter: FreshBtnAdapter } = await import("./btn")

    const fetchSpy = vi.spyOn(global, "fetch")

    const stats = await new FreshBtnAdapter().fetchStats(
      "https://broadcasthe.net",
      "fake-api-key",
      "https://api.broadcasthe.net/",
      { proxyAgent: {} as never }
    )

    expect(stats.username).toBe("testuser")
    expect(proxyFetch).toHaveBeenCalledTimes(1)
    // The whole point: a configured tunnel must not be silently bypassed.
    expect(fetchSpy).not.toHaveBeenCalled()
    vi.doUnmock("@/lib/tunnel")
  })
})

describe("BtnAdapter - documented vs observed field names", () => {
  const adapter = new BtnAdapter()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("falls back to the documented Title field when Class is absent", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: 1,
        result: {
          UserID: "9900001",
          Username: "testuser",
          Upload: "1000",
          Download: "500",
          Title: "Power User",
        },
      }),
    } as Response)

    const stats = await adapter.fetchStats("https://broadcasthe.net", "fake-api-key", API_URL)
    expect(stats.group).toBe("Power User")
  })

  it("reports hitAndRuns as unknown when the undocumented HnR key is absent", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: 1,
        result: { UserID: "9900001", Username: "testuser", Upload: "1000", Download: "500" },
      }),
    } as Response)

    const stats = await adapter.fetchStats("https://broadcasthe.net", "fake-api-key", API_URL)
    expect(stats.hitAndRuns).toBeNull()
  })
})
