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

  it("constructs the URL correctly and keeps the token out of the query string", async () => {
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
    // Bearer is now the default, so the token must not appear in the URL,
    // query strings leak into access logs and Referer headers.
    expect(calledUrl).not.toContain("api_token")
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

  // AbortSignal timeout coverage is in adapterFetch, tested via timeout-message test above

  it("derives bufferBytes from totals when the build reports an unlimited buffer", async () => {
    // Zenith's UNIT3D build returns "∞" for buffer; parseBytes rejects that,
    // so the adapter falls back to uploaded - downloaded rather than
    // reporting a confident 0 B.
    for (const infinite of ["∞", "-∞", "Inf", "inf"]) {
      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          username: "ZenithUser",
          group: "User",
          uploaded: "100 GiB",
          downloaded: "40 GiB",
          ratio: "2.5",
          buffer: infinite,
          seeding: 10,
          leeching: 0,
          seedbonus: "0",
          hit_and_runs: 0,
        }),
      } as Response)

      const stats = await adapter.fetchStats("https://znth.cx", "fake-token", "/api/user")
      expect(stats.bufferBytes).toBe(stats.uploadedBytes - stats.downloadedBytes)
      expect(stats.bufferBytes).toBeGreaterThan(BigInt(0))
    }
  })

  // A build that reports a deficit buffer as a negative string used to throw out
  // of parseBytes and fail the ENTIRE poll, the account recorded no snapshot at
  // all, losing uploaded, downloaded and ratio along with the buffer.
  it("records a negative tracker-reported buffer instead of failing the poll", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        username: "DeficitUser",
        group: "User",
        uploaded: "10 GiB",
        downloaded: "1.24 TiB",
        ratio: "0.01",
        buffer: "-1.23 TiB",
        seeding: 5,
        leeching: 1,
        seedbonus: "100.00",
        hit_and_runs: 0,
      }),
    } as Response)

    const stats = await adapter.fetchStats("https://aither.cc", "fake-token", "/api/user")

    expect(stats.bufferBytes).toBe(BigInt(-1_352_399_302_164))
    expect(stats.bufferBytes).toBeLessThan(BigInt(0))
    // The rest of the poll survives, that was the real cost of the throw.
    expect(stats.username).toBe("DeficitUser")
    expect(stats.seedingCount).toBe(5)
  })

  it("sends a Bearer header by default and no api_token query param", async () => {
    let capturedUrl: string | undefined
    let capturedInit: RequestInit | undefined
    vi.spyOn(global, "fetch").mockImplementationOnce((url, init) => {
      capturedUrl = String(url)
      capturedInit = init
      return Promise.resolve({
        ok: true,
        json: async () => ({
          username: "u",
          group: "g",
          uploaded: "1 GiB",
          downloaded: "1 GiB",
          ratio: "1",
          buffer: "0 B",
          seeding: 0,
          leeching: 0,
          seedbonus: "0",
          hit_and_runs: 0,
        }),
      } as Response)
    })

    await adapter.fetchStats("https://aither.cc", "secret-token", "/api/user")

    const headers = capturedInit?.headers as Record<string, string> | undefined
    expect(headers?.Authorization).toBe("Bearer secret-token")
    expect(capturedUrl).not.toContain("api_token")
  })

  it("falls back to the legacy query param when a tracker opts into query auth", async () => {
    let capturedUrl: string | undefined
    let capturedInit: RequestInit | undefined
    vi.spyOn(global, "fetch").mockImplementationOnce((url, init) => {
      capturedUrl = String(url)
      capturedInit = init
      return Promise.resolve({
        ok: true,
        json: async () => ({
          username: "u",
          group: "g",
          uploaded: "1 GiB",
          downloaded: "1 GiB",
          ratio: "1",
          buffer: "0 B",
          seeding: 0,
          leeching: 0,
          seedbonus: "0",
          hit_and_runs: 0,
        }),
      } as Response)
    })

    await adapter.fetchStats("https://aither.cc", "secret-token", "/api/user", {
      unit3dAuthStyle: "query",
    })

    expect(capturedUrl).toContain("api_token=secret-token")
    const headers = capturedInit?.headers as Record<string, string> | undefined
    expect(headers?.Authorization).toBeUndefined()
  })
})

describe("Unit3dAdapter - auth fallback", () => {
  const adapter = new Unit3dAdapter()

  beforeEach(() => {
    vi.restoreAllMocks()
    ;(
      globalThis as { __unit3dAuthStyleCache?: Map<string, string> }
    ).__unit3dAuthStyleCache?.clear()
  })

  const okBody = () =>
    ({
      ok: true,
      json: async () => ({
        username: "u",
        group: "g",
        uploaded: "1 GiB",
        downloaded: "1 GiB",
        ratio: "1",
        buffer: "0 B",
        seeding: 0,
        leeching: 0,
        seedbonus: "0",
        hit_and_runs: 0,
      }),
    }) as Response
  const unauthorized = () => ({ ok: false, status: 401, statusText: "Unauthorized" }) as Response

  it("falls back to the api_token query param when bearer is rejected", async () => {
    const spy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(unauthorized())
      .mockResolvedValueOnce(okBody())

    const stats = await adapter.fetchStats("https://old.example", "tok", "/api/user")
    expect(stats.username).toBe("u")
    expect(spy).toHaveBeenCalledTimes(2)
    expect(String(spy.mock.calls[0][0])).not.toContain("api_token")
    expect(String(spy.mock.calls[1][0])).toContain("api_token=tok")
  })

  it("remembers the working style so later polls only make one request", async () => {
    const spy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(unauthorized())
      .mockResolvedValueOnce(okBody())
      .mockResolvedValueOnce(okBody())

    await adapter.fetchStats("https://old.example", "tok", "/api/user")
    await adapter.fetchStats("https://old.example", "tok", "/api/user")

    // 2 for the first (probe + fallback), 1 for the second, not 4.
    expect(spy).toHaveBeenCalledTimes(3)
    expect(String(spy.mock.calls[2][0])).toContain("api_token=tok")
  })

  it("does NOT fall back on a non-auth failure", async () => {
    const spy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce({ ok: false, status: 500, statusText: "Server Error" } as Response)

    await expect(adapter.fetchStats("https://broken.example", "tok", "/api/user")).rejects.toThrow()
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it("never probes when a tracker pins its auth style", async () => {
    const spy = vi.spyOn(global, "fetch").mockResolvedValueOnce(unauthorized())

    await expect(
      adapter.fetchStats("https://pinned.example", "tok", "/api/user", {
        unit3dAuthStyle: "bearer",
      })
    ).rejects.toThrow()
    expect(spy).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// Newer UNIT3D builds (Blutopia, Upload.cx) return raw byte INTEGERS from
// /api/user instead of the humanized strings ("500.25 GiB") older builds send.
// parseBytes calls .trim() on its argument, so a numeric payload used to blow
// up the whole poll with "formatted.trim is not a function", the raw debug
// fetch succeeded while the normalized one never produced a snapshot.
// ---------------------------------------------------------------------------
describe("Unit3dAdapter - numeric byte payloads", () => {
  const adapter = new Unit3dAdapter()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("parses a build that reports bytes as numbers", async () => {
    // Verbatim from a live Blutopia /api/user response.
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        username: "thesneakyrobot",
        group: "BluSeeder",
        uploaded: 2114704480460,
        downloaded: 1041023858647,
        ratio: 2.03,
        buffer: 4245737342503,
        seeding: 600,
        leeching: 0,
        seedbonus: "964533.23",
        hit_and_runs: 0,
      }),
    } as Response)

    const stats = await adapter.fetchStats("https://blutopia.cc", "fake-token", "/api/user")

    expect(stats.username).toBe("thesneakyrobot")
    expect(stats.group).toBe("BluSeeder")
    expect(stats.uploadedBytes).toBe(BigInt(2_114_704_480_460))
    expect(stats.downloadedBytes).toBe(BigInt(1_041_023_858_647))
    expect(stats.bufferBytes).toBe(BigInt(4_245_737_342_503))
    expect(stats.ratio).toBeCloseTo(2.031, 3)
    expect(stats.seedingCount).toBe(600)
    expect(stats.leechingCount).toBe(0)
    expect(stats.seedbonus).toBe(964533.23)
    expect(stats.hitAndRuns).toBe(0)
  })

  it("keeps the sign on a numeric deficit buffer", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        username: "DeficitUser",
        group: "User",
        uploaded: 10_737_418_240,
        downloaded: 1_362_999_349_248,
        ratio: 0.01,
        buffer: -1_352_399_302_164,
        seeding: 5,
        leeching: 1,
        seedbonus: 100,
        hit_and_runs: 0,
      }),
    } as Response)

    const stats = await adapter.fetchStats("https://blutopia.cc", "fake-token", "/api/user")

    expect(stats.bufferBytes).toBe(BigInt(-1_352_399_302_164))
    expect(stats.seedbonus).toBe(100)
    // The rest of the poll survives alongside it.
    expect(stats.username).toBe("DeficitUser")
    expect(stats.seedingCount).toBe(5)
  })

  it("clamps a nonsensical negative uploaded/downloaded rather than failing the poll", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        username: "OddUser",
        group: "User",
        uploaded: -1,
        downloaded: -1,
        ratio: 0,
        buffer: 0,
        seeding: 0,
        leeching: 0,
        seedbonus: 0,
        hit_and_runs: 0,
      }),
    } as Response)

    const stats = await adapter.fetchStats("https://blutopia.cc", "fake-token", "/api/user")

    expect(stats.uploadedBytes).toBe(BigInt(0))
    expect(stats.downloadedBytes).toBe(BigInt(0))
  })
})

// ---------------------------------------------------------------------------
// Issue #214: LST began answering /api/user with a 2xx JSON body that no
// longer carries the byte fields at the top level. parseBytes(undefined) then
// died with "Cannot read properties of undefined (reading 'trim')", which the
// test dialog and the poll log both flattened to a generic failure. The
// adapter must say what it was given instead: which fields are missing and
// which top-level keys arrived. Keys only, a value could be a username.
// ---------------------------------------------------------------------------
describe("Unit3dAdapter - unexpected response shape", () => {
  const adapter = new Unit3dAdapter()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  function respond(body: unknown) {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => body,
    } as Response)
  }

  const VALID_BODY = {
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

  it("names every missing byte field when the body is an empty object", async () => {
    respond({})

    await expect(adapter.fetchStats("https://lst.gg", "tok", "/api/user")).rejects.toThrow(
      'Unexpected response from lst.gg: missing "uploaded", "downloaded", "buffer"'
    )
  })

  it("names only the field that is actually missing, keys only", async () => {
    const { buffer: _omitted, ...withoutBuffer } = VALID_BODY
    respond(withoutBuffer)

    const err = await adapter.fetchStats("https://lst.gg", "tok", "/api/user").then(
      () => null,
      (e: unknown) => e as Error
    )

    expect(err?.message).toContain('missing "buffer";')
    expect(err?.message).toContain("top-level keys: username, group, uploaded")
    expect(err?.message).not.toContain("JohnDoe")
    expect(err?.message).not.toContain("500.25")
  })

  it("treats an explicit JSON null as missing, not present", async () => {
    // Eloquent returns null for an attribute a fork dropped, and
    // parseSignedBytes(null) is the same crash as undefined.
    respond({ ...VALID_BODY, buffer: null })

    await expect(adapter.fetchStats("https://lst.gg", "tok", "/api/user")).rejects.toThrow(
      'missing "buffer";'
    )
  })

  it("unwraps a Laravel data envelope around an otherwise valid body", async () => {
    // Laravel wraps a JsonResource in {"data": ...} unless the controller opts
    // out. Stock UNIT3D opts out; a fork that forgets to is still readable.
    respond({ data: VALID_BODY })

    const stats = await adapter.fetchStats("https://lst.gg", "tok", "/api/user")

    expect(stats.username).toBe("JohnDoe")
    expect(stats.seedingCount).toBe(156)
    expect(stats.uploadedBytes).toBeGreaterThan(BigInt(0))
  })

  it("names the envelope and its inner keys when the wrapped body is unreadable too", async () => {
    respond({ data: { username: "JohnDoe", upload: "500.25 GiB" } })

    const err = await adapter.fetchStats("https://lst.gg", "tok", "/api/user").then(
      () => null,
      (e: unknown) => e as Error
    )

    expect(err?.message).toContain('missing "uploaded", "downloaded", "buffer"')
    expect(err?.message).toContain("top-level keys: data")
    expect(err?.message).toContain("data keys: username, upload")
    expect(err?.message).not.toContain("JohnDoe")
    expect(err?.message).not.toContain("500.25")
  })

  it("says so when the body is not a JSON object at all", async () => {
    respond(null)

    await expect(adapter.fetchStats("https://lst.gg", "tok", "/api/user")).rejects.toThrow(
      "Unexpected response from lst.gg: expected a JSON object, got null"
    )
  })

  it("distinguishes an array body from an object", async () => {
    respond([VALID_BODY])

    await expect(adapter.fetchStats("https://lst.gg", "tok", "/api/user")).rejects.toThrow(
      "Unexpected response from lst.gg: expected a JSON object, got array"
    )
  })

  it("still tolerates a body that only lacks the optional fields", async () => {
    // seeding/leeching/hit_and_runs/seedbonus absent is a degraded poll, not a
    // failed one. Only the fields whose absence used to crash are required.
    const { seeding: _s, leeching: _l, hit_and_runs: _h, seedbonus: _b, ...bare } = VALID_BODY
    respond(bare)

    const stats = await adapter.fetchStats("https://lst.gg", "tok", "/api/user")

    expect(stats.username).toBe("JohnDoe")
    expect(stats.uploadedBytes).toBeGreaterThan(BigInt(0))
  })
})

// ---------------------------------------------------------------------------
// Issue #214: LST's live /api/user response, verbatim. The user resource sits
// under a Laravel "data" envelope next to an api_key object, which is what
// broke polling on 2026-08-28; the adapter reads through the envelope.
// ---------------------------------------------------------------------------
describe("Unit3dAdapter - LST envelope (issue #214)", () => {
  const adapter = new Unit3dAdapter()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("parses LST's enveloped response", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          username: "thesneakyrobot",
          group: "Dolphin",
          uploaded: "13.14 TiB",
          downloaded: "0.95 TiB",
          ratio: "13.82",
          buffer: "31.89 TiB",
          seeding: 520,
          leeching: 1,
          seedbonus: "11143808.20",
          hit_and_runs: 6,
        },
        api_key: { expires_at: "2027-01-01T00:00:00+00:00" },
      }),
    } as Response)

    const stats = await adapter.fetchStats("https://lst.gg", "fake-token", "/api/user")

    expect(stats.username).toBe("thesneakyrobot")
    expect(stats.group).toBe("Dolphin")
    // 13.14 TiB = 1314 * 1024^4 / 100, rounded half-up by parseBytes
    expect(stats.uploadedBytes).toBe(BigInt(14_447_582_788_977))
    expect(stats.downloadedBytes).toBe(BigInt(1_044_536_046_387))
    expect(stats.bufferBytes).toBe(BigInt(35_063_425_809_777))
    expect(stats.ratio).toBeCloseTo(13.83, 2)
    expect(stats.seedingCount).toBe(520)
    expect(stats.leechingCount).toBe(1)
    expect(stats.seedbonus).toBe(11143808.2)
    expect(stats.hitAndRuns).toBe(6)
    expect(stats.platformMeta).toEqual({ apiKeyExpiresAt: "2027-01-01T00:00:00+00:00" })
  })

  function respond(body: unknown) {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => body,
    } as Response)
  }

  const USER = {
    username: "thesneakyrobot",
    group: "Dolphin",
    uploaded: "13.14 TiB",
    downloaded: "0.95 TiB",
    ratio: "13.82",
    buffer: "31.89 TiB",
    seeding: 520,
    leeching: 1,
    seedbonus: "11143808.20",
    hit_and_runs: 6,
  }

  it("records an empty platformMeta for a non-expiring key, so a stale expiry clears", async () => {
    respond({ data: USER, api_key: { expires_at: null } })

    const stats = await adapter.fetchStats("https://lst.gg", "fake-token", "/api/user")

    expect(stats.platformMeta).toEqual({})
    // The scheduler writes platformMeta only when it is truthy, so an object
    // is what lets a later poll overwrite a previously stored expiry, and it
    // must serialize to an empty object rather than {"apiKeyExpiresAt":null}.
    expect(stats.platformMeta).toBeTruthy()
    expect(JSON.stringify(stats.platformMeta)).toBe("{}")
  })

  it("ignores an expiry that is not a date", async () => {
    respond({ data: USER, api_key: { expires_at: "soon" } })

    const stats = await adapter.fetchStats("https://lst.gg", "fake-token", "/api/user")

    expect(stats.platformMeta).toEqual({})
  })

  it("reads api_key.expires_at from a flat body too", async () => {
    respond({ ...USER, api_key: { expires_at: "2026-12-31T00:00:00+00:00" } })

    const stats = await adapter.fetchStats("https://lst.gg", "fake-token", "/api/user")

    expect(stats.platformMeta).toEqual({ apiKeyExpiresAt: "2026-12-31T00:00:00+00:00" })
  })

  it("records an empty platformMeta for a stock flat body", async () => {
    respond(USER)

    const stats = await adapter.fetchStats("https://lst.gg", "fake-token", "/api/user")

    expect(stats.platformMeta).toEqual({})
  })
})
