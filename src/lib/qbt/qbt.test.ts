// src/lib/qbt/qbt.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"
import { aggregateByTag } from "./aggregator"
import { buildBaseUrl, getTorrents, getTransferInfo, login } from "./client"
import type { QbtTorrent } from "./types"
import { parseCrossSeedTags } from "./utils"

// ---------------------------------------------------------------------------
// buildBaseUrl
// ---------------------------------------------------------------------------

describe("buildBaseUrl", () => {
  it("builds an http URL when ssl is false", () => {
    expect(buildBaseUrl("192.168.1.1", 8080, false)).toBe("http://192.168.1.1:8080")
  })

  it("builds an https URL when ssl is true", () => {
    expect(buildBaseUrl("qbt.example.com", 443, true)).toBe("https://qbt.example.com:443")
  })
})

// ---------------------------------------------------------------------------
// login
// ---------------------------------------------------------------------------

describe("login", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("returns the SID cookie value on successful login", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      text: async () => "Ok.",
      headers: new Headers({ "set-cookie": "SID=abc123xyz; Path=/; HttpOnly" }),
    } as Response)

    const sid = await login("localhost", 8080, false, "admin", "password")
    expect(sid).toBe("abc123xyz")
  })

  it("sends a POST to the correct URL with form-encoded body", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      text: async () => "Ok.",
      headers: new Headers({ "set-cookie": "SID=testsid; Path=/" }),
    } as Response)

    await login("localhost", 8080, false, "admin", "secret")

    expect(fetchSpy.mock.calls[0][0]).toBe("http://localhost:8080/api/v2/auth/login")
    const init = fetchSpy.mock.calls[0][1] as RequestInit
    expect(init.method).toBe("POST")
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/x-www-form-urlencoded"
    )
    expect(init.body).toBe("username=admin&password=secret")
  })

  it("throws Authentication failed when response text is not Ok.", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      text: async () => "Fails.",
      headers: new Headers({}),
    } as Response)

    await expect(login("localhost", 8080, false, "admin", "wrongpass")).rejects.toThrow(
      "Authentication failed"
    )
  })

  it("throws Authentication failed when SID cookie is absent", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      text: async () => "Ok.",
      headers: new Headers({}),
    } as Response)

    await expect(login("localhost", 8080, false, "admin", "password")).rejects.toThrow(
      "Authentication failed"
    )
  })

  it("throws a qBittorrent API error on non-ok HTTP response", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: "Forbidden",
      text: async () => "",
      headers: new Headers({}),
    } as Response)

    await expect(login("localhost", 8080, false, "admin", "password")).rejects.toThrow(
      "qBittorrent API error: 403 Forbidden"
    )
  })

  it("throws a timeout message when AbortSignal fires", async () => {
    const timeoutError = new DOMException("signal timed out", "TimeoutError")
    vi.spyOn(global, "fetch").mockRejectedValueOnce(timeoutError)

    await expect(login("localhost", 8080, false, "admin", "password")).rejects.toThrow(
      "Request to localhost timed out after 15s"
    )
  })

  it("throws a connection error on network failure", async () => {
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("ECONNREFUSED"))

    await expect(login("192.168.1.50", 8080, false, "admin", "pass")).rejects.toThrow(
      "Failed to connect to http://192.168.1.50:8080: ECONNREFUSED"
    )
  })

  it("uses AbortSignal for timeout protection", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      text: async () => "Ok.",
      headers: new Headers({ "set-cookie": "SID=x; Path=/" }),
    } as Response)

    await login("localhost", 8080, false, "admin", "pass")

    const init = fetchSpy.mock.calls[0][1] as RequestInit
    expect(init.signal).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// getTorrents
// ---------------------------------------------------------------------------

describe("getTorrents", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("returns parsed torrent array on success", async () => {
    const mockTorrents: QbtTorrent[] = [
      {
        hash: "abc",
        name: "My.Show.S01.BluRay",
        state: "uploading",
        tags: "aither",
        category: "",
        upspeed: 1024,
        dlspeed: 0,
        uploaded: 5000000,
        downloaded: 3000000,
        ratio: 1.67,
        size: 3000000,
        num_seeds: 10,
        num_leechs: 2,
        num_complete: 15,
        num_incomplete: 3,
        tracker: "https://aither.cc/announce",
        added_on: 1700000000,
        completion_on: 1700001000,
        last_activity: 1700002000,
        seeding_time: 86400,
        time_active: 90000,
        seen_complete: 1700002000,
        availability: 1,
        amount_left: 0,
        progress: 1,
        content_path: "/downloads/My.Show.S01.BluRay",
        save_path: "/downloads",
        isPrivate: true,
      },
    ]

    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockTorrents,
    } as Response)

    const result = await getTorrents("http://localhost:8080", "mysid")
    expect(result).toHaveLength(1)
    expect(result[0].hash).toBe("abc")
    expect(result[0].state).toBe("uploading")
  })

  it("sends SID cookie in request", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response)

    await getTorrents("http://localhost:8080", "testSID99")

    const init = fetchSpy.mock.calls[0][1] as RequestInit
    expect((init.headers as Record<string, string>).Cookie).toBe("SID=testSID99")
  })

  it("calls the correct endpoint", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response)

    await getTorrents("http://localhost:8080", "sid")

    expect(fetchSpy.mock.calls[0][0]).toBe("http://localhost:8080/api/v2/torrents/info")
  })

  it("appends tag query parameter when tag is provided", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response)

    await getTorrents("http://localhost:8080", "sid", "aither")

    expect(fetchSpy.mock.calls[0][0]).toBe("http://localhost:8080/api/v2/torrents/info?tag=aither")
  })

  it("encodes special characters in tag parameter", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response)

    await getTorrents("http://localhost:8080", "sid", "cross seed")

    expect(fetchSpy.mock.calls[0][0]).toBe(
      "http://localhost:8080/api/v2/torrents/info?tag=cross%20seed"
    )
  })

  it("throws session expired on 403 response", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: "Forbidden",
    } as Response)

    await expect(getTorrents("http://localhost:8080", "sid")).rejects.toThrow("Session expired")
  })

  it("throws on non-ok response", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    } as Response)

    await expect(getTorrents("http://localhost:8080", "sid")).rejects.toThrow(
      "qBittorrent API error: 500 Internal Server Error"
    )
  })

  it("throws a timeout message when AbortSignal fires", async () => {
    vi.spyOn(global, "fetch").mockRejectedValueOnce(
      new DOMException("signal timed out", "TimeoutError")
    )

    await expect(getTorrents("http://localhost:8080", "sid")).rejects.toThrow(
      "Request to localhost timed out after 15s"
    )
  })

  it("throws a connection error on network failure", async () => {
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("fetch failed"))

    await expect(getTorrents("http://192.168.1.1:8080", "sid")).rejects.toThrow(
      "Failed to connect to 192.168.1.1"
    )
  })
})

// ---------------------------------------------------------------------------
// getTransferInfo
// ---------------------------------------------------------------------------

describe("getTransferInfo", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("returns parsed transfer info on success", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        up_info_speed: 2048,
        dl_info_speed: 4096,
        up_info_data: 10000000,
        dl_info_data: 20000000,
      }),
    } as Response)

    const info = await getTransferInfo("http://localhost:8080", "mysid")
    expect(info.up_info_speed).toBe(2048)
    expect(info.dl_info_speed).toBe(4096)
  })

  it("calls the correct endpoint", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ up_info_speed: 0, dl_info_speed: 0, up_info_data: 0, dl_info_data: 0 }),
    } as Response)

    await getTransferInfo("http://localhost:8080", "sid")

    expect(fetchSpy.mock.calls[0][0]).toBe("http://localhost:8080/api/v2/transfer/info")
  })

  it("sends SID cookie in request", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ up_info_speed: 0, dl_info_speed: 0, up_info_data: 0, dl_info_data: 0 }),
    } as Response)

    await getTransferInfo("http://localhost:8080", "mySID")

    const init = fetchSpy.mock.calls[0][1] as RequestInit
    expect((init.headers as Record<string, string>).Cookie).toBe("SID=mySID")
  })

  it("throws on non-ok response", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
    } as Response)

    await expect(getTransferInfo("http://localhost:8080", "sid")).rejects.toThrow(
      "qBittorrent API error: 401 Unauthorized"
    )
  })
})

// ---------------------------------------------------------------------------
// aggregateByTag
// ---------------------------------------------------------------------------

describe("aggregateByTag", () => {
  function makeTorrent(overrides: Partial<QbtTorrent>): QbtTorrent {
    return {
      hash: "deadbeef",
      name: "Test Torrent",
      state: "uploading",
      tags: "",
      category: "",
      upspeed: 0,
      dlspeed: 0,
      uploaded: 0,
      downloaded: 0,
      ratio: 0,
      size: 0,
      num_seeds: 0,
      num_leechs: 0,
      num_complete: 0,
      num_incomplete: 0,
      tracker: "",
      added_on: 0,
      completion_on: -1,
      last_activity: 0,
      seeding_time: 0,
      time_active: 0,
      seen_complete: 0,
      availability: -1,
      amount_left: 0,
      progress: 1,
      content_path: "/downloads/Test Torrent",
      save_path: "/downloads",
      isPrivate: true,
      ...overrides,
    }
  }

  it("counts seeding torrents for a matched tag", () => {
    const torrents = [makeTorrent({ state: "uploading", tags: "aither", upspeed: 512 })]
    const result = aggregateByTag(torrents, ["aither"], [])

    expect(result.totalSeedingCount).toBe(1)
    expect(result.totalLeechingCount).toBe(0)
    const aitherStats = result.tagStats.find((t) => t.tag === "aither")
    expect(aitherStats?.seedingCount).toBe(1)
    expect(aitherStats?.uploadSpeed).toBe(512)
  })

  it("counts leeching torrents for a matched tag", () => {
    const torrents = [makeTorrent({ state: "downloading", tags: "aither", dlspeed: 1024 })]
    const result = aggregateByTag(torrents, ["aither"], [])

    expect(result.totalLeechingCount).toBe(1)
    expect(result.totalSeedingCount).toBe(0)
    const aitherStats = result.tagStats.find((t) => t.tag === "aither")
    expect(aitherStats?.leechingCount).toBe(1)
    expect(aitherStats?.downloadSpeed).toBe(1024)
  })

  it("routes torrents with no matching tag into untagged bucket", () => {
    const torrents = [makeTorrent({ state: "uploading", tags: "some-other-tracker", upspeed: 200 })]
    const result = aggregateByTag(torrents, ["aither"], [])

    const untagged = result.tagStats.find((t) => t.tag === "untagged")
    expect(untagged).toBeDefined()
    expect(untagged?.seedingCount).toBe(1)
    expect(untagged?.uploadSpeed).toBe(200)
  })

  it("torrents with empty tags go into untagged bucket", () => {
    const torrents = [makeTorrent({ state: "uploading", tags: "" })]
    const result = aggregateByTag(torrents, ["aither"], [])

    const untagged = result.tagStats.find((t) => t.tag === "untagged")
    expect(untagged).toBeDefined()
    expect(untagged?.seedingCount).toBe(1)
  })

  it("handles torrents with multiple tags, crediting all matched buckets", () => {
    const torrents = [makeTorrent({ state: "uploading", tags: "aither, cross-seed", upspeed: 300 })]
    const result = aggregateByTag(torrents, ["aither"], ["cross-seed"])

    const aitherStats = result.tagStats.find((t) => t.tag === "aither")
    const crossSeedStats = result.tagStats.find((t) => t.tag === "cross-seed")
    expect(aitherStats?.seedingCount).toBe(1)
    expect(crossSeedStats?.seedingCount).toBe(1)
  })

  it("trims whitespace from torrent tags before matching", () => {
    const torrents = [makeTorrent({ state: "uploading", tags: "  aither  ,  cross-seed  " })]
    const result = aggregateByTag(torrents, ["aither"], ["cross-seed"])

    const aitherStats = result.tagStats.find((t) => t.tag === "aither")
    expect(aitherStats?.seedingCount).toBe(1)
  })

  it("does not include untagged bucket when all torrents are matched", () => {
    const torrents = [makeTorrent({ state: "uploading", tags: "aither" })]
    const result = aggregateByTag(torrents, ["aither"], [])

    const untagged = result.tagStats.find((t) => t.tag === "untagged")
    expect(untagged).toBeUndefined()
  })

  it("recognises all seeding states: stalledUP, forcedUP, queuedUP", () => {
    const torrents = [
      makeTorrent({ state: "stalledUP", tags: "aither" }),
      makeTorrent({ state: "forcedUP", tags: "aither" }),
      makeTorrent({ state: "queuedUP", tags: "aither" }),
    ]
    const result = aggregateByTag(torrents, ["aither"], [])
    expect(result.totalSeedingCount).toBe(3)
    const aitherStats = result.tagStats.find((t) => t.tag === "aither")
    expect(aitherStats?.seedingCount).toBe(3)
  })

  it("recognises all leeching states: stalledDL, forcedDL, queuedDL, metaDL", () => {
    const torrents = [
      makeTorrent({ state: "stalledDL", tags: "aither" }),
      makeTorrent({ state: "forcedDL", tags: "aither" }),
      makeTorrent({ state: "queuedDL", tags: "aither" }),
      makeTorrent({ state: "metaDL", tags: "aither" }),
    ]
    const result = aggregateByTag(torrents, ["aither"], [])
    expect(result.totalLeechingCount).toBe(4)
    const aitherStats = result.tagStats.find((t) => t.tag === "aither")
    expect(aitherStats?.leechingCount).toBe(4)
  })

  it("counts pausedUP as a seeding state", () => {
    const torrents = [makeTorrent({ state: "pausedUP", tags: "aither" })]
    const result = aggregateByTag(torrents, ["aither"], [])
    expect(result.totalSeedingCount).toBe(1)
    expect(result.totalLeechingCount).toBe(0)
    const aitherStats = result.tagStats.find((t) => t.tag === "aither")
    expect(aitherStats?.seedingCount).toBe(1)
  })

  it("ignores torrents in neither seeding nor leeching states", () => {
    const torrents = [makeTorrent({ state: "pausedDL", tags: "aither" })]
    const result = aggregateByTag(torrents, ["aither"], [])
    expect(result.totalSeedingCount).toBe(0)
    expect(result.totalLeechingCount).toBe(0)
    const aitherStats = result.tagStats.find((t) => t.tag === "aither")
    expect(aitherStats?.seedingCount).toBe(0)
  })

  it("returns zero totals for an empty torrent list", () => {
    const result = aggregateByTag([], ["aither"], ["cross-seed"])
    expect(result.totalSeedingCount).toBe(0)
    expect(result.totalLeechingCount).toBe(0)
    expect(result.uploadSpeedBytes).toBe(0)
    expect(result.downloadSpeedBytes).toBe(0)
    expect(result.tagStats).toHaveLength(2) // known tags with zeros
  })

  it("sums speeds across multiple seeding torrents for the same tag", () => {
    const torrents = [
      makeTorrent({ state: "uploading", tags: "aither", upspeed: 100 }),
      makeTorrent({ state: "stalledUP", tags: "aither", upspeed: 200 }),
    ]
    const result = aggregateByTag(torrents, ["aither"], [])
    const aitherStats = result.tagStats.find((t) => t.tag === "aither")
    expect(aitherStats?.uploadSpeed).toBe(300)
    expect(result.uploadSpeedBytes).toBe(300)
  })

  it("includes crossSeedTags in known tag buckets", () => {
    const torrents = [makeTorrent({ state: "uploading", tags: "cross-seed" })]
    const result = aggregateByTag(torrents, [], ["cross-seed"])
    const crossSeedStats = result.tagStats.find((t) => t.tag === "cross-seed")
    expect(crossSeedStats?.seedingCount).toBe(1)
    const untagged = result.tagStats.find((t) => t.tag === "untagged")
    expect(untagged).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// parseCrossSeedTags
// ---------------------------------------------------------------------------

describe("parseCrossSeedTags", () => {
  it("returns an empty array for null", () => {
    expect(parseCrossSeedTags(null)).toEqual([])
  })
})
