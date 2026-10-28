// src/lib/download-clients/__tests__/transmission-transport.test.ts

import { afterEach, describe, expect, it, vi } from "vitest"
import { SYNC_STORE_MAX_TORRENTS, TRANSMISSION_RESPONSE_MAX_BYTES } from "@/lib/limits"
import {
  getSessionStats,
  getTorrents,
  invalidateSessionId,
  testSession,
} from "../transmission/transport"
import { clearAuthBlocks } from "../transport"
import type { ClientCredentials } from "../types"

const BASE = "http://transmission.local:9091"

const CREDS: ClientCredentials = {
  authMethod: "password",
  username: "admin",
  password: "pass",
  urlPath: "",
}

/** How many 8 MiB chunks it takes to run a body one chunk past the cap. */
const CHUNKS_PAST_CAP = Math.floor(TRANSMISSION_RESPONSE_MAX_BYTES / (8 * 1024 * 1024)) + 1

function ok(args: unknown): Response {
  return new Response(JSON.stringify({ result: "success", arguments: args }), { status: 200 })
}

function conflict(sessionId: string): Response {
  return new Response("", { status: 409, headers: { "X-Transmission-Session-Id": sessionId } })
}

function stubFetch(...responses: Response[]) {
  const fetchMock = vi.fn()
  for (const r of responses) fetchMock.mockResolvedValueOnce(r)
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

function initOf(fetchMock: ReturnType<typeof vi.fn>, call: number): RequestInit {
  return fetchMock.mock.calls[call][1] as RequestInit
}

function headersOf(fetchMock: ReturnType<typeof vi.fn>, call: number): Record<string, string> {
  return initOf(fetchMock, call).headers as Record<string, string>
}

async function rejection(promise: Promise<unknown>): Promise<Error | null> {
  return promise.then(() => null).catch((e: unknown) => (e instanceof Error ? e : null))
}

afterEach(() => {
  vi.unstubAllGlobals()
  invalidateSessionId(BASE)
  invalidateSessionId(`${BASE}/torrents`)
  clearAuthBlocks(BASE)
})

describe("the RPC endpoint", () => {
  it("posts to /transmission/rpc when no URL path is set", async () => {
    const fetchMock = stubFetch(ok({}))
    await testSession(BASE, CREDS)
    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/transmission/rpc`)
  })

  it("lets a URL path replace the default base, as a custom rpc-url needs", async () => {
    const fetchMock = stubFetch(ok({}))
    await testSession(`${BASE}/torrents`, { ...CREDS, urlPath: "/torrents" })
    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/torrents/rpc`)
  })
})

describe("the 409 session handshake", () => {
  it("replays the request once with the id the 409 handed back", async () => {
    const fetchMock = stubFetch(conflict("sid-1"), ok({}))
    await testSession(BASE, CREDS)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(headersOf(fetchMock, 1)["X-Transmission-Session-Id"]).toBe("sid-1")
  })

  it("reuses the id on the next call instead of handshaking again", async () => {
    const fetchMock = stubFetch(conflict("sid-1"), ok({}), ok({}))
    await testSession(BASE, CREDS)
    await testSession(BASE, CREDS)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(headersOf(fetchMock, 2)["X-Transmission-Session-Id"]).toBe("sid-1")
  })

  it("handshakes again when the daemon has rotated the id", async () => {
    const fetchMock = stubFetch(conflict("sid-1"), ok({}), conflict("sid-2"), ok({}))
    await testSession(BASE, CREDS)
    await testSession(BASE, CREDS)
    expect(headersOf(fetchMock, 3)["X-Transmission-Session-Id"]).toBe("sid-2")
  })

  it("does not loop when a second 409 comes back", async () => {
    const fetchMock = stubFetch(conflict("sid-1"), conflict("sid-2"))
    await expect(testSession(BASE, CREDS)).rejects.toThrow(/409/)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("fails when the 409 carries no session id to replay with", async () => {
    stubFetch(new Response("", { status: 409 }))
    await expect(testSession(BASE, CREDS)).rejects.toThrow(/without an X-Transmission-Session-Id/)
  })
})

describe("authentication", () => {
  it("sends HTTP Basic when credentials are set", async () => {
    const fetchMock = stubFetch(ok({}))
    await testSession(BASE, CREDS)
    expect(headersOf(fetchMock, 0).Authorization).toBe(
      `Basic ${Buffer.from("admin:pass").toString("base64")}`
    )
  })

  it("sends no Authorization header when both fields are blank", async () => {
    const fetchMock = stubFetch(ok({}))
    await testSession(BASE, { ...CREDS, username: "", password: "" })
    expect(headersOf(fetchMock, 0).Authorization).toBeUndefined()
  })

  it("refuses an API-key credential without a request", async () => {
    const fetchMock = stubFetch(ok({}))
    await expect(
      testSession(BASE, { authMethod: "apikey", apiKey: "k", urlPath: "" })
    ).rejects.toThrow(/no API-key authentication/)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe("the auth-failure breaker", () => {
  // Anti-brute-force counts every failed login on one global counter and locks
  // every client out at its threshold, so a rejected credential is not resent.
  it("does not send a credential the daemon rejected again", async () => {
    const fetchMock = stubFetch(new Response("", { status: 401 }))
    await expect(testSession(BASE, CREDS)).rejects.toThrow(/rejected the username and password/)
    await expect(testSession(BASE, CREDS)).rejects.toThrow(/rejected the username and password/)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("sends an edited credential", async () => {
    const fetchMock = stubFetch(new Response("", { status: 401 }), ok({}))
    await expect(testSession(BASE, CREDS)).rejects.toThrow()
    await testSession(BASE, { ...CREDS, password: "fixed" })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("reaches the network again once the blocks are cleared", async () => {
    const fetchMock = stubFetch(new Response("", { status: 401 }), ok({}))
    await expect(testSession(BASE, CREDS)).rejects.toThrow()
    clearAuthBlocks(BASE)
    await testSession(BASE, CREDS)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("latches a 401 that answers the replay after a 409", async () => {
    const fetchMock = stubFetch(conflict("sid-1"), new Response("", { status: 401 }))
    await expect(testSession(BASE, CREDS)).rejects.toThrow(/rejected the username and password/)
    await expect(testSession(BASE, CREDS)).rejects.toThrow(/rejected the username and password/)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("names the host whitelist on a 421 and does not latch it", async () => {
    const fetchMock = stubFetch(
      new Response("<h1>421: Misdirected Request</h1>", { status: 421 }),
      new Response("<h1>421: Misdirected Request</h1>", { status: 421 })
    )
    await expect(testSession(BASE, CREDS)).rejects.toThrow(/rpc-host-whitelist/)
    await expect(testSession(BASE, CREDS)).rejects.toThrow(/rpc-host-whitelist/)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("never latches a 403, which a restart or a whitelist change clears", async () => {
    const fetchMock = stubFetch(
      new Response("<h1>403: Forbidden</h1>", { status: 403 }),
      new Response("<h1>403: Forbidden</h1>", { status: 403 })
    )
    await expect(testSession(BASE, CREDS)).rejects.toThrow(/IP whitelist/)
    await expect(testSession(BASE, CREDS)).rejects.toThrow(/IP whitelist/)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe("redirect handling", () => {
  it("refuses a redirect rather than parsing a body from another origin", async () => {
    const fetchMock = stubFetch(
      new Response(null, { status: 307, headers: { Location: "http://attacker.example/rpc" } })
    )
    await expect(testSession(BASE, CREDS)).rejects.toThrow("Transmission RPC error: 307")
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(initOf(fetchMock, 0)).toMatchObject({ redirect: "manual" })
  })
})

describe("connection errors", () => {
  it("names the client by hostname, without the URL path that can carry a proxy key", async () => {
    const cause = Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" })
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed", { cause })))

    const err = await rejection(
      testSession(`${BASE}/proxy/secret-key`, { ...CREDS, urlPath: "/proxy/secret-key" })
    )

    expect(err?.message).toBe("Failed to connect to transmission.local: ECONNREFUSED")
  })

  it("never copies a header-validation TypeError, which quotes the credential", async () => {
    const basic = Buffer.from("admin:pass").toString("base64")
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError(`Headers.append: "Basic ${basic}" is invalid`))
    )
    const err = await rejection(testSession(BASE, CREDS))
    expect(err?.message).not.toContain(basic)
  })

  it("names a timeout as one", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(Object.assign(new Error("aborted"), { name: "TimeoutError" }))
    )
    await expect(testSession(BASE, CREDS)).rejects.toThrow(/timed out/)
  })
})

describe("the caller's deadline", () => {
  it("aborts the torrent-get when the caller's signal aborts", async () => {
    const fetchMock = stubFetch(ok({ torrents: [] }))
    const caller = new AbortController()

    await getTorrents(BASE, CREDS, { signal: caller.signal })

    const sent = initOf(fetchMock, 0).signal as AbortSignal
    expect(sent.aborted).toBe(false)
    caller.abort()
    expect(sent.aborted).toBe(true)
  })
})

describe("the response body cap", () => {
  it("refuses a body that runs past the cap", async () => {
    // One 8 MiB chunk enqueued until the body passes the cap, with only 8 MiB
    // allocated. The refusal fires before the concat.
    const chunk = new Uint8Array(8 * 1024 * 1024)
    const stream = new ReadableStream({
      start(controller) {
        for (let i = 0; i < CHUNKS_PAST_CAP; i++) controller.enqueue(chunk)
        controller.close()
      },
    })
    stubFetch(new Response(stream))

    const err = await rejection(getTorrents(BASE, CREDS))

    expect(err?.message).toBe(
      `Response from transmission.local exceeded ${TRANSMISSION_RESPONSE_MAX_BYTES} bytes and was refused`
    )
  })

  it("fits a full torrent-get of the largest library the sync store holds", () => {
    // torrent-get sends every trackerStats sub-field, so a cap sized for a
    // qBittorrent torrent would refuse a library the store accepts.
    const passkey = "ab".repeat(16)
    const trackerStat = (host: string, id: number) => ({
      announce: `https://${host}/announce/${passkey}`,
      announceState: 0,
      downloadCount: 1234,
      hasAnnounced: true,
      hasScraped: true,
      host: `${host}:443`,
      id,
      isBackup: false,
      lastAnnouncePeerCount: 50,
      lastAnnounceResult: "Success",
      lastAnnounceStartTime: 1729000000,
      lastAnnounceSucceeded: true,
      lastAnnounceTime: 1729000000,
      lastAnnounceTimedOut: false,
      lastScrapeResult: "",
      lastScrapeStartTime: 1729000000,
      lastScrapeSucceeded: true,
      lastScrapeTime: 1729000000,
      lastScrapeTimedOut: false,
      leecherCount: 1,
      nextAnnounceTime: 1729003600,
      nextScrapeTime: 1729001800,
      scrape: `https://${host}/scrape/${passkey}`,
      scrapeState: 1,
      seederCount: 42,
      sitename: "example",
      tier: 0,
    })
    const torrent = {
      hashString: "cd".repeat(20),
      name: "Some.Show.S01.1080p.WEB-DL.DDP5.1.H.264-GROUP",
      status: 6,
      labels: ["tracker", "cross-seed"],
      rateUpload: 0,
      rateDownload: 0,
      uploadedEver: 51964203008,
      downloadedEver: 15032385536,
      uploadRatio: 3.4567,
      sizeWhenDone: 15032385536,
      peersSendingToUs: 0,
      peersGettingFromUs: 0,
      addedDate: 1726000000,
      doneDate: 1726003600,
      activityDate: 1729000000,
      secondsSeeding: 2592000,
      secondsDownloading: 3600,
      leftUntilDone: 0,
      percentDone: 1,
      downloadDir: "/data/torrents/tv",
      isPrivate: true,
      trackerStats: [trackerStat("tracker.example", 0), trackerStat("tracker.example-mirror", 1)],
    }
    const perTorrent = Buffer.byteLength(`${JSON.stringify(torrent)},`)

    expect(SYNC_STORE_MAX_TORRENTS * perTorrent).toBeLessThanOrEqual(
      TRANSMISSION_RESPONSE_MAX_BYTES
    )
  })
})

describe("the RPC envelope", () => {
  it("treats a 200 carrying a failure result as an error, without the host's text", async () => {
    stubFetch(new Response(JSON.stringify({ result: "method name not recognized" })))
    const err = await rejection(testSession(BASE, CREDS))
    expect(err?.message).toBe("Transmission refused the RPC call")
  })

  it("refuses a body that is JSON but not an envelope", async () => {
    stubFetch(new Response(JSON.stringify([{ result: "success" }])))
    await expect(testSession(BASE, CREDS)).rejects.toThrow(/no RPC envelope/)
  })

  it("refuses a success envelope with no arguments", async () => {
    stubFetch(new Response(JSON.stringify({ result: "success" })))
    await expect(testSession(BASE, CREDS)).rejects.toThrow(/returned no arguments/)
  })

  it("names a body that is not JSON, the usual sign of a wrong URL path", async () => {
    stubFetch(new Response("<html>login</html>"))
    await expect(testSession(BASE, CREDS)).rejects.toThrow(/the body was not JSON/)
  })
})

describe("torrent-get", () => {
  it("asks for the declared fields across every torrent by default", async () => {
    const fetchMock = stubFetch(ok({ torrents: [{ hashString: "abc" }] }))
    expect(await getTorrents(BASE, CREDS)).toEqual([{ hashString: "abc" }])
    const body = JSON.parse(initOf(fetchMock, 0).body as string)
    expect(body.method).toBe("torrent-get")
    expect(body.arguments.fields).toContain("trackerStats")
    expect(body.arguments.ids).toBeUndefined()
  })

  it("narrows the request to recently active torrents when asked", async () => {
    const fetchMock = stubFetch(ok({ torrents: [] }))
    await getTorrents(BASE, CREDS, { recentlyActive: true })
    const body = JSON.parse(initOf(fetchMock, 0).body as string)
    expect(body.arguments.ids).toBe("recently-active")
  })

  it("refuses a payload that is not a torrent list", async () => {
    stubFetch(ok({ nothing: true }))
    await expect(getTorrents(BASE, CREDS)).rejects.toThrow(/no torrent list/)
  })
})

describe("session-stats", () => {
  it("reads the global speeds", async () => {
    stubFetch(ok({ uploadSpeed: 500, downloadSpeed: 200 }))
    expect(await getSessionStats(BASE, CREDS)).toEqual({ uploadSpeed: 500, downloadSpeed: 200 })
  })

  it("refuses missing speeds instead of reporting an idle client", async () => {
    stubFetch(ok({}))
    await expect(getSessionStats(BASE, CREDS)).rejects.toThrow(/no transfer speeds/)
  })
})
