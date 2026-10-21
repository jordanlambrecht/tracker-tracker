// src/lib/tracker-platforms/__tests__/v3x.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"
import { parseV3xMe, V3xAdapter } from "../adapters/v3x"
import type { V3xPlatformMeta } from "../contract"

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
    text: async () => JSON.stringify(body),
  }) as unknown as Response

describe("parseV3xMe", () => {
  it("maps the API payload into TrackerStats", () => {
    const stats = parseV3xMe(ME, "v3x.club")
    const meta = stats.platformMeta as V3xPlatformMeta

    expect(stats.username).toBe("testuser")
    expect(stats.group).toBe("Power User")
    expect(stats.uploadedBytes).toBe(186064294312n)
    expect(stats.downloadedBytes).toBe(74273761201n)
    expect(stats.ratio).toBe(2.505114744471765)
    expect(stats.bufferBytes).toBe(111790533111n)
    expect(stats.seedbonus).toBe(18591)
    expect(stats.hitAndRuns).toBe(1)
    expect(stats.requiredRatio).toBe(0.5)
    expect(stats.freeleechTokens).toBe(0)
    expect(stats.joinedDate).toBe("2026-09-05")
    expect(meta.ratioFloor).toBe(0.5)
    expect(meta.ratioWarnAt).toBe(0.7)
    expect(meta.ratioLevel).toBe("ok")
    expect(meta.hnrMax).toBe(3)
    expect(meta.seedTimeSeconds).toBe(37339256)
    expect(meta.downloadedReal).toBe(73200019377)
  })

  it("fails when a byte total is missing", () => {
    expect(() => parseV3xMe({ ...ME, uploaded: undefined }, "v3x.club")).toThrow(/missing uploaded/)
  })
})

describe("V3xAdapter", () => {
  const adapter = new V3xAdapter()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("reads /auth/me and merges the gamification rank", async () => {
    let capturedInit: RequestInit | undefined
    vi.spyOn(global, "fetch")
      .mockImplementationOnce((_url, init) => {
        capturedInit = init
        return Promise.resolve(jsonResponse(ME))
      })
      .mockResolvedValueOnce(jsonResponse(GAME))

    const stats = await adapter.fetchStats(HOST, CREDENTIALS, "/auth/me")
    const headers = capturedInit?.headers as Record<string, string> | undefined
    const meta = stats.platformMeta as V3xPlatformMeta

    expect(stats.uploadedBytes).toBe(186064294312n)
    expect(stats.group).toBe("Second rôle")
    expect(meta.level).toBe(14)
    expect(meta.xp).toBe(28020)
    expect(meta.xpInto).toBe(4100)
    expect(meta.xpNeed).toBe(4248)
    expect(meta.loginStreak).toBe(20)
    expect(meta.seedStreak).toBe(37)
    expect(headers?.Cookie).toBe("v3x_session=abc")
    expect(headers?.["User-Agent"]).toBe("Mozilla/5.0")
    expect(headers?.Accept).toBe("application/json")
  })

  it("keeps the role when gamification is unavailable", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(jsonResponse(ME))
      .mockRejectedValueOnce(new TypeError("fetch failed"))

    const stats = await adapter.fetchStats(HOST, CREDENTIALS, "/auth/me")

    expect(stats.group).toBe("Power User")
    expect((stats.platformMeta as V3xPlatformMeta).level).toBeUndefined()
  })

  it("turns a 401 into a session-expired error", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      headers: { get: () => null },
      text: async () => "",
    } as unknown as Response)

    await expect(adapter.fetchStats(HOST, CREDENTIALS, "/auth/me")).rejects.toThrow(
      /Session expired/
    )
  })

  it("returns both raw payloads for the debug view", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(jsonResponse(ME))
      .mockResolvedValueOnce(jsonResponse(GAME))

    const calls = await adapter.fetchRaw(HOST, CREDENTIALS, "/auth/me")

    expect(calls).toHaveLength(2)
    expect(calls[0].label).toBe("Me")
    expect(calls[0].endpoint).toBe("/auth/me")
    expect(calls[0].error).toBeNull()
    expect(calls[0].data).toEqual(ME)
    expect(calls[1].label).toBe("Gamification")
    expect(calls[1].endpoint).toBe("/me/gamification")
    expect(calls[1].error).toBeNull()
    expect(calls[1].data).toEqual(GAME)
  })
})
