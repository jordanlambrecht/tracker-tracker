// src/lib/tracker-platforms/__tests__/mteam.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MteamAdapter } from "../adapters/mteam"
import type { MteamPlatformMeta } from "../contract"

// Synthetic fixture built from the documented M-Team API shape. The adapter
// has not been tested against a live account yet; the registry marks it
// unverified until a member captures a real response.
const PROFILE_RESPONSE = {
  code: "0",
  message: "SUCCESS",
  data: {
    id: "123456",
    username: "MTeamUser",
    createdDate: "2020-05-17 10:00:00",
    lastModifiedDate: "2026-10-21T12:00:00.000+0800",
    role: "2",
    memberCount: {
      uploaded: "5020000000000",
      downloaded: "1980000000000",
      bonus: "21067.2",
      shareRate: "2.5353535",
      seedtime: "123456",
      leechtime: "6543",
    },
    memberStatus: {
      lastLogin: "2026-10-21 11:00:00",
      lastBrowse: "2026-10-21 11:30:00",
      vip: false,
    },
  },
}

const PEER_RESPONSE = {
  code: "0",
  message: "SUCCESS",
  data: {
    seeder: "64",
    leecher: "2",
  },
}

const okResponse = (body: unknown) =>
  ({ ok: true, status: 200, statusText: "OK", json: async () => body }) as Response

const HOST = "https://kp.m-team.cc"
const PATH = "/api/member/profile"

describe("MteamAdapter", () => {
  const adapter = new MteamAdapter()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("maps the profile and peer status into TrackerStats", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(okResponse(PROFILE_RESPONSE))
      .mockResolvedValueOnce(okResponse(PEER_RESPONSE))

    const stats = await adapter.fetchStats(HOST, "api-key", PATH)
    const meta = stats.platformMeta as MteamPlatformMeta

    expect(stats.username).toBe("MTeamUser")
    expect(stats.group).toBe("Power User")
    expect(stats.uploadedBytes).toBe(5020000000000n)
    expect(stats.downloadedBytes).toBe(1980000000000n)
    expect(stats.ratio).toBe(2.5353535)
    expect(stats.bufferBytes).toBe(3040000000000n)
    expect(stats.seedbonus).toBe(21067.2)
    expect(stats.seedingCount).toBe(64)
    expect(stats.leechingCount).toBe(2)
    expect(stats.remoteUserId).toBe(123456)
    expect(stats.joinedDate).toBe("2020-05-17")
    expect(stats.lastAccessDate).toBe("2026-10-21")
    expect(meta.vip).toBe(false)
  })

  it("fails when a byte total is missing", async () => {
    for (const field of ["uploaded", "downloaded"] as const) {
      const { [field]: _dropped, ...memberCount } = PROFILE_RESPONSE.data.memberCount
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        okResponse({
          ...PROFILE_RESPONSE,
          data: { ...PROFILE_RESPONSE.data, memberCount },
        })
      )

      await expect(adapter.fetchStats(HOST, "api-key", PATH)).rejects.toThrow(
        `Unexpected response from kp.m-team.cc: missing ${field}`
      )
    }
  })

  it("keeps the profile when the peer status request fails", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(okResponse(PROFILE_RESPONSE))
      .mockRejectedValueOnce(new TypeError("fetch failed"))

    const stats = await adapter.fetchStats(HOST, "api-key", PATH)

    expect(stats.uploadedBytes).toBe(5020000000000n)
    expect(stats.seedingCount).toBeNull()
    expect(stats.leechingCount).toBeNull()
  })

  it("reports an unknown role as no class", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(
        okResponse({
          ...PROFILE_RESPONSE,
          data: { ...PROFILE_RESPONSE.data, role: "99" },
        })
      )
      .mockResolvedValueOnce(okResponse(PEER_RESPONSE))

    const stats = await adapter.fetchStats(HOST, "api-key", PATH)

    expect(stats.group).toBeNull()
  })

  it("uses the site's current name for the top class", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(
        okResponse({
          ...PROFILE_RESPONSE,
          data: { ...PROFILE_RESPONSE.data, role: "9" },
        })
      )
      .mockResolvedValueOnce(okResponse(PEER_RESPONSE))

    const stats = await adapter.fetchStats(HOST, "api-key", PATH)

    expect(stats.group).toBe("mTorrent Master")
  })

  it("does not invent names for unconfirmed administrative roles", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(
        okResponse({
          ...PROFILE_RESPONSE,
          data: { ...PROFILE_RESPONSE.data, role: "13" },
        })
      )
      .mockResolvedValueOnce(okResponse(PEER_RESPONSE))

    const stats = await adapter.fetchStats(HOST, "api-key", PATH)

    expect(stats.group).toBeNull()
  })

  it("surfaces the API message on a non-success code", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      okResponse({ code: "1", message: "Invalid API key", data: null })
    )

    await expect(adapter.fetchStats(HOST, "bad-key", PATH)).rejects.toThrow("Invalid API key")
  })

  it("reports an infinite ratio when nothing was downloaded", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(
        okResponse({
          ...PROFILE_RESPONSE,
          data: {
            ...PROFILE_RESPONSE.data,
            memberCount: { ...PROFILE_RESPONSE.data.memberCount, downloaded: "0", shareRate: "0" },
          },
        })
      )
      .mockResolvedValueOnce(okResponse(PEER_RESPONSE))

    const stats = await adapter.fetchStats(HOST, "api-key", PATH)

    expect(stats.ratio).toBe(Number.POSITIVE_INFINITY)
  })

  it("sends the key in the x-api-key header and keeps it out of the URL", async () => {
    const urls: string[] = []
    let capturedInit: RequestInit | undefined
    vi.spyOn(global, "fetch")
      .mockImplementationOnce((url, init) => {
        urls.push(String(url))
        capturedInit = init
        return Promise.resolve(okResponse(PROFILE_RESPONSE))
      })
      .mockImplementationOnce((url) => {
        urls.push(String(url))
        return Promise.resolve(okResponse(PEER_RESPONSE))
      })

    await adapter.fetchStats(HOST, "secret-key", PATH)

    const headers = capturedInit?.headers as Record<string, string> | undefined
    expect(headers?.["x-api-key"]).toBe("secret-key")
    expect(headers?.["Content-Type"]).toBe("application/json")
    expect(capturedInit?.method).toBe("POST")
    expect(urls[0]).toBe("https://api.m-team.cc/api/member/profile")
    expect(urls[1]).toBe("https://api.m-team.cc/api/tracker/myPeerStatus")
    expect(urls.join(" ")).not.toContain("secret-key")
  })
})

describe("MteamAdapter - fetchRaw", () => {
  const adapter = new MteamAdapter()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("returns both raw calls for the debug view", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(okResponse(PROFILE_RESPONSE))
      .mockResolvedValueOnce(okResponse(PEER_RESPONSE))

    const calls = await adapter.fetchRaw(HOST, "api-key", PATH)

    expect(calls).toHaveLength(2)
    expect(calls[0].label).toBe("Profile")
    expect(calls[0].endpoint).toBe(PATH)
    expect(calls[0].error).toBeNull()
    expect(calls[0].data).toEqual(PROFILE_RESPONSE)
    expect(calls[1].label).toBe("Peer Status")
    expect(calls[1].endpoint).toBe("/api/tracker/myPeerStatus")
    expect(calls[1].error).toBeNull()
    expect(calls[1].data).toEqual(PEER_RESPONSE)
  })

  it("reports a peer status failure without hiding the profile", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(okResponse(PROFILE_RESPONSE))
      .mockRejectedValueOnce(new TypeError("fetch failed"))

    const calls = await adapter.fetchRaw(HOST, "api-key", PATH)

    expect(calls[0].error).toBeNull()
    expect(calls[1].data).toBeNull()
    expect(calls[1].error).toBeTruthy()
  })
})
