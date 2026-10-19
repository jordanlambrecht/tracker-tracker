// src/lib/download-clients/__tests__/qbt-transport.test.ts
//
// The transport turns fetch failures into "Failed to connect" errors that the
// scheduler logs raw, so what it copies out of an error is what ends up on disk.

import { afterEach, describe, expect, it, vi } from "vitest"
import {
  clearAllSessions,
  clearAuthBlocks,
  getSession,
  getTorrents,
  invalidateSession,
  login,
  withSessionRetry,
} from "@/lib/download-clients/qbt/transport"
import { sanitizeNetworkError } from "@/lib/error-utils"
import { QBT_RESPONSE_MAX_BYTES, SYNC_STORE_MAX_TORRENTS } from "@/lib/limits"

const BASE = "http://qbt.local:8080"

/** How many 8 MiB chunks it takes to run a body one chunk past the cap. */
const CHUNKS_PAST_CAP = Math.floor(QBT_RESPONSE_MAX_BYTES / (8 * 1024 * 1024)) + 1

afterEach(() => {
  vi.unstubAllGlobals()
  clearAllSessions()
  clearAuthBlocks(BASE)
})

describe("qBittorrent transport connection errors", () => {
  it("never copies a header-validation TypeError, which quotes the credential", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockRejectedValue(
          new TypeError('Headers.append: "Bearer SECRETKEY" is an invalid header value.')
        )
    )
    const attempt = login("qbt.local", 8080, false, "admin", "pw", "")
    await expect(attempt).rejects.toThrow(`Failed to connect to ${BASE}: TypeError`)
    await expect(login("qbt.local", 8080, false, "admin", "pw", "")).rejects.not.toThrow(
      "SECRETKEY"
    )
  })

  it("still reports the cause code when fetch wraps one", async () => {
    const cause = Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" })
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed", { cause })))
    await expect(login("qbt.local", 8080, false, "admin", "pw", "")).rejects.toThrow(
      `Failed to connect to ${BASE}: ECONNREFUSED`
    )
  })

  it("names the client without its URL path, which can carry a proxy key", async () => {
    const cause = Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" })
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed", { cause })))

    const err = await login("qbt.local", 8080, false, "admin", "pw", "/proxy/qui-client-key")
      .then(() => null)
      .catch((e: unknown) => (e instanceof Error ? e : null))

    expect(err?.message).toContain(`Failed to connect to ${BASE}: ECONNREFUSED`)
    expect(err?.message).not.toContain("/proxy")
    expect(err?.message).not.toContain("qui-client-key")
  })
})

describe("qBittorrent transport redirect handling", () => {
  // The login body carries the password in the clear. fetch() follows
  // redirects by default and a 307 replays the body at the new origin, so
  // before `redirect: "manual"` a host answering 307 collected the password
  // from whatever origin its Location named.
  it("refuses a redirect rather than replaying the password at a new origin", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 307,
        headers: { Location: "http://attacker.example/collect" },
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    await expect(login("qbt.local", 8080, false, "admin", "S3CR3T-PW", "")).rejects.toThrow(
      "qBittorrent API error: 307"
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ redirect: "manual" })
  })

  it("does not latch the credential block on a redirect, which is not a rejection", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(new Response(null, { status: 302, headers: { Location: "/elsewhere" } }))
    )
    await expect(login("qbt.local", 8080, false, "admin", "pw", "")).rejects.toThrow(
      "qBittorrent API error: 302"
    )
    // A latched block would replay the rejection message instead of retrying.
    await expect(login("qbt.local", 8080, false, "admin", "pw", "")).rejects.toThrow(
      "qBittorrent API error: 302"
    )
  })
})

describe("qBittorrent session cookie validation", () => {
  // authHeaders interpolates the SID value straight into a Cookie header.
  // undici rejects CR and LF inside a parsed response header, so a real server
  // cannot deliver one, which is why the response is faked here rather than
  // built with Response: the guard exists because that protection lives in a
  // dependency rather than in this file.
  function loginRespondingWith(setCookie: string[]) {
    return vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => "Ok.",
      headers: { getSetCookie: () => setCookie },
    } as unknown as Response)
  }

  it("refuses a session cookie carrying a control character", async () => {
    vi.stubGlobal("fetch", loginRespondingWith(["SID=abc\r\nX-Injected: 1; Path=/"]))

    await expect(login("qbt.local", 8080, false, "admin", "pw", "")).rejects.toThrow(
      "unsafe character"
    )
  })

  it("accepts an ordinary session cookie", async () => {
    vi.stubGlobal("fetch", loginRespondingWith(["QBT_SID_8080=abc123def456; Path=/; HttpOnly"]))

    const sid = await login("qbt.local", 8080, false, "admin", "pw", "")
    expect(sid).toEqual({ name: "QBT_SID_8080", value: "abc123def456" })
  })

  it("ignores an unrelated Set-Cookie rather than failing the login", async () => {
    vi.stubGlobal("fetch", loginRespondingWith(["analytics=x; Path=/", "SID=cleanvalue; Path=/"]))

    const sid = await login("qbt.local", 8080, false, "admin", "pw", "")
    expect(sid.value).toBe("cleanvalue")
  })
})

/** A fetch that answers every login with "Ok." and the given SID. */
function loginOnce(sid: string) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: "OK",
    text: async () => "Ok.",
    headers: { getSetCookie: () => [`SID=${sid}; Path=/`] },
  } as unknown as Response)
}

describe("qBittorrent session cache keying", () => {
  // Two client rows can point at one host with different accounts. Keyed by
  // baseUrl alone, the second row rode the first row's session, so its own
  // credentials were never sent and a revoked password still polled green.
  it("does not hand one account the session minted for another", async () => {
    const first = loginOnce("session-for-alice")
    vi.stubGlobal("fetch", first)
    const alice = await getSession("qbt.local", 8080, false, "alice", "pw-a", "")
    expect(alice.sid.value).toBe("session-for-alice")

    const second = loginOnce("session-for-bob")
    vi.stubGlobal("fetch", second)
    const bob = await getSession("qbt.local", 8080, false, "bob", "pw-b", "")

    // Bob must have logged in rather than reusing the cached entry.
    expect(second).toHaveBeenCalledTimes(1)
    expect(bob.sid.value).toBe("session-for-bob")
  })

  it("reuses the session for the same credentials", async () => {
    const fetchMock = loginOnce("session-once")
    vi.stubGlobal("fetch", fetchMock)

    await getSession("qbt.local", 8080, false, "alice", "pw-a", "")
    await getSession("qbt.local", 8080, false, "alice", "pw-a", "")

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("drops every session for a host when one is invalidated", async () => {
    vi.stubGlobal("fetch", loginOnce("a"))
    await getSession("qbt.local", 8080, false, "alice", "pw-a", "")
    vi.stubGlobal("fetch", loginOnce("b"))
    await getSession("qbt.local", 8080, false, "bob", "pw-b", "")

    invalidateSession("http://qbt.local:8080")

    const after = loginOnce("fresh")
    vi.stubGlobal("fetch", after)
    await getSession("qbt.local", 8080, false, "alice", "pw-a", "")
    expect(after).toHaveBeenCalledTimes(1)
  })
})

describe("a login behind a URL path", () => {
  it("posts the login under the path and hands back the path as the base URL", async () => {
    const fetchMock = loginOnce("abc123")
    vi.stubGlobal("fetch", fetchMock)

    const session = await getSession(
      "qbt.local",
      8080,
      false,
      "admin",
      "pw",
      "/proxy/qui-client-key"
    )

    expect(fetchMock.mock.calls[0][0]).toBe(
      "http://qbt.local:8080/proxy/qui-client-key/api/v2/auth/login"
    )
    expect(session.baseUrl).toBe("http://qbt.local:8080/proxy/qui-client-key")
  })
})

describe("getTorrents validates the body it was handed", () => {
  // syncMaindata already shape-checks. getTorrents used to cast straight to
  // QbtTorrent[], so an object, or entries of the wrong shape, reached
  // mapQbtTorrent and then the store unchecked.
  const AUTH = { mode: "apikey", key: "k" } as const

  function respondWith(body: unknown) {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => body,
      } as unknown as Response)
    )
  }

  it("refuses a body that is not an array", async () => {
    respondWith({ not: "an array" })
    await expect(getTorrents(BASE, AUTH)).rejects.toThrow("was not an array")
  })

  it("drops entries that fail the shape check and keeps the rest", async () => {
    respondWith([
      { hash: "a", name: "ok", state: "uploading", size: 1, ratio: 1 },
      { hash: "b", name: 42, state: "uploading", size: 1, ratio: 1 },
      "not an object",
    ])

    const torrents = await getTorrents(BASE, AUTH)
    expect(torrents).toHaveLength(1)
    expect(torrents[0].hash).toBe("a")
  })
})

describe("the response body cap", () => {
  // A real ReadableStream, not the plain-object mocks above: those carry no
  // `body`, so they take the response.json() fallback and never reach the
  // reader loop where the cap lives.
  const AUTH = { mode: "apikey", key: "k" } as const

  /** A 200 whose body arrives in chunks, the way a real host sends one. */
  function streamResponse(chunks: Iterable<Uint8Array>) {
    const stream = new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk)
        controller.close()
      },
    })
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(stream)))
  }

  it("refuses a body that runs past the cap", async () => {
    // One 8 MiB chunk enqueued until the body passes the cap, with only 8 MiB
    // allocated. The refusal fires before the concat.
    const chunk = new Uint8Array(8 * 1024 * 1024)
    const oversized = {
      *[Symbol.iterator]() {
        for (let i = 0; i < CHUNKS_PAST_CAP; i++) yield chunk
      },
    }

    streamResponse(oversized)

    // One rejection, both assertions: a stream is consumed once, so a second
    // call would drain an empty body and fail for the wrong reason.
    const err = await getTorrents(BASE, AUTH)
      .then(() => null)
      .catch((e: unknown) => (e instanceof Error ? e : null))

    expect(err).not.toBeNull()
    // Matched whole because only the cap branch builds this string, so a parse
    // error further down cannot pass.
    expect(err?.message).toBe(
      `Response from qbt.local exceeded ${QBT_RESPONSE_MAX_BYTES} bytes and was refused`
    )
  })

  it("fits a full sync of the largest library the sync store holds", () => {
    // A rid=0 sync sends every torrent in one body, so a cap below this refuses
    // the first sync of a library the store would accept, which is what a
    // cross-seed setup with tens of thousands of torrents looks like.
    const name = "Some.Show.S01.1080p.WEB-DL.DDP5.1.H.264-GROUP"
    const announce = `https://tracker.example/announce/${"ab".repeat(16)}`
    const privateTorrent = {
      added_on: 1726000000,
      amount_left: 0,
      auto_tmm: false,
      availability: -1,
      category: "tv",
      comment: "https://tracker.example/torrents/123456",
      completed: 15032385536,
      completion_on: 1726003600,
      content_path: `/data/torrents/tv/${name}`,
      dl_limit: -1,
      dlspeed: 0,
      download_path: "",
      downloaded: 15032385536,
      downloaded_session: 0,
      eta: 8640000,
      f_l_piece_prio: false,
      force_start: false,
      has_metadata: true,
      inactive_seeding_time_limit: -2,
      infohash_v1: "cd".repeat(20),
      infohash_v2: "",
      last_activity: 1729000000,
      magnet_uri: `magnet:?xt=urn:btih:${"cd".repeat(20)}&dn=${name}&tr=${encodeURIComponent(announce)}`,
      max_inactive_seeding_time: -1,
      max_ratio: -1,
      max_seeding_time: -1,
      name,
      num_complete: 42,
      num_incomplete: 1,
      num_leechs: 0,
      num_seeds: 0,
      popularity: 0.0123,
      priority: 0,
      private: true,
      progress: 1,
      ratio: 3.4567,
      ratio_limit: -2,
      reannounce: 1234,
      root_path: `/data/torrents/tv/${name}`,
      save_path: "/data/torrents/tv",
      seeding_time: 2592000,
      seeding_time_limit: -2,
      seen_complete: 1729000000,
      seq_dl: false,
      size: 15032385536,
      state: "stalledUP",
      super_seeding: false,
      tags: "tracker, cross-seed",
      time_active: 2595600,
      total_size: 15032385536,
      tracker: announce,
      trackers_count: 1,
      up_limit: -1,
      uploaded: 51964203008,
      uploaded_session: 0,
      upspeed: 0,
    }
    const perTorrent = Buffer.byteLength(JSON.stringify({ ["cd".repeat(20)]: privateTorrent }))

    expect(SYNC_STORE_MAX_TORRENTS * perTorrent).toBeLessThanOrEqual(QBT_RESPONSE_MAX_BYTES)
  })

  it("reads a body that stays under the cap", async () => {
    // A cap that refused everything would pass the case above.
    const body = JSON.stringify([{ hash: "a", name: "ok", state: "uploading", size: 1, ratio: 1 }])
    streamResponse([new TextEncoder().encode(body)])

    const torrents = await getTorrents(BASE, AUTH)
    expect(torrents).toHaveLength(1)
    expect(torrents[0].hash).toBe("a")
  })

  it("reassembles a body split across chunks", async () => {
    // The concat path, with the split inside a multibyte character.
    const body = JSON.stringify([
      { hash: "b", name: "café ok", state: "uploading", size: 1, ratio: 1 },
    ])
    const encoded = new TextEncoder().encode(body)
    const split = encoded.indexOf(0xc3) + 1
    streamResponse([encoded.subarray(0, split), encoded.subarray(split)])

    const torrents = await getTorrents(BASE, AUTH)
    expect(torrents).toHaveLength(1)
    expect(torrents[0].name).toBe("café ok")
  })

  it("reads a body that opens with a byte order mark", async () => {
    // A host or reverse proxy that prefixes EF BB BF. response.json() runs the
    // Fetch spec's decode, which drops it; the reader decodes the bytes itself.
    const body = JSON.stringify([
      { hash: "c", name: "bom ok", state: "uploading", size: 1, ratio: 1 },
    ])
    streamResponse([new Uint8Array([0xef, 0xbb, 0xbf]), new TextEncoder().encode(body)])

    const torrents = await getTorrents(BASE, AUTH)
    expect(torrents).toHaveLength(1)
    expect(torrents[0].name).toBe("bom ok")
  })
})

describe("the caller's deadline on a login", () => {
  // The first request a password client with no cached SID makes is the login,
  // which is exactly the state a stalling host presents on every cold start.
  function loginResponse(sid = "abc123") {
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => "Ok.",
      headers: { getSetCookie: () => [`SID=${sid}; Path=/`] },
    } as unknown as Response
  }

  it("aborts the login fetch when the caller's signal aborts", async () => {
    const fetchMock = vi.fn().mockResolvedValue(loginResponse())
    vi.stubGlobal("fetch", fetchMock)
    const caller = new AbortController()

    await login("qbt.local", 8080, false, "admin", "pw", "", caller.signal)

    const sent = (fetchMock.mock.calls[0][1] as RequestInit).signal as AbortSignal
    expect(sent.aborted).toBe(false)
    caller.abort()
    expect(sent.aborted).toBe(true)
  })

  it("aborts a login reached through withSessionRetry when the caller's signal aborts", async () => {
    const fetchMock = vi.fn().mockResolvedValue(loginResponse("session-a"))
    vi.stubGlobal("fetch", fetchMock)
    const caller = new AbortController()

    await withSessionRetry(
      "qbt.local",
      8080,
      false,
      "admin",
      "pw",
      "",
      async () => "polled",
      caller.signal
    )

    const sent = (fetchMock.mock.calls[0][1] as RequestInit).signal as AbortSignal
    caller.abort()
    expect(sent.aborted).toBe(true)
  })
})

describe("the response body cap on the plain-text reads", () => {
  const REFUSAL = `Response from qbt.local exceeded ${QBT_RESPONSE_MAX_BYTES} bytes and was refused`

  /** One 8 MiB chunk enqueued until the body passes the cap. */
  function oversizedStream() {
    const chunk = new Uint8Array(8 * 1024 * 1024)
    return new ReadableStream({
      start(controller) {
        for (let i = 0; i < CHUNKS_PAST_CAP; i++) controller.enqueue(chunk)
        controller.close()
      },
    })
  }

  function respondWith(status: number) {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(oversizedStream(), { status })))
  }

  it("refuses a login body that runs past the cap", async () => {
    respondWith(200)
    await expect(login("qbt.local", 8080, false, "admin", "pw", "")).rejects.toThrow(REFUSAL)
  })

  it("refuses a ban notice that runs past the cap", async () => {
    respondWith(403)
    await expect(login("qbt.local", 8080, false, "admin", "pw", "")).rejects.toThrow(REFUSAL)
  })

  it("refuses a ban notice on a key client that runs past the cap", async () => {
    respondWith(403)
    // A refused read decides nothing, so the key must not be latched either.
    await expect(getTorrents(BASE, { mode: "apikey", key: "k" })).rejects.toThrow(REFUSAL)
  })
})

describe("what the user sees when the transport refuses a response", () => {
  // Each refusal reaches a card through sanitizeNetworkError. Without a rule
  // they all read "Connection failed", which this codebase reserves for a host
  // that never answered.
  it("tells the user the body was oversized rather than that the host went quiet", async () => {
    const chunk = new Uint8Array(8 * 1024 * 1024)
    const stream = new ReadableStream({
      start(controller) {
        for (let i = 0; i < CHUNKS_PAST_CAP; i++) controller.enqueue(chunk)
        controller.close()
      },
    })
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(stream)))

    const err = await login("qbt.local", 8080, false, "admin", "pw", "")
      .then(() => null)
      .catch((e: unknown) => (e instanceof Error ? e : null))

    expect(sanitizeNetworkError(err?.message ?? "")).toBe(
      "qBittorrent returned an oversized response"
    )
  })

  it("tells the user the session cookie was unsafe rather than that the host went quiet", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => "Ok.",
        headers: { getSetCookie: () => ["SID=abc\r\nX-Injected: 1; Path=/"] },
      } as unknown as Response)
    )

    const err = await login("qbt.local", 8080, false, "admin", "pw", "")
      .then(() => null)
      .catch((e: unknown) => (e instanceof Error ? e : null))

    expect(sanitizeNetworkError(err?.message ?? "")).toBe(
      "qBittorrent sent an unsafe session cookie"
    )
  })

  it("tells the user the request was redirected rather than that the host went quiet", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(null, { status: 307, headers: { Location: "http://elsewhere.example/" } })
        )
    )

    const err = await login("qbt.local", 8080, false, "admin", "pw", "")
      .then(() => null)
      .catch((e: unknown) => (e instanceof Error ? e : null))

    expect(sanitizeNetworkError(err?.message ?? "")).toBe("qBittorrent redirected the request")
  })

  it("tells the user the API is not at this address rather than that the host went quiet", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("404 page not found", { status: 404 }))
    )

    const err = await login("qui.lan", 7476, false, "", "", "/proxi/key")
      .then(() => null)
      .catch((e: unknown) => (e instanceof Error ? e : null))

    expect(sanitizeNetworkError(err?.message ?? "")).toBe(
      "qBittorrent's API was not found at this address. Check the port and URL path"
    )
  })
})
