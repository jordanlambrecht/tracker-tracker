// src/lib/tracker-platforms/__tests__/v3x.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"
import { parseV3xMe, V3xAdapter } from "../adapters/v3x"

// Synthetic fixture shaped like the /api/me fields the wiki lists. No real account data.
const ME = {
  username: "testuser",
  id: 4242,
  role: "power_user",
  createdAt: "2026-09-05T13:57:58.012Z",
  lastLoginAt: "2026-10-20T08:00:00.000Z",
  lastVisitDay: "2026-10-25",
  uploaded: 186064294312,
  downloaded: 74273761201,
  buffer: 111790533111,
  downloadedReal: 73200019377,
  ratio: 2.505114744471765,
  bonusPoints: 18591,
  pointsPerHour: 42.5,
  seeding: 13,
  leeching: 0,
  seedTimeSeconds: 37339256,
  freeleechTokens: 1,
  freeleech: false,
  freeleechUntil: null,
  globalFreeleech: false,
  globalFreeleechUntil: null,
  level: 14,
  xp: 28020,
  nextLevelXp: 32268,
  prestige: 0,
  hitAndRun: 1,
  hitAndRunMax: 3,
  hitAndRunExempt: false,
  ratioFloor: { floor: 0.5, warnAt: 0.7, level: "ok" },
  warnings: 0,
  invitesLeft: 2,
}

const CANARY = "CANARYv3x5e8d2b7f4a"

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
  it("maps the profile into TrackerStats", () => {
    const stats = parseV3xMe(ME)

    expect(stats).toMatchObject({
      username: "testuser",
      group: "Second rôle N14",
      uploadedBytes: 186064294312n,
      downloadedBytes: 74273761201n,
      bufferBytes: 111790533111n,
      seedingCount: 13,
      leechingCount: 0,
      seedbonus: 18591,
      hitAndRuns: 1,
      requiredRatio: 0.5,
      warned: false,
      freeleechTokens: 1,
      remoteUserId: 4242,
      joinedDate: "2026-09-05T13:57:58.012Z",
      lastAccessDate: "2026-10-25",
      platformMeta: {
        freeleechDownloadedBytes: 0,
        invites: 2,
        globalFreeleech: false,
        level: 14,
        xp: 28020,
        prestige: 0,
      },
    })
    expect(stats.ratio).toBeCloseTo(2.505114744471765, 10)
  })

  it.each([
    [1, "Figurant N1"],
    [9, "Figurant N9"],
    [10, "Second rôle N10"],
    [25, "Tête d'affiche N25"],
    [45, "Réalisateur N45"],
    [70, "Palme d'Or N70"],
    [100, "Palme d'Or N100"],
  ])("names level %i %s", (level, rank) => {
    expect(parseV3xMe({ ...ME, level }).group).toBe(rank)
  })

  it.each([undefined, 0, 2.5, 101])("leaves the class empty for level %s", (level) => {
    expect(parseV3xMe({ ...ME, level }).group).toBeNull()
  })

  it("counts the real download above the counted one as freeleech", () => {
    const stats = parseV3xMe({ ...ME, downloaded: 1000, downloadedReal: 1500 })

    expect(stats.platformMeta).toMatchObject({ freeleechDownloadedBytes: 500 })
  })

  it.each([
    [2, true],
    [[{ id: 1 }], true],
    [[], false],
    [undefined, null],
  ])("reads warnings %j as warned %s", (warnings, warned) => {
    expect(parseV3xMe({ ...ME, warnings: warnings as number }).warned).toBe(warned)
  })

  it("keeps the end of a running global freeleech", () => {
    const stats = parseV3xMe({
      ...ME,
      globalFreeleech: true,
      globalFreeleechUntil: "2026-11-01T00:00:00.000Z",
    })

    expect(stats.platformMeta).toMatchObject({
      globalFreeleech: true,
      globalFreeleechEndsAt: "2026-11-01T00:00:00.000Z",
    })
  })

  it("falls back to the last login without a last visit day", () => {
    expect(parseV3xMe({ ...ME, lastVisitDay: null }).lastAccessDate).toBe(
      "2026-10-20T08:00:00.000Z"
    )
  })

  it.each(["uploaded", "downloaded"])("fails when %s is missing", (field) => {
    expect(() => parseV3xMe({ ...ME, [field]: undefined })).toThrow(
      `Unexpected response from api.v3x.club: missing ${field}`
    )
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

  it("reads /api/me once with the key as a Bearer token", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(jsonResponse(ME))

    const stats = await adapter.fetchStats("https://v3x.club", CANARY, "/auth/me")

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0]
    const headers = init?.headers as Record<string, string>
    expect(String(url)).toBe("https://api.v3x.club/api/me")
    expect(headers.Authorization).toBe(`Bearer ${CANARY}`)
    expect(headers.Cookie).toBeUndefined()
    expect(stats.uploadedBytes).toBe(186064294312n)
  })

  it("says a 401 means the key was refused", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(statusResponse(401, "Unauthorized"))

    await expect(adapter.fetchStats("https://v3x.club", CANARY, "/api/me")).rejects.toThrow(
      "V3X refused the API key"
    )
  })

  it("fails a 429 as an ordinary error", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(statusResponse(429, "Too Many Requests"))

    await expect(adapter.fetchStats("https://v3x.club", CANARY, "/api/me")).rejects.toThrow(
      "Tracker API error: 429 Too Many Requests"
    )
  })

  it("returns the raw profile for the debug view", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(jsonResponse(ME))

    const calls = await adapter.fetchRaw("https://v3x.club", CANARY, "/api/me")

    expect(calls).toEqual([{ label: "Profile", endpoint: "/api/me", data: ME, error: null }])
  })

  it("flags a profile the poll would fail", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(jsonResponse({ ...ME, uploaded: undefined }))

    const calls = await adapter.fetchRaw("https://v3x.club", CANARY, "/api/me")

    expect(calls[0].error).toBe("Unexpected response from api.v3x.club: missing uploaded")
  })
})
