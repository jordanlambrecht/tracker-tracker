// src/lib/tracker-platforms/__tests__/v3x.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"
import { parseV3xMe, V3xAdapter } from "../adapters/v3x"
import { SessionExpiredError } from "../helpers/errors"

// Synthetic fixture shaped like /auth/me. No real account data.
const ME = {
  username: "testuser",
  role: "power_user",
  status: "active",
  uploaded: 186064294312,
  downloaded: 74273761201,
  downloadedReal: 73200019377,
  bonusPoints: 18591,
  seedTimeSeconds: 37339256,
  freeleechTokens: 0,
  createdAt: "2026-09-05T13:57:58.012Z",
  ratio: 2.505114744471765,
  ratioFloor: { enabled: true, floor: 0.5, warnAt: 0.7, level: "ok" },
  hnr: { enabled: true, active: 1, uploader: 0, max: 3, exempt: false },
}

const GAME = {
  xp: 28020,
  level: 14,
  prestige: 0,
  rank: { key: "second", label: "Second rôle" },
  nextRank: { label: "Tête d'affiche", atLevel: 25 },
  into: 4100,
  need: 4248,
  maxed: false,
  loginStreak: 20,
  seedStreak: 37,
  missions: [],
}

const HOST = "https://v3x.club"
const CREDENTIALS = JSON.stringify({ cookies: "v3x_session=abc", userAgent: "Mozilla/5.0" })

const jsonResponse = (body: unknown) =>
  ({
    ok: true,
    status: 200,
    statusText: "OK",
    headers: { get: () => null },
    json: async () => body,
    text: async () => JSON.stringify(body),
  }) as unknown as Response

const statusResponse = (status: number, statusText: string) =>
  ({
    ok: false,
    status,
    statusText,
    headers: { get: () => null },
    body: null,
    json: async () => ({}),
    text: async () => "",
  }) as unknown as Response

describe("parseV3xMe", () => {
  it("maps the API payload into TrackerStats", () => {
    const stats = parseV3xMe(ME)

    expect(stats.username).toBe("testuser")
    expect(stats.group).toBeNull()
    expect(stats.uploadedBytes).toBe(186064294312n)
    expect(stats.downloadedBytes).toBe(74273761201n)
    expect(stats.ratio).toBeCloseTo(2.505114744471765, 10)
    expect(stats.bufferBytes).toBe(111790533111n)
    expect(stats.seedbonus).toBe(18591)
    expect(stats.hitAndRuns).toBe(1)
    expect(stats.requiredRatio).toBe(0.5)
    expect(stats.freeleechTokens).toBe(0)
    expect(stats.joinedDate).toBe("2026-09-05T13:57:58.012Z")
    expect(stats.seedingCount).toBeNull()
    expect(stats.leechingCount).toBeNull()
    expect(stats.warned).toBeNull()
    expect(stats.platformMeta).toBeUndefined()
  })

  it.each(["uploaded", "downloaded"])("fails when %s is missing", (field) => {
    expect(() => parseV3xMe({ ...ME, [field]: undefined })).toThrow(
      `Unexpected response from api.v3x.club: missing ${field}`
    )
  })

  it("reads a zero-download account", () => {
    const stats = parseV3xMe({ ...ME, downloaded: 0 })

    expect(stats.downloadedBytes).toBe(0n)
    expect(stats.ratio).toBe(Number.POSITIVE_INFINITY)
  })

  it("fails on a body without a user object", () => {
    expect(() => parseV3xMe(null)).toThrow(
      "Unexpected response from api.v3x.club: missing user object"
    )
  })
})

describe("V3xAdapter", () => {
  const adapter = new V3xAdapter()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("reads /auth/me and takes the class from the gamification rank", async () => {
    const inits: { url: string; init?: RequestInit }[] = []
    vi.spyOn(global, "fetch").mockImplementation((url, init) => {
      inits.push({ url: String(url), init })
      return Promise.resolve(jsonResponse(String(url).endsWith("/auth/me") ? ME : GAME))
    })

    const stats = await adapter.fetchStats(HOST, CREDENTIALS, "/auth/me")
    const headers = inits[0].init?.headers as Record<string, string>

    expect(inits.map((c) => c.url)).toEqual([
      "https://api.v3x.club/auth/me",
      "https://api.v3x.club/me/gamification",
    ])
    expect(stats.uploadedBytes).toBe(186064294312n)
    expect(stats.group).toBe("Second rôle")
    expect(headers.Cookie).toBe("v3x_session=abc")
    expect(headers["User-Agent"]).toBe("Mozilla/5.0")
    expect(headers.Accept).toBe("application/json")
    expect(headers["Sec-Fetch-Mode"]).toBeUndefined()
  })

  it("leaves the class empty when gamification is unavailable", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(jsonResponse(ME))
      .mockRejectedValueOnce(new TypeError("fetch failed"))

    const stats = await adapter.fetchStats(HOST, CREDENTIALS, "/auth/me")

    expect(stats.group).toBeNull()
  })

  it("leaves the class empty for a blank rank label", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(jsonResponse(ME))
      .mockResolvedValueOnce(jsonResponse({ ...GAME, rank: { key: "x", label: "  " } }))

    const stats = await adapter.fetchStats(HOST, CREDENTIALS, "/auth/me")

    expect(stats.group).toBeNull()
  })

  it("turns a 401 into a session-expired error", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(statusResponse(401, "Unauthorized"))

    await expect(adapter.fetchStats(HOST, CREDENTIALS, "/auth/me")).rejects.toBeInstanceOf(
      SessionExpiredError
    )
  })

  it("rethrows a 401 from the gamification call", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(jsonResponse(ME))
      .mockResolvedValueOnce(statusResponse(401, "Unauthorized"))

    await expect(adapter.fetchStats(HOST, CREDENTIALS, "/auth/me")).rejects.toBeInstanceOf(
      SessionExpiredError
    )
  })

  it("fails a 403 as an ordinary error", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(statusResponse(403, "Forbidden"))

    const err = await adapter.fetchStats(HOST, CREDENTIALS, "/auth/me").catch((e: unknown) => e)

    expect(err).not.toBeInstanceOf(SessionExpiredError)
    expect((err as Error).message).toBe("Tracker API error: 403 Forbidden")
  })

  it("returns both raw payloads for the debug view", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(jsonResponse(ME))
      .mockResolvedValueOnce(jsonResponse(GAME))

    const calls = await adapter.fetchRaw(HOST, CREDENTIALS, "/auth/me")

    expect(calls).toEqual([
      { label: "Me", endpoint: "/auth/me", data: ME, error: null },
      { label: "Gamification", endpoint: "/me/gamification", data: GAME, error: null },
    ])
  })

  it("flags a /auth/me body the poll would fail, and still reads gamification", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(jsonResponse({ ...ME, uploaded: undefined }))
      .mockResolvedValueOnce(jsonResponse(GAME))

    const calls = await adapter.fetchRaw(HOST, CREDENTIALS, "/auth/me")

    expect(calls[0].error).toBe("Unexpected response from api.v3x.club: missing uploaded")
    expect(calls[1]).toMatchObject({ label: "Gamification", data: GAME, error: null })
  })

  it("adds the gamification entry when /auth/me fails", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(statusResponse(500, "Internal Server Error"))
      .mockResolvedValueOnce(jsonResponse(GAME))

    const calls = await adapter.fetchRaw(HOST, CREDENTIALS, "/auth/me")

    expect(calls[0]).toMatchObject({
      label: "Me",
      data: null,
      error: "Tracker API error: 500 Internal Server Error",
    })
    expect(calls[1]).toMatchObject({ label: "Gamification", data: GAME, error: null })
  })
})
