// src/lib/tracker-platforms/__tests__/tr4ker.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"
import { tr4ker } from "@/data/trackers/tr4ker"
import { findClassIndex } from "@/lib/rank-ladder"
import { Tr4kerAdapter } from "../adapters/tr4ker"

// Invented fixture in the shape returned by GET /api/me. Figures are
// anonymised; the account name and id are not real.
const LIVE_RESPONSE = {
  id: 123456,
  username: "example-user",
  role: "user",
  power: 0,
  uploaded: 1234567890123,
  downloaded: 234567890123,
  bonus_upload: 10737418240,
  bonus_download: 1073741824,
  money: 4242,
  avatar_url: null,
  joined_at: "2026-08-08T14:37:30.007777Z",
  last_seen_at: "2026-10-09T18:54:38.432277Z",
}

const okResponse = (body: unknown) =>
  ({ ok: true, json: async () => body }) as Response

describe("Tr4kerAdapter", () => {
  const adapter = new Tr4kerAdapter()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("maps the /api/me response into TrackerStats", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(okResponse(LIVE_RESPONSE))

    const stats = await adapter.fetchStats("https://tr4ker.net", "fake-token", "/api/me")

    expect(stats.username).toBe("example-user")
    expect(stats.group).toBe("Membre")
    expect(stats.uploadedBytes).toBe(1234567890123n + 10737418240n)
    expect(stats.downloadedBytes).toBe(234567890123n + 1073741824n)
    expect(stats.ratio).toBeCloseTo(
      (1234567890123 + 10737418240) / (234567890123 + 1073741824),
      4
    )
    expect(stats.bufferBytes).toBe(1234567890123n + 10737418240n - (234567890123n + 1073741824n))
    expect(stats.seedbonus).toBe(4242)
    expect(stats.remoteUserId).toBe(123456)
    expect(stats.joinedDate).toBe("2026-08-08T14:37:30.007777Z")
    expect(stats.lastAccessDate).toBe("2026-10-09T18:54:38.432277Z")
    expect(stats.avatarUrl).toBeUndefined()
  })

  it("names every role id as the site does, with a class the registry entry lists", async () => {
    // The site's own role list, from its frontend bundle.
    const SITE_CLASSES = {
      user: "Membre",
      helper: "Helper",
      uploader_herbe: "Uploader en herbe",
      uploader: "Uploader",
      contributeur: "Contributeur",
      team: "Team",
      moderator: "Modérateur",
      admin: "Administrateur",
    }
    for (const [role, label] of Object.entries(SITE_CLASSES)) {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(okResponse({ ...LIVE_RESPONSE, role }))
      const stats = await adapter.fetchStats("https://tr4ker.net", "fake-token", "/api/me")
      expect(stats.group).toBe(label)
      expect(findClassIndex(tr4ker.userClasses, stats.group), role).not.toBe(-1)
    }
  })

  it("shows an unmapped role as sent and reports no class when there is none", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(okResponse({ ...LIVE_RESPONSE, role: "vip" }))
    const unmapped = await adapter.fetchStats("https://tr4ker.net", "fake-token", "/api/me")
    expect(unmapped.group).toBe("vip")

    for (const role of [undefined, ""]) {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(okResponse({ ...LIVE_RESPONSE, role }))
      const stats = await adapter.fetchStats("https://tr4ker.net", "fake-token", "/api/me")
      expect(stats.group).toBeNull()
    }
  })

  it("counts a null bonus as no bonus", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      okResponse({ ...LIVE_RESPONSE, bonus_upload: null, bonus_download: null })
    )

    const stats = await adapter.fetchStats("https://tr4ker.net", "fake-token", "/api/me")

    expect(stats.uploadedBytes).toBe(1234567890123n)
    expect(stats.downloadedBytes).toBe(234567890123n)
  })

  it("rejects an absent or non-numeric bonus instead of reading it as zero", async () => {
    for (const field of ["bonus_upload", "bonus_download"] as const) {
      const { [field]: _dropped, ...body } = LIVE_RESPONSE
      vi.spyOn(global, "fetch").mockResolvedValueOnce(okResponse(body))
      await expect(
        adapter.fetchStats("https://tr4ker.net", "fake-token", "/api/me")
      ).rejects.toThrow(`Unexpected response from tr4ker.net: missing ${field}`)
    }

    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      okResponse({ ...LIVE_RESPONSE, bonus_download: "1073741824" })
    )
    await expect(
      adapter.fetchStats("https://tr4ker.net", "fake-token", "/api/me")
    ).rejects.toThrow("Unexpected response from tr4ker.net: non-numeric bonus_download")
  })

  it("gives an account with no raw download but a bonus download a finite ratio", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      okResponse({
        ...LIVE_RESPONSE,
        uploaded: 0,
        downloaded: 0,
        bonus_upload: 53687091200,
        bonus_download: 1073741824,
      })
    )

    const stats = await adapter.fetchStats("https://tr4ker.net", "fake-token", "/api/me")

    expect(stats.downloadedBytes).toBe(1073741824n)
    expect(stats.ratio).toBe(50)
  })

  it("rejects a missing byte total instead of reading it as zero", async () => {
    for (const field of ["uploaded", "downloaded"] as const) {
      const { [field]: _dropped, ...body } = LIVE_RESPONSE
      vi.spyOn(global, "fetch").mockResolvedValueOnce(okResponse(body))

      await expect(
        adapter.fetchStats("https://tr4ker.net", "fake-token", "/api/me")
      ).rejects.toThrow(`Unexpected response from tr4ker.net: missing ${field}`)
    }
  })

  it("leaves fields TR4KER does not report as null", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(okResponse(LIVE_RESPONSE))

    const stats = await adapter.fetchStats("https://tr4ker.net", "fake-token", "/api/me")

    expect(stats.seedingCount).toBeNull()
    expect(stats.leechingCount).toBeNull()
    expect(stats.hitAndRuns).toBeNull()
    expect(stats.requiredRatio).toBeNull()
    expect(stats.warned).toBeNull()
    expect(stats.freeleechTokens).toBeNull()
  })

  it("sends the API key in the X-Api-Key header and not in the URL", async () => {
    let capturedUrl: string | undefined
    let capturedInit: RequestInit | undefined
    vi.spyOn(global, "fetch").mockImplementationOnce((url, init) => {
      capturedUrl = String(url)
      capturedInit = init
      return Promise.resolve(okResponse(LIVE_RESPONSE))
    })

    await adapter.fetchStats("https://tr4ker.net", "secret-token", "/api/me")

    const headers = capturedInit?.headers as Record<string, string> | undefined
    expect(headers?.["X-Api-Key"]).toBe("secret-token")
    expect(capturedUrl).toBe("https://tr4ker.net/api/me")
    expect(capturedUrl).not.toContain("secret-token")
    expect(capturedUrl).not.toContain("apikey")
  })

  it("does not expose the API token in non-ok response errors", async () => {
    const secretToken = "super-secret-api-token-12345"

    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
    } as Response)

    await expect(
      adapter.fetchStats("https://tr4ker.net", secretToken, "/api/me")
    ).rejects.toSatisfy((err: Error) => {
      expect(err.message).not.toContain(secretToken)
      return true
    })
  })

  it("throws on a non-ok HTTP response", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
    } as Response)

    await expect(
      adapter.fetchStats("https://tr4ker.net", "bad-token", "/api/me")
    ).rejects.toThrow("401")
  })
})

describe("Tr4kerAdapter - fetchRaw", () => {
  const adapter = new Tr4kerAdapter()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("returns the raw response for the debug view", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(okResponse(LIVE_RESPONSE))

    const calls = await adapter.fetchRaw("https://tr4ker.net", "token", "/api/me")

    expect(calls).toHaveLength(1)
    expect(calls[0].label).toBe("User Stats")
    expect(calls[0].endpoint).toBe("/api/me")
    expect(calls[0].error).toBeNull()
    expect(calls[0].data).toEqual(LIVE_RESPONSE)
  })

  it("reports an error DebugApiCall instead of throwing when fetch rejects", async () => {
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("fetch failed"))

    const calls = await adapter.fetchRaw("https://tr4ker.net", "token", "/api/me")

    expect(calls[0].data).toBeNull()
    expect(calls[0].error).toBeTruthy()
    expect(calls[0].endpoint).toBe("/api/me")
  })

  it("flags a 200 that fetchStats would fail, with the poll's message (standard 2.6)", async () => {
    for (const field of ["uploaded", "downloaded", "bonus_upload", "bonus_download"] as const) {
      const { [field]: _dropped, ...body } = LIVE_RESPONSE
      vi.spyOn(global, "fetch").mockResolvedValueOnce(okResponse(body))

      const calls = await adapter.fetchRaw("https://tr4ker.net", "token", "/api/me")

      expect(calls[0].error).toBe(`Unexpected response from tr4ker.net: missing ${field}`)
      // The offending body stays in data for the debug view.
      expect(calls[0].data).toEqual(body)
    }

    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      okResponse({ ...LIVE_RESPONSE, bonus_download: "1073741824" })
    )
    const nonNumeric = await adapter.fetchRaw("https://tr4ker.net", "token", "/api/me")
    expect(nonNumeric[0].error).toBe(
      "Unexpected response from tr4ker.net: non-numeric bonus_download"
    )
  })
})
