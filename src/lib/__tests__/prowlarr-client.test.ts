// src/lib/__tests__/prowlarr-client.test.ts
//
// Fixtures follow the shapes Prowlarr v1 returns, with invented values.

// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest"
import {
  fetchIndexerStats,
  fetchIndexerStatuses,
  fetchIndexers,
  fetchSystemStatus,
  normalizeProwlarrUrl,
  parseIndexerStats,
  parseIndexerStatuses,
  parseIndexers,
  parseSystemStatus,
  parseTestFailures,
  prowlarrUrlError,
  retestIndexer,
  sanitizeProwlarrError,
  scrubTestMessage,
} from "@/lib/prowlarr/client"

const CONN = { url: "http://prowlarr.test:9696", apiKey: "0123456789abcdef0123456789abcdef" }

const INDEXER = {
  id: 12,
  name: "Example Indexer",
  definitionName: "exampleindexer",
  enable: true,
  protocol: "torrent",
  privacy: "private",
  indexerUrls: ["https://example.org/", "https://www.example-mirror.org/"],
  legacyUrls: ["https://old-example.org/"],
  fields: [
    { name: "definitionFile", value: "exampleindexer" },
    { name: "baseUrl", value: "https://www.example.org/" },
    { name: "username", value: "should-not-be-read" },
    { name: "password", value: "********" },
  ],
  tags: [],
}

const STATS = {
  indexers: [
    {
      indexerId: 12,
      indexerName: "Example Indexer",
      averageResponseTime: 420,
      averageGrabResponseTime: 0,
      numberOfQueries: 30,
      numberOfGrabs: 4,
      numberOfRssQueries: 96,
      numberOfAuthQueries: 2,
      numberOfFailedQueries: 3,
      numberOfFailedGrabs: 1,
      numberOfFailedRssQueries: 6,
      numberOfFailedAuthQueries: 0,
    },
  ],
  userAgents: [],
  hosts: [],
}

afterEach(() => {
  vi.unstubAllGlobals()
})

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

describe("parseIndexers", () => {
  it("keeps identity, state and hostnames, and none of the other settings", () => {
    const [parsed] = parseIndexers([INDEXER])
    expect(parsed).toEqual({
      indexerId: 12,
      name: "Example Indexer",
      enabled: true,
      hosts: ["example.org", "example-mirror.org", "old-example.org"],
    })
    expect(JSON.stringify(parsed)).not.toContain("should-not-be-read")
  })

  it("handles a null baseUrl and a disabled indexer", () => {
    const [parsed] = parseIndexers([
      { ...INDEXER, enable: false, fields: [{ name: "baseUrl", value: null }], legacyUrls: [] },
    ])
    expect(parsed.enabled).toBe(false)
    expect(parsed.hosts).toEqual(["example.org", "example-mirror.org"])
  })

  it("skips malformed entries and rejects a non-array body", () => {
    expect(parseIndexers([{ id: "x", name: "Broken" }, null, INDEXER])).toHaveLength(1)
    expect(() => parseIndexers({ records: [] })).toThrow(/unexpected indexer response/)
  })
})

describe("parseIndexerStatuses", () => {
  it("parses dates and drops entries without an indexer id", () => {
    const parsed = parseIndexerStatuses([
      {
        indexerId: 12,
        disabledTill: "2026-05-02T10:00:00Z",
        mostRecentFailure: "2026-05-01T10:00:00Z",
        initialFailure: "2026-04-28T08:30:00Z",
      },
      { disabledTill: "2026-05-02T10:00:00Z" },
    ])
    expect(parsed).toEqual([
      {
        indexerId: 12,
        disabledTill: new Date("2026-05-02T10:00:00Z"),
        mostRecentFailure: new Date("2026-05-01T10:00:00Z"),
        initialFailure: new Date("2026-04-28T08:30:00Z"),
      },
    ])
  })

  it("reads a missing or invalid date as null", () => {
    const [parsed] = parseIndexerStatuses([{ indexerId: 3, disabledTill: "not a date" }])
    expect(parsed.disabledTill).toBeNull()
    expect(parsed.initialFailure).toBeNull()
  })
})

describe("parseIndexerStats", () => {
  it("maps Prowlarr's counters by indexer id", () => {
    expect(parseIndexerStats(STATS).get(12)).toEqual({
      averageResponseTime: 420,
      queries: 30,
      grabs: 4,
      rssQueries: 96,
      authQueries: 2,
      failedQueries: 3,
      failedGrabs: 1,
      failedRssQueries: 6,
      failedAuthQueries: 0,
    })
  })

  it("reads missing or negative counters as zero", () => {
    const stats = parseIndexerStats({ indexers: [{ indexerId: 5, numberOfQueries: -1 }] })
    expect(stats.get(5)?.queries).toBe(0)
    expect(stats.get(5)?.grabs).toBe(0)
  })

  it("rejects a body without an indexers array", () => {
    expect(() => parseIndexerStats([])).toThrow(/unexpected indexer stats response/)
  })
})

describe("parseSystemStatus", () => {
  it("reads the version", () => {
    expect(parseSystemStatus({ appName: "Prowlarr", version: "1.2.3.4567" })).toEqual({
      version: "1.2.3.4567",
    })
    expect(() => parseSystemStatus("nope")).toThrow()
  })
})

describe("prowlarrUrlError and normalizeProwlarrUrl", () => {
  it("allows local and private addresses", () => {
    expect(prowlarrUrlError("http://prowlarr.test:9696")).toBeNull()
    expect(prowlarrUrlError("http://192.168.1.20:9696/prowlarr")).toBeNull()
  })

  it("refuses other schemes, userinfo, queries and garbage", () => {
    expect(prowlarrUrlError("ftp://prowlarr")).toMatch(/http/)
    expect(prowlarrUrlError("http://user:pass@prowlarr.test:9696")).toMatch(/username or password/)
    expect(prowlarrUrlError("http://prowlarr.test:9696/?apikey=x")).toMatch(/query/)
    expect(prowlarrUrlError("http://prowlarr.test:9696/?")).toMatch(/query/)
    expect(prowlarrUrlError("http://prowlarr.test:9696/#")).toMatch(/query/)
    expect(prowlarrUrlError("prowlarr")).toBe("Invalid URL format")
  })

  it("strips trailing slashes so a URL base keeps its path", () => {
    expect(normalizeProwlarrUrl(" http://host.test/prowlarr// ")).toBe("http://host.test/prowlarr")
  })
})

describe("sanitizeProwlarrError", () => {
  it("words this client's own failures", () => {
    expect(sanitizeProwlarrError("Prowlarr API error: 401")).toBe("API key rejected by Prowlarr")
    expect(sanitizeProwlarrError("Prowlarr API error: 302")).toMatch(/redirected/)
    expect(sanitizeProwlarrError("Prowlarr API error: 404")).toMatch(/URL base/)
    expect(sanitizeProwlarrError("Prowlarr API error: 500")).toBe("Prowlarr returned HTTP 500")
    expect(sanitizeProwlarrError("Prowlarr sent a response that is not JSON")).toBe(
      "Prowlarr returned an unexpected response"
    )
  })

  // A rejected or missing key and a wrong URL base are not worded as unreachable.
  it("words only network faults as unreachable, through the shared sanitizer", () => {
    expect(sanitizeProwlarrError("Failed to connect to prowlarr.test: ECONNREFUSED")).toBe(
      "Prowlarr unreachable: Connection refused"
    )
    expect(sanitizeProwlarrError("Request to prowlarr.test timed out")).toBe(
      "Prowlarr unreachable: Request timed out"
    )
    expect(sanitizeProwlarrError("Prowlarr API error: 403")).not.toMatch(/unreachable/)
  })
})

describe("transport", () => {
  it("passes the stats window", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(STATS))
    vi.stubGlobal("fetch", fetchMock)

    const start = new Date("2026-05-01T00:00:00Z")
    const end = new Date("2026-05-02T00:00:00Z")
    await fetchIndexerStats(CONN, start, end)

    const [url] = fetchMock.mock.calls[0] as unknown as [string]
    expect(url).toBe(
      "http://prowlarr.test:9696/api/v1/indexerstats?startDate=2026-05-01T00%3A00%3A00.000Z&endDate=2026-05-02T00%3A00%3A00.000Z"
    )
  })

  it("sends the key as a header, does not follow redirects and sets no User-Agent", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ version: "1.2.3" }))
    vi.stubGlobal("fetch", fetchMock)

    await expect(fetchSystemStatus(CONN)).resolves.toEqual({ version: "1.2.3" })

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("http://prowlarr.test:9696/api/v1/system/status")
    expect(init.redirect).toBe("manual")
    expect(init.signal).toBeInstanceOf(AbortSignal)
    const headers = init.headers as Record<string, string>
    expect(headers["X-Api-Key"]).toBe(CONN.apiKey)
    expect(Object.keys(headers).map((h) => h.toLowerCase())).not.toContain("user-agent")
    expect(url).not.toContain(CONN.apiKey)
  })

  it("keeps a URL base and only ever makes GET requests", async () => {
    const fetchMock = vi.fn(async () => jsonResponse([]))
    vi.stubGlobal("fetch", fetchMock)

    await fetchIndexerStatuses({ ...CONN, url: "http://host.test/prowlarr/" })

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("http://host.test/prowlarr/api/v1/indexerstatus")
    expect(init.method ?? "GET").toBe("GET")
    expect(init.body).toBeUndefined()
  })

  it("turns an HTTP error into a status the sanitizer understands", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Unauthorized", { status: 401 }))
    )
    await expect(fetchIndexers(CONN)).rejects.toThrow("Prowlarr API error: 401")
  })

  it("rejects a body that is not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>login</html>", { status: 200 }))
    )
    await expect(fetchIndexers(CONN)).rejects.toThrow(/not JSON/)
  })

  it("names the host, never the URL or key, when the connection fails", async () => {
    const refused = Object.assign(new TypeError("fetch failed"), {
      cause: Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }),
    })
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw refused
      })
    )
    const err = await fetchIndexers(CONN).catch((e: Error) => e)
    expect((err as Error).message).toBe("Failed to connect to prowlarr.test: ECONNREFUSED")
  })
})

describe("retestIndexer", () => {
  it("sends Prowlarr's own definition back to the test endpoint", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(INDEXER))
      .mockResolvedValueOnce(jsonResponse({}))
    vi.stubGlobal("fetch", fetchMock)

    await expect(retestIndexer(CONN, 12)).resolves.toEqual({ ok: true })

    const [getUrl, getInit] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(getUrl).toBe("http://prowlarr.test:9696/api/v1/indexer/12")
    expect(getInit.method).toBe("GET")
    const [testUrl, testInit] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(testUrl).toBe("http://prowlarr.test:9696/api/v1/indexer/test")
    expect(testInit.method).toBe("POST")
    expect(testInit.redirect).toBe("manual")
    expect(JSON.parse(testInit.body as string)).toEqual(INDEXER)
    expect((testInit.headers as Record<string, string>)["Content-Type"]).toBe("application/json")
  })

  it("returns a failed test's reasons, never the values it echoes", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(INDEXER))
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify([
              {
                propertyName: "",
                errorMessage: "Unable to connect to indexer",
                attemptedValue: "secret-cookie",
                severity: "error",
              },
            ]),
            { status: 400 }
          )
        )
    )

    const out = await retestIndexer(CONN, 12)

    expect(out).toEqual({ failures: ["Unable to connect to indexer"] })
    expect(JSON.stringify(out)).not.toContain("secret-cookie")
  })

  // HttpException messages include the request URL, which carries the API key
  // for UNIT3D and Torznab indexers.
  it("cuts every URL in a failure message down to its host", () => {
    const failures = parseTestFailures([
      {
        errorMessage:
          "Unable to connect: HTTP request failed: [500:InternalServerError] [GET] at [https://tracker.example.org/api/torrents/filter?api_token=SECRET123&name=x]",
      },
    ])
    expect(failures).toEqual([
      "Unable to connect: HTTP request failed: [500:InternalServerError] [GET] at [tracker.example.org]",
    ])
    expect(JSON.stringify(failures)).not.toContain("SECRET123")
  })

  it("throws a status the sanitizer understands for other errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(INDEXER))
        .mockResolvedValueOnce(new Response("", { status: 500 }))
    )
    await expect(retestIndexer(CONN, 12)).rejects.toThrow("Prowlarr API error: 500")
  })
})

describe("scrubTestMessage", () => {
  it("keeps a message without URLs and caps its length", () => {
    expect(scrubTestMessage("Invalid credentials")).toBe("Invalid credentials")
    expect(scrubTestMessage("x".repeat(5000))).toHaveLength(1000)
  })

  it("replaces a URL it cannot parse", () => {
    expect(scrubTestMessage("at http://[bad/apikey=1")).toBe("at [URL]")
  })
})
