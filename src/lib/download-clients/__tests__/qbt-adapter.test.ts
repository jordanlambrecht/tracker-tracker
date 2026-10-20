// src/lib/download-clients/__tests__/qbt-adapter.test.ts

import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/download-clients/qbt/transport", () => ({
  buildBaseUrl: vi.fn(
    (host: string, port: number, ssl: boolean, urlPath: string) =>
      `${ssl ? "https" : "http"}://${host}:${port}${urlPath}`
  ),
  login: vi.fn().mockResolvedValue({ name: "SID", value: "test-sid" }),
  getTorrents: vi.fn().mockResolvedValue([
    {
      hash: "abc",
      name: "Test",
      state: "uploading",
      tags: "aither",
      category: "tv",
      upspeed: 100,
      dlspeed: 50,
      uploaded: 1000000,
      downloaded: 500000,
      ratio: 2.0,
      size: 500000,
      num_seeds: 5,
      num_leechs: 2,
      num_complete: 20,
      num_incomplete: 3,
      tracker: "https://tracker.example.com",
      added_on: 1700000000,
      completion_on: 1700001000,
      last_activity: 1700002000,
      seeding_time: 86400,
      time_active: 90000,
      seen_complete: 1700001500,
      availability: 1.0,
      amount_left: 0,
      progress: 1.0,
      content_path: "/data/test",
      save_path: "/data",
      is_private: true,
    },
  ]),
  getTransferInfo: vi.fn().mockResolvedValue({ up_info_speed: 100, dl_info_speed: 200 }),
  syncMaindata: vi.fn().mockResolvedValue({
    rid: 1,
    full_update: true,
    torrents: {
      abc: {
        upspeed: 500,
        dlspeed: 200,
        num_seeds: 10,
        seeding_time: 3600,
      },
    },
    server_state: {
      up_info_speed: 500,
      dl_info_speed: 200,
    },
  }),
  invalidateSession: vi.fn(),
  clearAuthBlocks: vi.fn(),
  withSessionRetry: vi.fn(
    async (
      _h: string,
      _p: number,
      _s: boolean,
      _u: string,
      _pw: string,
      _urlPath: string,
      op: (baseUrl: string, sid: { name: string; value: string }) => unknown
    ) => op("http://localhost:8080", { name: "SID", value: "test-sid" })
  ),
}))

import {
  clearAuthBlocks,
  getTorrents,
  getTransferInfo,
  invalidateSession,
  login,
  syncMaindata,
  withSessionRetry,
} from "@/lib/download-clients/qbt/transport"
import { QbtClientAdapter } from "../adapters/qbt"

describe("QbtClientAdapter", () => {
  const adapter = new QbtClientAdapter("localhost", 8080, false, {
    authMethod: "password",
    username: "admin",
    password: "pass",
    urlPath: "",
  })

  it("has type 'qbittorrent'", () => {
    expect(adapter.type).toBe("qbittorrent")
  })

  it("builds correct baseUrl", () => {
    expect(adapter.baseUrl).toBe("http://localhost:8080")
  })

  it("returns normalized TorrentRecord shapes from getTorrents", async () => {
    const torrents = await adapter.getTorrents()
    expect(getTorrents).toHaveBeenCalled()

    // Verify camelCase normalized fields are present
    expect(torrents[0].uploadSpeed).toBe(100)
    expect(torrents[0].downloadSpeed).toBe(50)
    expect(torrents[0].seedCount).toBe(5)
    expect(torrents[0].leechCount).toBe(2)
    expect(torrents[0].swarmSeeders).toBe(20)
    expect(torrents[0].swarmLeechers).toBe(3)
    expect(torrents[0].addedAt).toBe(1700000000)
    expect(torrents[0].completedAt).toBe(1700001000)
    expect(torrents[0].lastActivityAt).toBe(1700002000)
    expect(torrents[0].seedingTime).toBe(86400)
    expect(torrents[0].activeTime).toBe(90000)
    expect(torrents[0].lastSeenComplete).toBe(1700001500)
    expect(torrents[0].remaining).toBe(0)
    expect(torrents[0].contentPath).toBe("/data/test")
    expect(torrents[0].savePath).toBe("/data")
    expect(torrents[0].isPrivate).toBe(true)

    // Pass-through fields (same in both raw and normalized)
    expect(torrents[0].hash).toBe("abc")
    expect(torrents[0].name).toBe("Test")

    // Verify raw snake_case fields are not present on the result
    expect(torrents[0]).not.toHaveProperty("upspeed")
    expect(torrents[0]).not.toHaveProperty("dlspeed")
    expect(torrents[0]).not.toHaveProperty("num_seeds")
    expect(torrents[0]).not.toHaveProperty("num_leechs")
    expect(torrents[0]).not.toHaveProperty("num_complete")
    expect(torrents[0]).not.toHaveProperty("num_incomplete")
    expect(torrents[0]).not.toHaveProperty("added_on")
    expect(torrents[0]).not.toHaveProperty("completion_on")
    expect(torrents[0]).not.toHaveProperty("last_activity")
    expect(torrents[0]).not.toHaveProperty("seeding_time")
    expect(torrents[0]).not.toHaveProperty("time_active")
    expect(torrents[0]).not.toHaveProperty("seen_complete")
    expect(torrents[0]).not.toHaveProperty("amount_left")
    expect(torrents[0]).not.toHaveProperty("content_path")
    expect(torrents[0]).not.toHaveProperty("save_path")
    expect(torrents[0]).not.toHaveProperty("is_private")
  })

  it("passes tag and filter options to getTorrents", async () => {
    vi.mocked(getTorrents).mockClear()
    await adapter.getTorrents({ tag: "aither", filter: "active" })
    expect(getTorrents).toHaveBeenCalledWith(
      expect.any(String),
      { mode: "session", sid: { name: "SID", value: "test-sid" } },
      "aither",
      "active",
      undefined
    )
  })

  it("hands the caller's signal to the session wrapper so the login shares the deadline", async () => {
    vi.mocked(withSessionRetry).mockClear()
    const controller = new AbortController()
    await adapter.getTorrents({ tag: "aither", signal: controller.signal })
    expect(vi.mocked(withSessionRetry).mock.calls[0]?.[7]).toBe(controller.signal)
  })

  it("returns normalized TransferStats from getTransferInfo", async () => {
    const stats = await adapter.getTransferInfo()
    expect(getTransferInfo).toHaveBeenCalled()
    expect(stats).toEqual({ uploadSpeed: 100, downloadSpeed: 200 })
  })

  it("supports delta sync via getDeltaSync method", () => {
    expect(adapter.getDeltaSync).toBeDefined()
  })

  it("returns normalized DeltaSyncResponse from getDeltaSync", async () => {
    const data = await adapter.getDeltaSync?.(0)
    expect(syncMaindata).toHaveBeenCalledWith(
      expect.any(String),
      { mode: "session", sid: { name: "SID", value: "test-sid" } },
      0
    )

    // Top-level fields pass through
    expect(data?.rid).toBe(1)
    expect(data?.fullUpdate).toBe(true)

    // Torrent partial is mapped to camelCase
    const torrentPartial = data?.torrents?.abc
    expect(torrentPartial).toBeDefined()
    expect(torrentPartial?.uploadSpeed).toBe(500)
    expect(torrentPartial?.downloadSpeed).toBe(200)
    expect(torrentPartial?.seedCount).toBe(10)
    expect(torrentPartial?.seedingTime).toBe(3600)
    expect(torrentPartial).not.toHaveProperty("upspeed")
    expect(torrentPartial).not.toHaveProperty("dlspeed")
    expect(torrentPartial).not.toHaveProperty("num_seeds")
    expect(torrentPartial).not.toHaveProperty("seeding_time")

    // serverState is mapped to TransferStats shape
    expect(data?.serverState?.uploadSpeed).toBe(500)
    expect(data?.serverState?.downloadSpeed).toBe(200)
  })

  it("testConnection invalidates session, logs in fresh, and calls getTransferInfo", async () => {
    vi.mocked(invalidateSession).mockClear()
    vi.mocked(login).mockClear()
    vi.mocked(getTransferInfo).mockClear()

    await adapter.testConnection()

    expect(invalidateSession).toHaveBeenCalledWith("http://localhost:8080")
    expect(login).toHaveBeenCalledWith("localhost", 8080, false, "admin", "pass", "")
    expect(getTransferInfo).toHaveBeenCalled()
  })

  it("testConnection clears the auth block so an explicit retry reaches the network", async () => {
    vi.mocked(clearAuthBlocks).mockClear()

    await adapter.testConnection()

    expect(clearAuthBlocks).toHaveBeenCalledWith("http://localhost:8080")
  })

  it("dispose drops the session and the auth blocks", () => {
    vi.mocked(invalidateSession).mockClear()
    vi.mocked(clearAuthBlocks).mockClear()
    adapter.dispose()
    expect(invalidateSession).toHaveBeenCalledWith("http://localhost:8080")
    expect(clearAuthBlocks).toHaveBeenCalledWith("http://localhost:8080")
  })

  it("does not leak plaintext credentials in error messages from getTorrents", async () => {
    const sensitiveAdapter = new QbtClientAdapter("localhost", 8080, false, {
      authMethod: "password",
      username: "secret-user",
      password: "secret-pass",
      urlPath: "",
    })
    vi.mocked(withSessionRetry).mockRejectedValueOnce(new Error("Auth failed"))

    try {
      await sensitiveAdapter.getTorrents()
      expect.unreachable("should have thrown")
    } catch (err) {
      expect((err as Error).message).not.toContain("secret-user")
      expect((err as Error).message).not.toContain("secret-pass")
    }
  })

  it("does not leak plaintext credentials in error messages from testConnection", async () => {
    const sensitiveAdapter = new QbtClientAdapter("localhost", 8080, false, {
      authMethod: "password",
      username: "secret-user",
      password: "secret-pass",
      urlPath: "",
    })
    vi.mocked(login).mockRejectedValueOnce(new Error("HTTP 403 Forbidden"))

    try {
      await sensitiveAdapter.testConnection()
      expect.unreachable("should have thrown")
    } catch (err) {
      expect((err as Error).message).not.toContain("secret-user")
      expect((err as Error).message).not.toContain("secret-pass")
    }
  })
})

// ---------------------------------------------------------------------------
// URL path
//
// The path travels inside the credentials. Dropped on the way to the login or
// the session wrapper, it sends that request to the bare host instead.
// ---------------------------------------------------------------------------

describe("QbtClientAdapter behind a URL path", () => {
  const adapter = new QbtClientAdapter("localhost", 8080, false, {
    authMethod: "password",
    username: "admin",
    password: "pass",
    urlPath: "/proxy/qui-client-key",
  })

  it("builds its baseUrl with the path", () => {
    expect(adapter.baseUrl).toBe("http://localhost:8080/proxy/qui-client-key")
  })

  it("hands the path to the session wrapper", async () => {
    vi.mocked(withSessionRetry).mockClear()
    await adapter.getTorrents({ tag: "aither" })
    expect(vi.mocked(withSessionRetry).mock.calls[0]?.[5]).toBe("/proxy/qui-client-key")
  })

  it("testConnection logs in under the path and invalidates the session it keys", async () => {
    vi.mocked(invalidateSession).mockClear()
    vi.mocked(login).mockClear()

    await adapter.testConnection()

    expect(invalidateSession).toHaveBeenCalledWith("http://localhost:8080/proxy/qui-client-key")
    expect(login).toHaveBeenCalledWith(
      "localhost",
      8080,
      false,
      "admin",
      "pass",
      "/proxy/qui-client-key"
    )
  })
})

// ---------------------------------------------------------------------------
// API-key mode
//
// A Bearer key is stateless: there is no login to perform, no SID to cache,
// and nothing to refresh on expiry. If withSessionRetry or login is ever
// called for a key client, the adapter is doing work that cannot succeed.
// ---------------------------------------------------------------------------

describe("QbtClientAdapter with API-key auth", () => {
  const adapter = new QbtClientAdapter("localhost", 8080, false, {
    authMethod: "apikey",
    apiKey: "qbt_examplekey",
    urlPath: "",
  })

  it("passes the key to the transport without logging in or retrying a session", async () => {
    vi.mocked(withSessionRetry).mockClear()
    vi.mocked(login).mockClear()
    vi.mocked(getTorrents).mockClear()

    await adapter.getTorrents({ tag: "aither" })

    expect(withSessionRetry).not.toHaveBeenCalled()
    expect(login).not.toHaveBeenCalled()
    expect(getTorrents).toHaveBeenCalledWith(
      "http://localhost:8080",
      { mode: "apikey", key: "qbt_examplekey" },
      "aither",
      undefined,
      undefined
    )
  })

  it("routes getTransferInfo and getDeltaSync through the key as well", async () => {
    vi.mocked(withSessionRetry).mockClear()
    vi.mocked(getTransferInfo).mockClear()
    vi.mocked(syncMaindata).mockClear()

    await adapter.getTransferInfo()
    await adapter.getDeltaSync?.(7)

    expect(withSessionRetry).not.toHaveBeenCalled()
    expect(getTransferInfo).toHaveBeenCalledWith("http://localhost:8080", {
      mode: "apikey",
      key: "qbt_examplekey",
    })
    expect(syncMaindata).toHaveBeenCalledWith(
      "http://localhost:8080",
      { mode: "apikey", key: "qbt_examplekey" },
      7
    )
  })

  it("testConnection probes the API directly instead of logging in", async () => {
    vi.mocked(login).mockClear()
    vi.mocked(getTransferInfo).mockClear()
    vi.mocked(clearAuthBlocks).mockClear()

    await adapter.testConnection()

    expect(login).not.toHaveBeenCalled()
    // Still clears the block: an explicit retry must reach the network, and a
    // rejected key is blocked by qbtFetch just like a rejected password.
    expect(clearAuthBlocks).toHaveBeenCalledWith("http://localhost:8080")
    expect(getTransferInfo).toHaveBeenCalledWith("http://localhost:8080", {
      mode: "apikey",
      key: "qbt_examplekey",
    })
  })

  it("dispose still resets the sync store for a key client", () => {
    vi.mocked(invalidateSession).mockClear()
    adapter.dispose()
    // invalidateSession also calls resetStore, guarding it behind "password"
    // would leave a key client's delta-sync store behind after an address change.
    expect(invalidateSession).toHaveBeenCalledWith("http://localhost:8080")
  })

  it("does not leak the plaintext key in error messages", async () => {
    vi.mocked(getTorrents).mockRejectedValueOnce(new Error("HTTP 403 Forbidden"))

    try {
      await adapter.getTorrents()
      expect.unreachable("should have thrown")
    } catch (err) {
      expect((err as Error).message).not.toContain("qbt_examplekey")
    }
  })
})
