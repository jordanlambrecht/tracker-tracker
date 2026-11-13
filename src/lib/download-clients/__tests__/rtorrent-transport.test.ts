// src/lib/download-clients/__tests__/rtorrent-transport.test.ts

import { afterEach, describe, expect, it, vi } from "vitest"
import { isUnreachableMessage, sanitizeNetworkError } from "@/lib/error-utils"
import { RTORRENT_RESPONSE_MAX_BYTES } from "@/lib/limits"
import { log } from "@/lib/logger"
import { getTorrents, getTransferStats, testClient } from "../rtorrent/transport"
import { RTORRENT_FIELDS } from "../rtorrent/types"
import { clearAuthBlocks, isResponseTooLarge } from "../transport"
import type { ClientCredentials } from "../types"

const BASE = "http://seedbox.local:80"

const CREDS: ClientCredentials = {
  authMethod: "password",
  username: "alice",
  password: "pass",
  urlPath: "",
  credentialKey: "password:enc-alice:enc-pass",
}

const PRIVATE_HASH = "AAAA000000000000000000000000000000000001"
const PUBLIC_HASH = "BBBB000000000000000000000000000000000002"

type V = string | number | boolean | V[] | { [k: string]: V }

function enc(v: V): string {
  if (typeof v === "string") return `<value><string>${v}</string></value>`
  if (typeof v === "number") return `<value><i8>${v}</i8></value>`
  if (typeof v === "boolean") return `<value><boolean>${v ? 1 : 0}</boolean></value>`
  if (Array.isArray(v)) return `<value><array><data>${v.map(enc).join("")}</data></array></value>`
  const members = Object.entries(v)
    .map(([k, x]) => `<member><name>${k}</name>${enc(x)}</member>`)
    .join("")
  return `<value><struct>${members}</struct></value>`
}

function ok(value: V): Response {
  return new Response(
    `<?xml version="1.0"?><methodResponse><params><param>${enc(value)}</param></params></methodResponse>`,
    { status: 200, headers: { "Content-Type": "text/xml" } }
  )
}

function faultResponse(code: number, message: string): Response {
  return new Response(
    `<?xml version="1.0"?><methodResponse><fault>${enc({ faultCode: code, faultString: message })}</fault></methodResponse>`,
    { status: 200 }
  )
}

/** A d.multicall2 row in RTORRENT_FIELDS order. */
function row(hash: string, isPrivate: 0 | 1): V[] {
  return [
    hash,
    "Ada.Lovelace.Notes.2026",
    "sonarr",
    1, // state
    1, // is_active
    1, // is_open
    1, // complete
    0, // hashing
    2048, // up.rate
    0, // down.rate
    5000, // up.total
    4000, // down.total
    1250, // ratio
    4000, // size_bytes
    0, // left_bytes
    4000, // completed_bytes
    3, // peers_complete
    5, // peers_accounted
    1700000000, // timestamp.started
    1700000100, // timestamp.finished
    "1699999000", // custom=addtime
    "/home/alice/files/Ada.Lovelace.Notes.2026",
    "/home/alice/files/Ada.Lovelace.Notes.2026",
    1, // is_multi_file
    isPrivate,
  ]
}

const TRACKER_ROWS: V[] = [
  ["https://tracker.example.org/0123456789abcdef/announce", 0, 1, 40, 2],
]

const CHUNKS_PAST_CAP = Math.floor(RTORRENT_RESPONSE_MAX_BYTES / (8 * 1024 * 1024)) + 1

function oversized(): Response {
  const chunk = new Uint8Array(8 * 1024 * 1024)
  const stream = new ReadableStream({
    start(controller) {
      for (let i = 0; i < CHUNKS_PAST_CAP; i++) controller.enqueue(chunk)
      controller.close()
    },
  })
  return new Response(stream)
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

function bodyOf(fetchMock: ReturnType<typeof vi.fn>, call: number): string {
  return initOf(fetchMock, call).body as string
}

async function rejection(promise: Promise<unknown>): Promise<Error | null> {
  return promise.then(() => null).catch((e: unknown) => (e instanceof Error ? e : null))
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  clearAuthBlocks(BASE)
  clearAuthBlocks(`${BASE}/xmlrpc`)
})

describe("the XML-RPC endpoint", () => {
  it("posts to /RPC2 when urlPath is empty", async () => {
    const fetchMock = stubFetch(ok("0.9.8"))
    await testClient(BASE, CREDS)
    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/RPC2`)
    expect(headersOf(fetchMock, 0)["Content-Type"]).toBe("text/xml")
    expect(bodyOf(fetchMock, 0)).toContain("<methodName>system.client_version</methodName>")
  })

  it("posts to baseUrl when urlPath is set", async () => {
    const fetchMock = stubFetch(ok("0.9.8"))
    await testClient(`${BASE}/xmlrpc`, { ...CREDS, urlPath: "/xmlrpc" })
    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/xmlrpc`)
  })

  it("does not follow redirects", async () => {
    const fetchMock = stubFetch(ok("0.9.8"))
    await testClient(BASE, CREDS)
    expect(initOf(fetchMock, 0).redirect).toBe("manual")
  })
})

describe("authentication", () => {
  it("sends Basic auth", async () => {
    const fetchMock = stubFetch(ok("0.9.8"))
    await testClient(BASE, CREDS)
    expect(headersOf(fetchMock, 0).Authorization).toBe(
      `Basic ${Buffer.from("alice:pass").toString("base64")}`
    )
  })

  it("sends no Authorization header for blank credentials", async () => {
    const fetchMock = stubFetch(ok("0.9.8"))
    await testClient(BASE, { ...CREDS, username: "", password: "" })
    expect(headersOf(fetchMock, 0).Authorization).toBeUndefined()
  })

  it("latches a 401 and does not call fetch again", async () => {
    const fetchMock = stubFetch(new Response("", { status: 401 }))
    await expect(testClient(BASE, CREDS)).rejects.toThrow(
      "Authentication failed. rTorrent rejected the username and password"
    )
    await expect(testClient(BASE, CREDS)).rejects.toThrow(/rejected the username and password/)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("words a 401 with blank credentials as missing credentials", async () => {
    stubFetch(new Response("", { status: 401 }))
    await expect(testClient(BASE, { ...CREDS, username: "", password: "" })).rejects.toThrow(
      "Authentication failed. rTorrent requires a username and password"
    )
  })

  it("clearAuthBlocks lets it retry", async () => {
    const fetchMock = stubFetch(new Response("", { status: 401 }), ok("0.9.8"))
    await rejection(testClient(BASE, CREDS))
    clearAuthBlocks(BASE)
    await testClient(BASE, CREDS)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("does not latch a 403", async () => {
    const fetchMock = stubFetch(new Response("", { status: 403 }), ok("0.9.8"))
    await expect(testClient(BASE, CREDS)).rejects.toThrow("rTorrent refused the request")
    await testClient(BASE, CREDS)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("refuses apikey credentials", async () => {
    const fetchMock = stubFetch()
    await expect(
      testClient(BASE, { authMethod: "apikey", apiKey: "k", urlPath: "", credentialKey: "k" })
    ).rejects.toThrow("rTorrent has no API-key authentication")
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe("response handling", () => {
  it("refuses a non-XML body", async () => {
    stubFetch(new Response("<html><body>Please log in</body></html>", { status: 200 }))
    await expect(testClient(BASE, CREDS)).rejects.toThrow(
      "rTorrent sent an unexpected response: the body was not XML-RPC"
    )
  })

  it("maps a fault without echoing faultString", async () => {
    stubFetch(faultResponse(-506, "Method 'x' not defined for tracker.example.org/0123456789abcdef"))
    const err = await rejection(testClient(BASE, CREDS))
    expect(err?.message).toBe("rTorrent refused the XML-RPC call (code -506)")
    expect(err?.message).not.toContain("0123456789abcdef")
  })

  it("refuses an oversized body", async () => {
    stubFetch(oversized())
    const err = await rejection(testClient(BASE, CREDS))
    expect(err?.message).toBe(
      `rTorrent returned an oversized response (Response from seedbox.local exceeded ${RTORRENT_RESPONSE_MAX_BYTES} bytes and was refused)`
    )
    expect(isResponseTooLarge(err)).toBe(true)
  })

  it("names the status for a non-ok answer", async () => {
    stubFetch(new Response("", { status: 404, statusText: "Not Found" }))
    await expect(testClient(BASE, CREDS)).rejects.toThrow("rTorrent XML-RPC error: 404 Not Found")
  })

  it("names only the hostname when the connection fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("fetch failed", { cause: { code: "ECONNREFUSED" } }))
    )
    const err = await rejection(testClient(`${BASE}/secret-path`, { ...CREDS, urlPath: "/secret-path" }))
    expect(err?.message).toMatch(/^Failed to connect to seedbox\.local/)
    expect(err?.message).not.toContain("secret-path")
  })

  it("refuses a client version that is not a string", async () => {
    stubFetch(ok(5))
    await expect(testClient(BASE, CREDS)).rejects.toThrow(/unexpected response/)
  })
})

describe("getTransferStats", () => {
  it("returns both rates from one system.multicall", async () => {
    const fetchMock = stubFetch(ok([[1024], [2048]]))
    expect(await getTransferStats(BASE, CREDS)).toEqual({ uploadSpeed: 1024, downloadSpeed: 2048 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const body = bodyOf(fetchMock, 0)
    expect(body).toContain("system.multicall")
    expect(body).toContain("throttle.global_up.rate")
    expect(body).toContain("throttle.global_down.rate")
  })

  it("refuses a rate that is not a number", async () => {
    stubFetch(ok([["fast"], [2048]]))
    await expect(getTransferStats(BASE, CREDS)).rejects.toThrow(/unexpected response/)
  })
})

describe("getTorrents", () => {
  it("keeps private torrents and attaches trackers", async () => {
    const fetchMock = stubFetch(
      ok([row(PRIVATE_HASH, 1), row(PUBLIC_HASH, 0)]),
      ok([[TRACKER_ROWS]])
    )
    const torrents = await getTorrents(BASE, CREDS)
    expect(torrents).toHaveLength(1)
    expect(torrents[0].hash).toBe(PRIVATE_HASH)
    expect(torrents[0].label).toBe("sonarr")
    expect(torrents[0].isPrivate).toBe(true)
    expect(torrents[0].addTime).toBe("1699999000")
    expect(torrents[0].trackers).toEqual([
      {
        url: "https://tracker.example.org/0123456789abcdef/announce",
        group: 0,
        enabled: true,
        scrapeComplete: 40,
        scrapeIncomplete: 2,
      },
    ])

    const first = bodyOf(fetchMock, 0)
    expect(first).toContain("<methodName>d.multicall2</methodName>")
    expect(first).toContain("<string>main</string>")
    for (const field of RTORRENT_FIELDS) expect(first).toContain(`<string>${field}</string>`)

    const second = bodyOf(fetchMock, 1)
    expect(second).toContain("t.multicall")
    expect(second).toContain(PRIVATE_HASH)
    expect(second).not.toContain(PUBLIC_HASH)
  })

  it("leaves trackers empty when a t.multicall sub-call faulted", async () => {
    stubFetch(ok([row(PRIVATE_HASH, 1)]), ok([{ faultCode: -501, faultString: "gone" }]))
    const torrents = await getTorrents(BASE, CREDS)
    expect(torrents[0].trackers).toEqual([])
  })

  it("skips the tracker call when nothing is private", async () => {
    const fetchMock = stubFetch(ok([row(PUBLIC_HASH, 0)]))
    expect(await getTorrents(BASE, CREDS)).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("drops malformed rows and warns", async () => {
    const warn = vi.spyOn(log, "warn").mockImplementation(() => undefined)
    const broken = row(PUBLIC_HASH, 1).slice(0, 5)
    stubFetch(ok([row(PRIVATE_HASH, 1), broken]), ok([[TRACKER_ROWS]]))
    const torrents = await getTorrents(BASE, CREDS)
    expect(torrents.map((t) => t.hash)).toEqual([PRIVATE_HASH])
    expect(warn).toHaveBeenCalledWith(
      { host: "seedbox.local", received: 2, kept: 1 },
      "rtorrent: dropped torrents that failed the shape check"
    )
  })

  it("refuses a d.multicall2 answer that is not a list", async () => {
    stubFetch(ok("nope"))
    await expect(getTorrents(BASE, CREDS)).rejects.toThrow(/unexpected response/)
  })
})

describe("what the user sees when the transport refuses a response", () => {
  // Each refusal reaches a card through sanitizeNetworkError. Without an
  // rTorrent rule it names qBittorrent, or reads "Connection failed", which
  // this codebase reserves for a host that never answered.
  it.each<{ name: string; creds?: ClientCredentials; responses: () => Response[]; card: string }>([
    {
      name: "a rejected password",
      responses: () => [new Response("", { status: 401 })],
      card: "Credentials rejected by rTorrent. Check the username and password",
    },
    {
      name: "blank credentials on an endpoint that requires them",
      creds: { ...CREDS, username: "", password: "" },
      responses: () => [new Response("", { status: 401 })],
      card: "Credentials rejected by rTorrent. Check the username and password",
    },
    {
      name: "an API-key credential",
      creds: { authMethod: "apikey", apiKey: "k", urlPath: "", credentialKey: "apikey:enc-k" },
      responses: () => [],
      card: "rTorrent has no API key login. Set this client to username and password",
    },
    {
      name: "a 403 from the web server's access rules",
      responses: () => [new Response("Forbidden", { status: 403 })],
      card: "rTorrent refused the connection. Check the proxy's access rules",
    },
    {
      name: "an oversized body",
      responses: () => [oversized()],
      card: "rTorrent returned an oversized response",
    },
    {
      name: "a redirect",
      responses: () => [
        new Response(null, { status: 302, headers: { Location: "http://elsewhere.example/" } }),
      ],
      card: "rTorrent redirected the request. Check the URL path",
    },
    {
      name: "a 404 from a wrong port or URL path",
      responses: () => [new Response("404 page not found", { status: 404 })],
      card: "rTorrent's XML-RPC was not found at this address. Check the port and URL path",
    },
    {
      name: "a fault",
      responses: () => [faultResponse(-506, "Method not defined")],
      card: "rTorrent refused the request. Its XML-RPC may be too old or restricted",
    },
    {
      name: "a login page instead of XML-RPC",
      responses: () => [new Response("<html>login</html>")],
      card: "rTorrent sent an unexpected response. Check the URL path points at its XML-RPC endpoint",
    },
    {
      name: "a 502 from a proxy in front of it",
      responses: () => [new Response("Bad Gateway", { status: 502, statusText: "Bad Gateway" })],
      card: "rTorrent returned HTTP 502",
    },
  ])("words $name for the card", async ({ creds, responses, card }) => {
    stubFetch(...responses())
    const err = await rejection(testClient(BASE, creds ?? CREDS))
    const shown = sanitizeNetworkError(err?.message ?? "")
    expect(shown).toBe(card)
    expect(isUnreachableMessage(shown)).toBe(false)
  })

  it("still reads a refused connection as one when the hostname says rtorrent", async () => {
    const cause = Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" })
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed", { cause })))
    const err = await rejection(testClient("http://rtorrent.local:80", CREDS))
    expect(sanitizeNetworkError(err?.message ?? "")).toBe("Connection refused")
  })
})
