// src/lib/download-clients/__tests__/transmission-transport.test.ts

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  clearAllTransmissionSessions,
  getSessionStats,
  getTorrents,
  rpcCall,
  rpcPath,
} from "../transmission/transport"
import type { ClientCredentials } from "../types"

const BASE = "http://localhost:9091"
// Placeholder credentials. Kept deliberately dull ("pass", matching the
// qBittorrent tests) because secret scanners flag any adjacent username/password
// pair that looks like a real one — a joke password reads as a leak to a
// detector that cannot know it is a fixture.
const CREDS: ClientCredentials = {
  authMethod: "password",
  username: "admin",
  password: "pass",
}

function ok(args: unknown): Response {
  return new Response(JSON.stringify({ result: "success", arguments: args }), { status: 200 })
}

function conflict(sessionId: string): Response {
  return new Response("", {
    status: 409,
    headers: { "X-Transmission-Session-Id": sessionId },
  })
}

/** The headers of the nth fetch call, as a plain object. */
function headersOf(call: number): Record<string, string> {
  const init = vi.mocked(global.fetch).mock.calls[call][1] as RequestInit
  return init.headers as Record<string, string>
}

beforeEach(() => {
  clearAllTransmissionSessions()
  global.fetch = vi.fn()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("rpcPath", () => {
  it("appends Transmission's single RPC endpoint", () => {
    expect(rpcPath(BASE)).toBe("http://localhost:9091/transmission/rpc")
  })
})

describe("the 409 session handshake", () => {
  it("replays the request once with the id the 409 handed back", async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(conflict("session-abc"))
      .mockResolvedValueOnce(ok({ version: "4.1.3" }))

    await rpcCall(BASE, CREDS, "session-get")

    expect(global.fetch).toHaveBeenCalledTimes(2)
    expect(headersOf(0)["X-Transmission-Session-Id"]).toBeUndefined()
    expect(headersOf(1)["X-Transmission-Session-Id"]).toBe("session-abc")
  })

  it("caches the id so the handshake is not repeated on the next call", async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(conflict("session-abc"))
      .mockResolvedValueOnce(ok({}))
      .mockResolvedValueOnce(ok({}))

    await rpcCall(BASE, CREDS, "session-get")
    await rpcCall(BASE, CREDS, "session-get")

    expect(global.fetch).toHaveBeenCalledTimes(3)
    expect(headersOf(2)["X-Transmission-Session-Id"]).toBe("session-abc")
  })

  it("re-handshakes when a cached id has been rotated by a daemon restart", async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(conflict("old-id"))
      .mockResolvedValueOnce(ok({}))
      // Second call: the cached id is now stale.
      .mockResolvedValueOnce(conflict("new-id"))
      .mockResolvedValueOnce(ok({}))

    await rpcCall(BASE, CREDS, "session-get")
    await rpcCall(BASE, CREDS, "session-get")

    expect(headersOf(2)["X-Transmission-Session-Id"]).toBe("old-id")
    expect(headersOf(3)["X-Transmission-Session-Id"]).toBe("new-id")
  })

  it("does not loop when a second 409 comes back", async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(conflict("a"))
      .mockResolvedValueOnce(conflict("b"))

    await expect(rpcCall(BASE, CREDS, "session-get")).rejects.toThrow(/409/)
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it("fails clearly when the 409 carries no session id to replay with", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(new Response("", { status: 409 }))
    await expect(rpcCall(BASE, CREDS, "session-get")).rejects.toThrow(
      /without an X-Transmission-Session-Id/
    )
  })
})

describe("authentication", () => {
  it("sends HTTP Basic when credentials are set", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(ok({}))
    await rpcCall(BASE, CREDS, "session-get")
    expect(headersOf(0).Authorization).toBe(
      `Basic ${Buffer.from("admin:pass").toString("base64")}`
    )
  })

  it("sends no Authorization header when both fields are blank", async () => {
    // rpc-authentication-required: false is the common reverse-proxied setup.
    vi.mocked(global.fetch).mockResolvedValueOnce(ok({}))
    await rpcCall(BASE, { authMethod: "password", username: "", password: "" }, "session-get")
    expect(headersOf(0).Authorization).toBeUndefined()
  })

  it("refuses an API-key credential rather than authenticating as nobody", async () => {
    await expect(
      rpcCall(BASE, { authMethod: "apikey", apiKey: "k" }, "session-get")
    ).rejects.toThrow(/no API-key authentication/)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("reports a 401 as a credential rejection", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(new Response("", { status: 401 }))
    await expect(rpcCall(BASE, CREDS, "session-get")).rejects.toThrow(
      /rejected the username and password/
    )
  })
})

describe("error handling", () => {
  it("treats a 200 carrying a failure result as an error", async () => {
    // Transmission answers a refused method with HTTP 200 and the reason in
    // `result`, so the status code alone proves nothing.
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ result: "method name not recognized" }), { status: 200 })
    )
    await expect(rpcCall(BASE, CREDS, "nonsense")).rejects.toThrow(/method name not recognized/)
  })

  it("rejects a success envelope with no arguments", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ result: "success" }), { status: 200 })
    )
    await expect(rpcCall(BASE, CREDS, "session-get")).rejects.toThrow(/returned no arguments/)
  })

  it("unwraps the cause of a network failure", async () => {
    const err = new TypeError("fetch failed")
    ;(err as Error & { cause?: unknown }).cause = Object.assign(new Error("connect"), {
      code: "ECONNREFUSED",
    })
    vi.mocked(global.fetch).mockRejectedValueOnce(err)
    await expect(rpcCall(BASE, CREDS, "session-get")).rejects.toThrow(/ECONNREFUSED/)
  })

  it("names a timeout as one", async () => {
    const err = new Error("aborted")
    err.name = "TimeoutError"
    vi.mocked(global.fetch).mockRejectedValueOnce(err)
    await expect(rpcCall(BASE, CREDS, "session-get")).rejects.toThrow(/timed out/)
  })
})

describe("torrent-get", () => {
  it("asks for an explicit field list and returns the torrent array", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(ok({ torrents: [{ hashString: "abc" }] }))
    const torrents = await getTorrents(BASE, CREDS)

    const body = JSON.parse(
      (vi.mocked(global.fetch).mock.calls[0][1] as RequestInit).body as string
    )
    expect(body.method).toBe("torrent-get")
    expect(body.arguments.fields).toContain("trackerStats")
    expect(body.arguments.fields).toContain("secondsSeeding")
    // No `ids` argument: an empty array means "no torrents" to Transmission,
    // and omitting it is what asks for all of them.
    expect(body.arguments.ids).toBeUndefined()
    expect(torrents).toHaveLength(1)
  })

  it("never requests the announce URL", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(ok({ torrents: [] }))
    await getTorrents(BASE, CREDS)
    const body = JSON.parse(
      (vi.mocked(global.fetch).mock.calls[0][1] as RequestInit).body as string
    )
    expect(body.arguments.fields).not.toContain("trackers")
  })

  it("rejects a payload that is not a torrent list", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(ok({ nothing: true }))
    await expect(getTorrents(BASE, CREDS)).rejects.toThrow(/Invalid torrent-get response/)
  })
})

describe("session-stats", () => {
  it("reads the global speeds", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(ok({ uploadSpeed: 500, downloadSpeed: 200 }))
    expect(await getSessionStats(BASE, CREDS)).toEqual({ uploadSpeed: 500, downloadSpeed: 200 })
  })

  it("defaults missing speeds to zero", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(ok({}))
    expect(await getSessionStats(BASE, CREDS)).toEqual({ uploadSpeed: 0, downloadSpeed: 0 })
  })
})
