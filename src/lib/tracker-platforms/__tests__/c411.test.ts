// src/lib/tracker-platforms/__tests__/c411.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"
import { c411 } from "@/data/trackers/c411"
import { C411Adapter } from "../adapters/c411"

// Invented fixture in the shape GET /api/user/profile returned live on
// 2026-10-20 and C411's API docs describe. Figures are anonymised; the account
// name and id are not real.
const LIVE_RESPONSE = {
  id: 123456,
  username: "example-user",
  avatarUrl: "/avatars/123456.webp",
  memberSince: "2025-03-14T09:12:44.000Z",
  level: { level: 37, xp: 18420, xpIntoLevel: 310, xpToNextLevel: 239 },
  class: {
    slug: "team_mainstream",
    effectiveSlug: "team_resident_mainstream",
    foundation: "seed",
    treeBonusBp: 250,
    progress: { questsCompleted: 23, questsTotal: 40, stars: 2, grade: { tier: "argent", level: 2 } },
  },
  team: { name: "Example Team", slug: "example-team", tag: "EXT", role: "member" },
  zen: { balance: 1840, totalEarned: 12650, totalSpent: 10810 },
  transfer: {
    uploaded: { actual: 5497558138880, credit: 107374182400, total: 5604932321280 },
    downloaded: { actual: 3298534883328, credit: 53687091200, total: 3244847792128 },
  },
  download: { allowed: true, blockedReason: null },
  freeleech: { active: false, sources: [] },
  silverLeech: false,
  leechBonuses: [],
}

const okResponse = (body: unknown) => ({ ok: true, json: async () => body }) as Response

describe("C411Adapter", () => {
  const adapter = new C411Adapter()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("reports C411's own reason when it refuses the key", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ statusCode: 401, message: "Site is currently restricted." }), {
        status: 401,
        statusText: "Unauthorized",
        headers: { "content-type": "application/json" },
      })
    )

    await expect(
      adapter.fetchStats("https://c411.org", "fake-key", "/api/user/profile")
    ).rejects.toThrow(/^Tracker API error: 401 Unauthorized: Site is currently restricted\.$/)
  })

  it("maps the /api/user/profile response into TrackerStats", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(okResponse(LIVE_RESPONSE))

    const stats = await adapter.fetchStats("https://c411.org", "fake-key", "/api/user/profile")

    expect(stats.username).toBe("example-user")
    expect(stats.group).toBe("Silver II")
    // The totals carry the credit, the way C411 counts its ratio.
    expect(stats.uploadedBytes).toBe(5604932321280n)
    expect(stats.downloadedBytes).toBe(3244847792128n)
    expect(stats.ratio).toBeCloseTo(5604932321280 / 3244847792128, 4)
    expect(stats.bufferBytes).toBe(5604932321280n - 3244847792128n)
    expect(stats.seedbonus).toBe(1840)
    expect(stats.remoteUserId).toBe(123456)
    expect(stats.joinedDate).toBe("2025-03-14T09:12:44.000Z")
    expect(stats.avatarUrl).toBe("https://c411.org/avatars/123456.webp")
    expect(stats.platformMeta).toEqual({ canDownload: true })
  })

  it("names every grade as the wiki does, in the registry ladder's order", async () => {
    const names: (string | null)[] = []
    for (const tier of ["bronze", "argent", "or"]) {
      for (const level of [1, 2, 3, 4]) {
        vi.spyOn(global, "fetch").mockResolvedValueOnce(
          okResponse({ ...LIVE_RESPONSE, class: { progress: { grade: { tier, level } } } })
        )
        const stats = await adapter.fetchStats("https://c411.org", "fake-key", "/api/user/profile")
        names.push(stats.group)
      }
    }
    expect(names).toEqual(c411.userClasses.map((c) => c.name))
  })

  it("shows an unknown tier as sent, and no rank before a class is chosen", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      okResponse({ ...LIVE_RESPONSE, class: { progress: { grade: { tier: "platine", level: 2 } } } })
    )
    const unknown = await adapter.fetchStats("https://c411.org", "fake-key", "/api/user/profile")
    expect(unknown.group).toBe("platine II")

    for (const cls of [null, {}, { progress: { grade: { tier: "", level: 1 } } }]) {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(okResponse({ ...LIVE_RESPONSE, class: cls }))
      const stats = await adapter.fetchStats("https://c411.org", "fake-key", "/api/user/profile")
      expect(stats.group).toBeNull()
    }
  })

  it("reports no Zen balance as null, not as zero", async () => {
    for (const zen of [null, {}]) {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(okResponse({ ...LIVE_RESPONSE, zen }))
      const stats = await adapter.fetchStats("https://c411.org", "fake-key", "/api/user/profile")
      expect(stats.seedbonus).toBeNull()
    }
  })

  it("flags blocked downloads, and leaves the flag out when the response has none", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      okResponse({
        ...LIVE_RESPONSE,
        download: { allowed: false, blockedReason: "insufficient_balance" },
      })
    )
    const blocked = await adapter.fetchStats("https://c411.org", "fake-key", "/api/user/profile")
    expect(blocked.platformMeta).toEqual({ canDownload: false })

    const { download: _dropped, ...body } = LIVE_RESPONSE
    for (const unknownBody of [body, { ...LIVE_RESPONSE, download: { allowed: null } }]) {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(okResponse(unknownBody))
      const unknown = await adapter.fetchStats("https://c411.org", "fake-key", "/api/user/profile")
      expect(unknown.platformMeta).toEqual({})
    }
  })

  it("reports an empty username when the response leaves it out", async () => {
    const { username: _dropped, ...body } = LIVE_RESPONSE
    vi.spyOn(global, "fetch").mockResolvedValueOnce(okResponse(body))

    const stats = await adapter.fetchStats("https://c411.org", "fake-key", "/api/user/profile")

    expect(stats.username).toBe("")
  })

  it("gives an account whose credit covers every download an infinite ratio", async () => {
    // A new account: the 50 GB welcome credit and nothing downloaded yet.
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      okResponse({
        ...LIVE_RESPONSE,
        transfer: {
          uploaded: { actual: 0, credit: 53687091200, total: 53687091200 },
          downloaded: { actual: 0, credit: 0, total: 0 },
        },
      })
    )

    const stats = await adapter.fetchStats("https://c411.org", "fake-key", "/api/user/profile")

    expect(stats.downloadedBytes).toBe(0n)
    expect(stats.ratio).toBe(Infinity)
    expect(stats.bufferBytes).toBe(53687091200n)
  })

  it("asks for /api/user/profile even when a stale path is stored", async () => {
    let capturedUrl: string | undefined
    vi.spyOn(global, "fetch").mockImplementationOnce((url) => {
      capturedUrl = String(url)
      return Promise.resolve(okResponse(LIVE_RESPONSE))
    })

    await adapter.fetchStats("https://c411.org", "fake-key", "/api/auth/me")

    expect(capturedUrl).toBe("https://c411.org/api/user/profile")
  })

  it("shows no avatar when there is none or its path cannot be read", async () => {
    for (const avatarUrl of [null, "", "http://["]) {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(okResponse({ ...LIVE_RESPONSE, avatarUrl }))
      const stats = await adapter.fetchStats("https://c411.org", "fake-key", "/api/user/profile")
      expect(stats.avatarUrl).toBeUndefined()
    }
  })

  it("rejects a missing or non-numeric byte total instead of reading it as zero", async () => {
    for (const side of ["uploaded", "downloaded"] as const) {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        okResponse({
          ...LIVE_RESPONSE,
          transfer: { ...LIVE_RESPONSE.transfer, [side]: { actual: 1, credit: 0 } },
        })
      )
      await expect(
        adapter.fetchStats("https://c411.org", "fake-key", "/api/user/profile")
      ).rejects.toThrow(`Unexpected response from c411.org: missing transfer.${side}.total`)
    }

    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      okResponse({
        ...LIVE_RESPONSE,
        transfer: { ...LIVE_RESPONSE.transfer, uploaded: { total: "5604932321280" } },
      })
    )
    await expect(
      adapter.fetchStats("https://c411.org", "fake-key", "/api/user/profile")
    ).rejects.toThrow("Unexpected response from c411.org: non-numeric transfer.uploaded.total")
  })

  it("leaves fields C411 does not report as null", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(okResponse(LIVE_RESPONSE))

    const stats = await adapter.fetchStats("https://c411.org", "fake-key", "/api/user/profile")

    expect(stats.seedingCount).toBeNull()
    expect(stats.leechingCount).toBeNull()
    expect(stats.hitAndRuns).toBeNull()
    expect(stats.requiredRatio).toBeNull()
    expect(stats.warned).toBeNull()
    expect(stats.freeleechTokens).toBeNull()
  })

  it("sends the API key as a Bearer token and not in the URL", async () => {
    let capturedUrl: string | undefined
    let capturedInit: RequestInit | undefined
    vi.spyOn(global, "fetch").mockImplementationOnce((url, init) => {
      capturedUrl = String(url)
      capturedInit = init
      return Promise.resolve(okResponse(LIVE_RESPONSE))
    })

    await adapter.fetchStats("https://c411.org", "secret-key", "/api/user/profile")

    const headers = capturedInit?.headers as Record<string, string> | undefined
    expect(headers?.Authorization).toBe("Bearer secret-key")
    expect(capturedUrl).toBe("https://c411.org/api/user/profile")
    expect(capturedUrl).not.toContain("secret-key")
  })

  it("does not expose the API key in non-ok response errors", async () => {
    const secretKey = "super-secret-api-key-12345"

    for (const [status, statusText] of [
      [401, "Unauthorized"],
      [403, "Forbidden"],
    ] as const) {
      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: false,
        status,
        statusText,
      } as Response)

      await expect(
        adapter.fetchStats("https://c411.org", secretKey, "/api/user/profile")
      ).rejects.toSatisfy((err: Error) => {
        expect(err.message).toContain(String(status))
        expect(err.message).not.toContain(secretKey)
        return true
      })
    }
  })
})

describe("C411Adapter - fetchRaw", () => {
  const adapter = new C411Adapter()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("returns the raw response for the debug view", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(okResponse(LIVE_RESPONSE))

    const calls = await adapter.fetchRaw("https://c411.org", "key", "/api/user/profile")

    expect(calls).toHaveLength(1)
    expect(calls[0].label).toBe("User Profile")
    expect(calls[0].endpoint).toBe("/api/user/profile")
    expect(calls[0].error).toBeNull()
    expect(calls[0].data).toEqual(LIVE_RESPONSE)
  })

  it("reports an error DebugApiCall instead of throwing when fetch rejects", async () => {
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("fetch failed"))

    const calls = await adapter.fetchRaw("https://c411.org", "key", "/api/user/profile")

    expect(calls[0].data).toBeNull()
    expect(calls[0].error).toContain("c411.org")
    expect(calls[0].endpoint).toBe("/api/user/profile")
  })

  it("flags a 200 that fetchStats would fail, with the poll's message (standard 2.6)", async () => {
    for (const side of ["uploaded", "downloaded"] as const) {
      const body = {
        ...LIVE_RESPONSE,
        transfer: { ...LIVE_RESPONSE.transfer, [side]: { actual: 1, credit: 0 } },
      }
      vi.spyOn(global, "fetch").mockResolvedValueOnce(okResponse(body))

      const calls = await adapter.fetchRaw("https://c411.org", "key", "/api/user/profile")

      expect(calls[0].error).toBe(`Unexpected response from c411.org: missing transfer.${side}.total`)
      // The offending body stays in data for the debug view.
      expect(calls[0].data).toEqual(body)
    }

    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      okResponse({
        ...LIVE_RESPONSE,
        transfer: { ...LIVE_RESPONSE.transfer, uploaded: { total: "5604932321280" } },
      })
    )
    const nonNumeric = await adapter.fetchRaw("https://c411.org", "key", "/api/user/profile")
    expect(nonNumeric[0].error).toBe(
      "Unexpected response from c411.org: non-numeric transfer.uploaded.total"
    )
  })
})
