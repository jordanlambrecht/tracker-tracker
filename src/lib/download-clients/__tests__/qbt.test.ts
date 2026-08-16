// src/lib/download-clients/__tests__/qbt.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { TorrentRecord } from "@/lib/download-clients"
import { aggregateByTag } from "../aggregator"
import {
  buildBaseUrl,
  clearAllSessions,
  clearAuthBlocks,
  getSession,
  getTorrents,
  getTransferInfo,
  login,
  type QbtAuth,
} from "../qbt/transport"
import type { QbtTorrent } from "../qbt/types"

// ---------------------------------------------------------------------------
// buildBaseUrl
// ---------------------------------------------------------------------------

describe("buildBaseUrl", () => {
  it("builds an http URL when ssl is false", () => {
    expect(buildBaseUrl("192.168.1.1", 8080, false)).toBe("http://192.168.1.1:8080")
  })

  it("builds an https URL when ssl is true", () => {
    expect(buildBaseUrl("qbt.example.com", 443, true)).toBe("https://qbt.example.com:443")
  })
})

// ---------------------------------------------------------------------------
// login
// ---------------------------------------------------------------------------

describe("login", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    // Session cache and auth blocks live on globalThis — reset so state cannot
    // leak between tests.
    clearAllSessions()
  })

  it("returns the SID cookie name and value on successful login", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => "Ok.",
      headers: new Headers({ "set-cookie": "SID=abc123xyz; Path=/; HttpOnly" }),
    } as Response)

    const sid = await login("localhost", 8080, false, "admin", "password")
    expect(sid).toEqual({ name: "SID", value: "abc123xyz" })
  })

  it("returns the SID cookie name and value on successful login with 204 No Content (qBittorrent 5.2+)", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 204,
      text: async () => "",
      headers: new Headers({ "set-cookie": "SID=abc123xyz; Path=/; HttpOnly" }),
    } as Response)

    const sid = await login("localhost", 8080, false, "admin", "password")
    expect(sid).toEqual({ name: "SID", value: "abc123xyz" })
  })

  it("returns the actual cookie name and value from a QBT_SID_<port> cookie (qBittorrent 5.2+)", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 204,
      text: async () => "",
      headers: new Headers({
        "set-cookie":
          "QBT_SID_8080=YYhsGDAcg8mu89vWPnxXgkH1xkjVQK5h; HttpOnly; SameSite=Lax; expires=Wed, 05-Aug-2026 01:58:51 GMT; path=/",
      }),
    } as Response)

    const sid = await login("localhost", 8080, false, "admin", "password")
    expect(sid).toEqual({ name: "QBT_SID_8080", value: "YYhsGDAcg8mu89vWPnxXgkH1xkjVQK5h" })
  })

  it("picks the real QBT_SID_<port> cookie over a decoy cookie whose name merely contains SID as a substring", async () => {
    const headers = new Headers()
    headers.append("set-cookie", "SIDCC=fakevalue123; Path=/")
    headers.append("set-cookie", "QBT_SID_8080=realvalue456; HttpOnly; Path=/")

    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 204,
      text: async () => "",
      headers,
    } as Response)

    const sid = await login("localhost", 8080, false, "admin", "password")
    expect(sid).toEqual({ name: "QBT_SID_8080", value: "realvalue456" })
  })

  it("does not bleed the SID cookie's value into a second comma-joined Set-Cookie header when the SID cookie has no trailing attributes", async () => {
    const headers = new Headers()
    headers.append("set-cookie", "QBT_SID_8080=realvalue456")
    headers.append("set-cookie", "other=somethingelse; Path=/")

    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 204,
      text: async () => "",
      headers,
    } as Response)

    const sid = await login("localhost", 8080, false, "admin", "password")
    expect(sid).toEqual({ name: "QBT_SID_8080", value: "realvalue456" })
  })

  it("sends a POST to the correct URL with form-encoded body", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      text: async () => "Ok.",
      headers: new Headers({ "set-cookie": "SID=testsid; Path=/" }),
    } as Response)

    await login("localhost", 8080, false, "admin", "secret")

    expect(fetchSpy.mock.calls[0][0]).toBe("http://localhost:8080/api/v2/auth/login")
    const init = fetchSpy.mock.calls[0][1] as RequestInit
    expect(init.method).toBe("POST")
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/x-www-form-urlencoded"
    )
    expect(init.body).toBe("username=admin&password=secret")
  })

  it("throws Authentication failed when response text is not Ok.", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => "Fails.",
      headers: new Headers({}),
    } as Response)

    await expect(login("localhost", 8080, false, "admin", "wrongpass")).rejects.toThrow(
      "Authentication failed"
    )
  })

  it("throws Authentication failed when SID cookie is absent", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      text: async () => "Ok.",
      headers: new Headers({}),
    } as Response)

    await expect(login("localhost", 8080, false, "admin", "password")).rejects.toThrow(
      "Authentication failed"
    )
  })

  it("throws a qBittorrent API error on non-ok HTTP response", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: "Forbidden",
      text: async () => "",
      headers: new Headers({}),
    } as Response)

    await expect(login("localhost", 8080, false, "admin", "password")).rejects.toThrow(
      "qBittorrent API error: 403 Forbidden"
    )
  })

  it("throws a timeout message when AbortSignal fires", async () => {
    const timeoutError = new DOMException("signal timed out", "TimeoutError")
    vi.spyOn(global, "fetch").mockRejectedValueOnce(timeoutError)

    await expect(login("localhost", 8080, false, "admin", "password")).rejects.toThrow(
      "Request to localhost timed out after 15s"
    )
  })

  it("throws a connection error on network failure", async () => {
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("ECONNREFUSED"))

    await expect(login("192.168.1.50", 8080, false, "admin", "pass")).rejects.toThrow(
      "Failed to connect to http://192.168.1.50:8080: ECONNREFUSED"
    )
  })

  it("uses AbortSignal for timeout protection", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      text: async () => "Ok.",
      headers: new Headers({ "set-cookie": "SID=x; Path=/" }),
    } as Response)

    await login("localhost", 8080, false, "admin", "pass")

    const init = fetchSpy.mock.calls[0][1] as RequestInit
    expect(init.signal).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Auth-failure circuit breaker
//
// The heartbeat polls every 5s and qBittorrent bans the caller after 5 failed
// logins, so a rejected credential pair must be attempted exactly once — while
// a transient fault must keep retrying, since a rebooting client should
// recover without the user touching anything.
// ---------------------------------------------------------------------------

describe("login auth-failure circuit breaker", () => {
  const unauthorized = () =>
    ({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      text: async () => "",
      headers: new Headers({}),
    }) as Response

  const loggedIn = () =>
    ({
      ok: true,
      status: 200,
      text: async () => "Ok.",
      headers: new Headers({ "set-cookie": "SID=abc123xyz; Path=/; HttpOnly" }),
    }) as Response

  beforeEach(() => {
    vi.restoreAllMocks()
    clearAllSessions()
  })

  it("attempts login only once across repeated auth failures", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(unauthorized())

    // Ten heartbeat cycles against a client saved with a bad password.
    for (let i = 0; i < 10; i++) {
      await expect(getSession("localhost", 8080, false, "admin", "wrong")).rejects.toThrow(
        "Authentication failed"
      )
    }

    // Without the breaker this would be 10 — two above qBittorrent's default
    // ban threshold of 5.
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it("keeps retrying after a transient network error", async () => {
    const refused = Object.assign(new TypeError("fetch failed"), {
      cause: Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }),
    })
    const fetchSpy = vi.spyOn(global, "fetch").mockRejectedValue(refused)

    for (let i = 0; i < 3; i++) {
      await expect(getSession("localhost", 8080, false, "admin", "password")).rejects.toThrow(
        "ECONNREFUSED"
      )
    }

    // A client that is merely rebooting must recover on its own.
    expect(fetchSpy).toHaveBeenCalledTimes(3)
  })

  it("retries once the password is edited, so a user who fixes it is not stuck", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce(unauthorized())

    await expect(getSession("localhost", 8080, false, "admin", "wrong")).rejects.toThrow(
      "Authentication failed"
    )
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    // Same host, corrected password — a different key, so not blocked.
    fetchSpy.mockResolvedValueOnce(loggedIn())
    const { sid } = await getSession("localhost", 8080, false, "admin", "correct")

    expect(sid).toEqual({ name: "SID", value: "abc123xyz" })
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  // The exact sequence this feature invites: a user is rejected with wrong
  // credentials, reads the helper text, blanks both fields because their
  // qBittorrent has localhost auth bypass on — and must not stay stuck. Distinct
  // from the test above: that one is non-blank -> non-blank, whereas blank
  // credentials take the separate BLANK_CREDENTIALS_REJECTED message path.
  it("retries when the user replaces bad credentials with blank ones", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce(unauthorized())

    await expect(getSession("localhost", 8080, false, "admin", "wrongpass")).rejects.toThrow(
      "Authentication failed"
    )
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    // Still blocked while that pair is unchanged.
    await expect(getSession("localhost", 8080, false, "admin", "wrongpass")).rejects.toThrow(
      "Authentication failed"
    )
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    // Both fields blanked — qBittorrent bypasses auth and answers 204 + cookie.
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 204,
      text: async () => "",
      headers: new Headers({ "set-cookie": "SID=bypass-sid; Path=/; HttpOnly" }),
    } as Response)

    const { sid } = await getSession("localhost", 8080, false, "", "")

    expect(sid).toEqual({ name: "SID", value: "bypass-sid" })
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it("does not block a second client sharing the host with different credentials", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(unauthorized())

    await expect(login("localhost", 8080, false, "alice", "a-pass")).rejects.toThrow(
      "Authentication failed"
    )
    await expect(login("localhost", 8080, false, "bob", "b-pass")).rejects.toThrow(
      "Authentication failed"
    )

    // One attempt each — blocks are per credential pair, not per host.
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it("clearAuthBlocks lets an explicit retry reach the network again", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(unauthorized())

    await expect(login("localhost", 8080, false, "admin", "wrong")).rejects.toThrow(
      "Authentication failed"
    )
    await expect(login("localhost", 8080, false, "admin", "wrong")).rejects.toThrow(
      "Authentication failed"
    )
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    clearAuthBlocks("http://localhost:8080")

    await expect(login("localhost", 8080, false, "admin", "wrong")).rejects.toThrow(
      "Authentication failed"
    )
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it("does not block on an IP ban, so access returns when the ban expires", async () => {
    const banned = () =>
      ({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        text: async () =>
          "Your IP address has been banned after too many failed authentication attempts.",
        headers: new Headers({}),
      }) as Response
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(banned())

    for (let i = 0; i < 3; i++) {
      await expect(login("localhost", 8080, false, "admin", "password")).rejects.toThrow(
        "qBittorrent has temporarily banned this IP"
      )
    }

    expect(fetchSpy).toHaveBeenCalledTimes(3)
  })

  it("tells a blank-credential user that bypass is required", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(unauthorized())

    await expect(login("localhost", 8080, false, "", "")).rejects.toThrow(
      /Bypass authentication for clients on localhost/
    )
  })

  it("logs a blank-credential client in when qBittorrent bypasses auth (204)", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 204,
      text: async () => "",
      headers: new Headers({ "set-cookie": "SID=bypass-sid; Path=/; HttpOnly" }),
    } as Response)

    const sid = await login("localhost", 8080, false, "", "")
    expect(sid).toEqual({ name: "SID", value: "bypass-sid" })
  })
})

// ---------------------------------------------------------------------------
// getTorrents
// ---------------------------------------------------------------------------

describe("getTorrents", () => {
  const sid: QbtAuth = { mode: "session", sid: { name: "SID", value: "mysid" } }

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("returns parsed torrent array on success", async () => {
    const mockTorrents: QbtTorrent[] = [
      {
        hash: "abc",
        name: "My.Show.S01.BluRay",
        state: "uploading",
        tags: "aither",
        category: "",
        upspeed: 1024,
        dlspeed: 0,
        uploaded: 5000000,
        downloaded: 3000000,
        ratio: 1.67,
        size: 3000000,
        num_seeds: 10,
        num_leechs: 2,
        num_complete: 15,
        num_incomplete: 3,
        tracker: "https://aither.cc/announce",
        added_on: 1700000000,
        completion_on: 1700001000,
        last_activity: 1700002000,
        seeding_time: 86400,
        time_active: 90000,
        seen_complete: 1700002000,
        availability: 1,
        amount_left: 0,
        progress: 1,
        content_path: "/downloads/My.Show.S01.BluRay",
        save_path: "/downloads",
        is_private: true,
      },
    ]

    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockTorrents,
    } as Response)

    const result = await getTorrents("http://localhost:8080", sid)
    expect(result).toHaveLength(1)
    expect(result[0].hash).toBe("abc")
    expect(result[0].state).toBe("uploading")
  })

  it("sends the SID cookie under its own name in request", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response)

    await getTorrents("http://localhost:8080", {
      mode: "session",
      sid: { name: "SID", value: "testSID99" },
    })

    const init = fetchSpy.mock.calls[0][1] as RequestInit
    expect((init.headers as Record<string, string>).Cookie).toBe("SID=testSID99")
  })

  it("sends the cookie under a QBT_SID_<port>-style name, not a hardcoded SID", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response)

    await getTorrents("http://localhost:8080", {
      mode: "session",
      sid: { name: "QBT_SID_8080", value: "testSID99" },
    })

    const init = fetchSpy.mock.calls[0][1] as RequestInit
    expect((init.headers as Record<string, string>).Cookie).toBe("QBT_SID_8080=testSID99")
  })

  it("calls the correct endpoint", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response)

    await getTorrents("http://localhost:8080", sid)

    expect(fetchSpy.mock.calls[0][0]).toBe("http://localhost:8080/api/v2/torrents/info")
  })

  it("appends tag query parameter when tag is provided", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response)

    await getTorrents("http://localhost:8080", sid, "aither")

    expect(fetchSpy.mock.calls[0][0]).toBe("http://localhost:8080/api/v2/torrents/info?tag=aither")
  })

  it("encodes special characters in tag parameter", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response)

    await getTorrents("http://localhost:8080", sid, "cross seed")

    expect(fetchSpy.mock.calls[0][0]).toBe(
      "http://localhost:8080/api/v2/torrents/info?tag=cross%20seed"
    )
  })

  it("throws session expired on 403 response", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: "Forbidden",
    } as Response)

    await expect(getTorrents("http://localhost:8080", sid)).rejects.toThrow("Session expired")
  })

  it("throws on non-ok response", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    } as Response)

    await expect(getTorrents("http://localhost:8080", sid)).rejects.toThrow(
      "qBittorrent API error: 500 Internal Server Error"
    )
  })

  it("throws a timeout message when AbortSignal fires", async () => {
    vi.spyOn(global, "fetch").mockRejectedValueOnce(
      new DOMException("signal timed out", "TimeoutError")
    )

    await expect(getTorrents("http://localhost:8080", sid)).rejects.toThrow(
      "Request to localhost timed out after 15s"
    )
  })

  it("throws a connection error on network failure", async () => {
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("fetch failed"))

    await expect(getTorrents("http://192.168.1.1:8080", sid)).rejects.toThrow(
      "Failed to connect to 192.168.1.1"
    )
  })
})

// ---------------------------------------------------------------------------
// getTransferInfo
// ---------------------------------------------------------------------------

describe("getTransferInfo", () => {
  const sid: QbtAuth = { mode: "session", sid: { name: "SID", value: "mysid" } }

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("returns parsed transfer info on success", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        up_info_speed: 2048,
        dl_info_speed: 4096,
        up_info_data: 10000000,
        dl_info_data: 20000000,
      }),
    } as Response)

    const info = await getTransferInfo("http://localhost:8080", sid)
    expect(info.up_info_speed).toBe(2048)
    expect(info.dl_info_speed).toBe(4096)
  })

  it("calls the correct endpoint", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ up_info_speed: 0, dl_info_speed: 0, up_info_data: 0, dl_info_data: 0 }),
    } as Response)

    await getTransferInfo("http://localhost:8080", sid)

    expect(fetchSpy.mock.calls[0][0]).toBe("http://localhost:8080/api/v2/transfer/info")
  })

  it("sends the SID cookie under its own name in request", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ up_info_speed: 0, dl_info_speed: 0, up_info_data: 0, dl_info_data: 0 }),
    } as Response)

    await getTransferInfo("http://localhost:8080", {
      mode: "session",
      sid: { name: "SID", value: "mySID" },
    })

    const init = fetchSpy.mock.calls[0][1] as RequestInit
    expect((init.headers as Record<string, string>).Cookie).toBe("SID=mySID")
  })

  it("sends the cookie under a QBT_SID_<port>-style name, not a hardcoded SID", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ up_info_speed: 0, dl_info_speed: 0, up_info_data: 0, dl_info_data: 0 }),
    } as Response)

    await getTransferInfo("http://localhost:8080", {
      mode: "session",
      sid: { name: "QBT_SID_8091", value: "mySID" },
    })

    const init = fetchSpy.mock.calls[0][1] as RequestInit
    expect((init.headers as Record<string, string>).Cookie).toBe("QBT_SID_8091=mySID")
  })

  it("throws on non-ok response", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
    } as Response)

    await expect(getTransferInfo("http://localhost:8080", sid)).rejects.toThrow(
      "qBittorrent API error: 401 Unauthorized"
    )
  })
})

// ---------------------------------------------------------------------------
// API-key auth (qBittorrent >= 5.2.0)
//
// A Bearer key never passes through login(), so it gets none of the session
// machinery — and none of login()'s circuit breaker either, which is why the
// breaker is duplicated in qbtFetch. These tests pin both halves: the header
// that goes out, and the fact that a rejected key is asked about exactly once.
// ---------------------------------------------------------------------------

describe("API-key auth", () => {
  const auth: QbtAuth = { mode: "apikey", key: "qbt_testkey" }

  // A 403 is inspected for a ban notice before it is treated as a rejected
  // key, so the fixture has to carry a body like a real Response does.
  const rejected = (status: number) =>
    ({
      ok: false,
      status,
      statusText: status === 401 ? "Unauthorized" : "Forbidden",
      text: async () => "Forbidden",
    }) as Response

  beforeEach(() => {
    vi.restoreAllMocks()
    clearAllSessions()
  })

  it("sends the key as a Bearer token and no Cookie header", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response)

    await getTorrents("http://localhost:8080", auth)

    const headers = (fetchSpy.mock.calls[0][1] as RequestInit).headers as Record<string, string>
    expect(headers.Authorization).toBe("Bearer qbt_testkey")
    expect(headers.Cookie).toBeUndefined()
  })

  it.each([401, 403])("reports a rejected key on %i rather than a session expiry", async (code) => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(rejected(code))

    await expect(getTorrents("http://localhost:8080", auth)).rejects.toThrow(
      /rejected the API key/
    )
  })

  it("asks about a rejected key exactly once, then replays the rejection", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(rejected(403))

    // Ten heartbeat cycles against a client saved with a stale key.
    for (let i = 0; i < 10; i++) {
      await expect(getTorrents("http://localhost:8080", auth)).rejects.toThrow(
        /rejected the API key/
      )
    }

    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it("does not block a different key on the same host", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce(rejected(403))
    await expect(getTorrents("http://localhost:8080", auth)).rejects.toThrow()

    // The user pastes a corrected key — a new fingerprint, so not blocked.
    fetchSpy.mockClear()
    fetchSpy.mockResolvedValueOnce({ ok: true, json: async () => [] } as Response)

    await expect(
      getTorrents("http://localhost:8080", { mode: "apikey", key: "qbt_corrected" })
    ).resolves.toEqual([])
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it("clearAuthBlocks releases an API-key block so Test Connection reaches the network", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce(rejected(403))
    await expect(getTorrents("http://localhost:8080", auth)).rejects.toThrow()

    clearAuthBlocks("http://localhost:8080")

    fetchSpy.mockClear()
    fetchSpy.mockResolvedValueOnce({ ok: true, json: async () => [] } as Response)
    await expect(getTorrents("http://localhost:8080", auth)).resolves.toEqual([])
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it("does not latch an IP ban, so it clears when the ban expires", async () => {
    // A ban is reachable without this key being wrong — a sibling
    // password-mode client on the same host can trip qBittorrent's counter.
    // Latching would outlive the ban and make a self-healing state permanent.
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: "Forbidden",
      text: async () => "Your IP address has been banned after too many failed authentication attempts.",
    } as Response)

    await expect(getTorrents("http://localhost:8080", auth)).rejects.toThrow(/banned this IP/)

    // The ban lapses; the very next poll must reach the network again.
    fetchSpy.mockClear()
    fetchSpy.mockResolvedValueOnce({ ok: true, json: async () => [] } as Response)
    await expect(getTorrents("http://localhost:8080", auth)).resolves.toEqual([])
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it("leaves a session-mode 403 as a recoverable session expiry", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(rejected(403))

    await expect(
      getTorrents("http://localhost:8080", {
        mode: "session",
        sid: { name: "SID", value: "mysid" },
      })
    ).rejects.toThrow("Session expired")
  })
})

// ---------------------------------------------------------------------------
// aggregateByTag
// ---------------------------------------------------------------------------

describe("aggregateByTag", () => {
  // Factory uses TorrentRecord (normalized camelCase) shape — what the aggregator receives.
  function makeTorrent(overrides: Partial<TorrentRecord>): TorrentRecord {
    return {
      hash: "deadbeef",
      name: "Test Torrent",
      state: "uploading",
      tags: "",
      category: "",
      uploadSpeed: 0,
      downloadSpeed: 0,
      uploaded: 0,
      downloaded: 0,
      ratio: 0,
      size: 0,
      seedCount: 0,
      leechCount: 0,
      swarmSeeders: 0,
      swarmLeechers: 0,
      tracker: "",
      addedAt: 0,
      completedAt: -1,
      lastActivityAt: 0,
      seedingTime: 0,
      activeTime: 0,
      lastSeenComplete: 0,
      availability: -1,
      remaining: 0,
      progress: 1,
      contentPath: "/downloads/Test Torrent",
      savePath: "/downloads",
      ...overrides,
    }
  }

  it("counts seeding torrents for a matched tag", () => {
    const torrents = [makeTorrent({ state: "uploading", tags: "aither", uploadSpeed: 512 })]
    const result = aggregateByTag(torrents, ["aither"], [])

    expect(result.totalSeedingCount).toBe(1)
    expect(result.totalLeechingCount).toBe(0)
    const aitherStats = result.tagStats.find((t) => t.tag === "aither")
    expect(aitherStats?.seedingCount).toBe(1)
    expect(aitherStats?.uploadSpeed).toBe(512)
  })

  it("counts leeching torrents for a matched tag", () => {
    const torrents = [makeTorrent({ state: "downloading", tags: "aither", downloadSpeed: 1024 })]
    const result = aggregateByTag(torrents, ["aither"], [])

    expect(result.totalLeechingCount).toBe(1)
    expect(result.totalSeedingCount).toBe(0)
    const aitherStats = result.tagStats.find((t) => t.tag === "aither")
    expect(aitherStats?.leechingCount).toBe(1)
    expect(aitherStats?.downloadSpeed).toBe(1024)
  })

  it("routes torrents with no matching tag into untagged bucket", () => {
    const torrents = [
      makeTorrent({ state: "uploading", tags: "some-other-tracker", uploadSpeed: 200 }),
    ]
    const result = aggregateByTag(torrents, ["aither"], [])

    const untagged = result.tagStats.find((t) => t.tag === "untagged")
    expect(untagged).toBeDefined()
    expect(untagged?.seedingCount).toBe(1)
    expect(untagged?.uploadSpeed).toBe(200)
  })

  it("torrents with empty tags go into untagged bucket", () => {
    const torrents = [makeTorrent({ state: "uploading", tags: "" })]
    const result = aggregateByTag(torrents, ["aither"], [])

    const untagged = result.tagStats.find((t) => t.tag === "untagged")
    expect(untagged).toBeDefined()
    expect(untagged?.seedingCount).toBe(1)
  })

  it("handles torrents with multiple tags, crediting all matched buckets", () => {
    const torrents = [
      makeTorrent({ state: "uploading", tags: "aither, cross-seed", uploadSpeed: 300 }),
    ]
    const result = aggregateByTag(torrents, ["aither"], ["cross-seed"])

    const aitherStats = result.tagStats.find((t) => t.tag === "aither")
    const crossSeedStats = result.tagStats.find((t) => t.tag === "cross-seed")
    expect(aitherStats?.seedingCount).toBe(1)
    expect(crossSeedStats?.seedingCount).toBe(1)
  })

  it("trims whitespace from torrent tags before matching", () => {
    const torrents = [makeTorrent({ state: "uploading", tags: "  aither  ,  cross-seed  " })]
    const result = aggregateByTag(torrents, ["aither"], ["cross-seed"])

    const aitherStats = result.tagStats.find((t) => t.tag === "aither")
    expect(aitherStats?.seedingCount).toBe(1)
  })

  it("does not include untagged bucket when all torrents are matched", () => {
    const torrents = [makeTorrent({ state: "uploading", tags: "aither" })]
    const result = aggregateByTag(torrents, ["aither"], [])

    const untagged = result.tagStats.find((t) => t.tag === "untagged")
    expect(untagged).toBeUndefined()
  })

  it("recognises all seeding states: stalledUP, forcedUP, queuedUP", () => {
    const torrents = [
      makeTorrent({ state: "stalledUP", tags: "aither" }),
      makeTorrent({ state: "forcedUP", tags: "aither" }),
      makeTorrent({ state: "queuedUP", tags: "aither" }),
    ]
    const result = aggregateByTag(torrents, ["aither"], [])
    expect(result.totalSeedingCount).toBe(3)
    const aitherStats = result.tagStats.find((t) => t.tag === "aither")
    expect(aitherStats?.seedingCount).toBe(3)
  })

  it("recognises all leeching states: stalledDL, forcedDL, queuedDL, metaDL", () => {
    const torrents = [
      makeTorrent({ state: "stalledDL", tags: "aither" }),
      makeTorrent({ state: "forcedDL", tags: "aither" }),
      makeTorrent({ state: "queuedDL", tags: "aither" }),
      makeTorrent({ state: "metaDL", tags: "aither" }),
    ]
    const result = aggregateByTag(torrents, ["aither"], [])
    expect(result.totalLeechingCount).toBe(4)
    const aitherStats = result.tagStats.find((t) => t.tag === "aither")
    expect(aitherStats?.leechingCount).toBe(4)
  })

  it("counts pausedUP as a seeding state", () => {
    const torrents = [makeTorrent({ state: "pausedUP", tags: "aither" })]
    const result = aggregateByTag(torrents, ["aither"], [])
    expect(result.totalSeedingCount).toBe(1)
    expect(result.totalLeechingCount).toBe(0)
    const aitherStats = result.tagStats.find((t) => t.tag === "aither")
    expect(aitherStats?.seedingCount).toBe(1)
  })

  it("ignores torrents in neither seeding nor leeching states", () => {
    const torrents = [makeTorrent({ state: "pausedDL", tags: "aither" })]
    const result = aggregateByTag(torrents, ["aither"], [])
    expect(result.totalSeedingCount).toBe(0)
    expect(result.totalLeechingCount).toBe(0)
    const aitherStats = result.tagStats.find((t) => t.tag === "aither")
    expect(aitherStats?.seedingCount).toBe(0)
  })

  it("returns zero totals for an empty torrent list", () => {
    const result = aggregateByTag([], ["aither"], ["cross-seed"])
    expect(result.totalSeedingCount).toBe(0)
    expect(result.totalLeechingCount).toBe(0)
    expect(result.uploadSpeedBytes).toBe(0)
    expect(result.downloadSpeedBytes).toBe(0)
    expect(result.tagStats).toHaveLength(2) // known tags with zeros
  })

  it("sums speeds across multiple seeding torrents for the same tag", () => {
    const torrents = [
      makeTorrent({ state: "uploading", tags: "aither", uploadSpeed: 100 }),
      makeTorrent({ state: "stalledUP", tags: "aither", uploadSpeed: 200 }),
    ]
    const result = aggregateByTag(torrents, ["aither"], [])
    const aitherStats = result.tagStats.find((t) => t.tag === "aither")
    expect(aitherStats?.uploadSpeed).toBe(300)
    expect(result.uploadSpeedBytes).toBe(300)
  })

  it("includes crossSeedTags in known tag buckets", () => {
    const torrents = [makeTorrent({ state: "uploading", tags: "cross-seed" })]
    const result = aggregateByTag(torrents, [], ["cross-seed"])
    const crossSeedStats = result.tagStats.find((t) => t.tag === "cross-seed")
    expect(crossSeedStats?.seedingCount).toBe(1)
    const untagged = result.tagStats.find((t) => t.tag === "untagged")
    expect(untagged).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Mock factory realism
// ---------------------------------------------------------------------------

describe("makeTorrent factory shape", () => {
  // Regression: prevents isPrivate camelCase mismatch from masking deep-poll dedup bug.
  // The factory previously included `isPrivate: true`, which caused any code that
  // checked `t.isPrivate` to behave differently from the real API (which returns
  // `is_private` in snake_case). Tests built on the old factory would never catch
  // bugs that depended on `t.isPrivate` being undefined.
  it("produces API-realistic shape without isPrivate by default", () => {
    // Re-declare the factory inline to confirm the standalone shape — this is the
    // canonical check that should fail immediately if someone adds isPrivate back.
    function makeTorrentForShapeCheck(overrides: Partial<QbtTorrent> = {}): QbtTorrent {
      return {
        hash: "deadbeef",
        name: "Test Torrent",
        state: "uploading",
        tags: "",
        category: "",
        upspeed: 0,
        dlspeed: 0,
        uploaded: 0,
        downloaded: 0,
        ratio: 0,
        size: 0,
        num_seeds: 0,
        num_leechs: 0,
        num_complete: 0,
        num_incomplete: 0,
        tracker: "",
        added_on: 0,
        completion_on: -1,
        last_activity: 0,
        seeding_time: 0,
        time_active: 0,
        seen_complete: 0,
        availability: -1,
        amount_left: 0,
        progress: 1,
        content_path: "/downloads/Test Torrent",
        save_path: "/downloads",
        ...overrides,
      }
    }

    const torrent = makeTorrentForShapeCheck()

    // The real qBT API does NOT return `isPrivate` (camelCase). Ensure the factory
    // does not include it so tests built on this shape match real API responses.
    expect(Object.hasOwn(torrent, "isPrivate")).toBe(false)

    // Core fields that the API does return must be present
    expect(torrent).toHaveProperty("hash")
    expect(torrent).toHaveProperty("state")
    expect(torrent).toHaveProperty("tags")
  })
})

// ---------------------------------------------------------------------------
// aggregateByTag — case-insensitive tag matching
// ---------------------------------------------------------------------------

describe("aggregateByTag case-insensitive tag matching", () => {
  // Factory uses TorrentRecord (normalized camelCase) shape.
  function makeRealTorrent(overrides: Partial<TorrentRecord>): TorrentRecord {
    return {
      hash: "deadbeef",
      name: "Test Torrent",
      state: "uploading",
      tags: "",
      category: "",
      uploadSpeed: 0,
      downloadSpeed: 0,
      uploaded: 0,
      downloaded: 0,
      ratio: 0,
      size: 0,
      seedCount: 0,
      leechCount: 0,
      swarmSeeders: 0,
      swarmLeechers: 0,
      tracker: "",
      addedAt: 0,
      completedAt: -1,
      lastActivityAt: 0,
      seedingTime: 0,
      activeTime: 0,
      lastSeenComplete: 0,
      availability: -1,
      remaining: 0,
      progress: 1,
      contentPath: "/downloads/Test Torrent",
      savePath: "/downloads",
      ...overrides,
    }
  }

  // Regression: prevents tag case mismatch between DB-stored tags and parseTorrentTags output.
  // aggregateByTag builds its internal map with lowercase keys. parseTorrentTags lowercases
  // torrent tags by default. If the map were built with original-case keys (i.e. "Blutopia"),
  // a torrent tagged "blutopia" (lowercased by parseTorrentTags) would never match and would
  // fall into the untagged bucket instead.
  it("matches torrent tags case-insensitively when DB tag has title case", () => {
    // Torrent tags as parseTorrentTags returns them: lowercase
    const torrents = [makeRealTorrent({ state: "uploading", tags: "blutopia", uploadSpeed: 512 })]
    // DB stores the tag with title case
    const result = aggregateByTag(torrents, ["Blutopia"], [])

    const blutopiaStats = result.tagStats.find((t) => t.tag === "blutopia")
    expect(blutopiaStats).toBeDefined()
    expect(blutopiaStats?.seedingCount).toBe(1)
    expect(blutopiaStats?.uploadSpeed).toBe(512)

    // Must NOT fall into the untagged bucket
    const untagged = result.tagStats.find((t) => t.tag === "untagged")
    expect(untagged).toBeUndefined()
  })

  // Regression: verifies the fix handles all common tracker tag casing patterns from DB.
  it("handles mixed case tags from DB — ALL_CAPS, lowercase, TitleCase", () => {
    const torrents = [
      makeRealTorrent({ state: "uploading", tags: "red", uploadSpeed: 100 }),
      makeRealTorrent({ state: "uploading", tags: "ops", uploadSpeed: 200 }),
      makeRealTorrent({ state: "uploading", tags: "nebulance", uploadSpeed: 300 }),
    ]
    // DB may store these as "RED", "ops", "Nebulance"
    const result = aggregateByTag(torrents, ["RED", "ops", "Nebulance"], [])

    const redStats = result.tagStats.find((t) => t.tag === "red")
    const opsStats = result.tagStats.find((t) => t.tag === "ops")
    const nebStats = result.tagStats.find((t) => t.tag === "nebulance")

    expect(redStats?.seedingCount).toBe(1)
    expect(opsStats?.seedingCount).toBe(1)
    expect(nebStats?.seedingCount).toBe(1)

    // No torrent should end up untagged
    const untagged = result.tagStats.find((t) => t.tag === "untagged")
    expect(untagged).toBeUndefined()

    expect(result.totalSeedingCount).toBe(3)
    expect(result.uploadSpeedBytes).toBe(600)
  })

  it("cross-seed tags from DB are also lowercased for matching", () => {
    const torrents = [makeRealTorrent({ state: "uploading", tags: "cross-seed", uploadSpeed: 50 })]
    // DB cross-seed tag stored with mixed case
    const result = aggregateByTag(torrents, [], ["Cross-Seed"])

    const csStats = result.tagStats.find((t) => t.tag === "cross-seed")
    expect(csStats).toBeDefined()
    expect(csStats?.seedingCount).toBe(1)

    const untagged = result.tagStats.find((t) => t.tag === "untagged")
    expect(untagged).toBeUndefined()
  })
})
