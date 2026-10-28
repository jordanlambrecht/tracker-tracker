// src/lib/tracker-platforms/__tests__/luminance.test.ts

import { beforeEach, describe, expect, it, vi } from "vitest"
import { sanitizeNetworkError } from "@/lib/error-utils"
import { proxyFetch } from "@/lib/tunnel"
import { DEFAULT_USER_AGENT } from "@/lib/user-agent"
import {
  flashMessages,
  LuminanceAdapter,
  parseLuminanceCredentials,
  parseLuminanceLoginToken,
  parseLuminanceProfile,
  parseLuminanceUserId,
} from "../adapters/luminance"
import { SessionExpiredError } from "../helpers/errors"

vi.mock("@/lib/tunnel", () => ({ proxyFetch: vi.fn() }))

const BASE = "https://www.cathode-ray.tube"
const HOST = "www.cathode-ray.tube"

const LOGIN_PAGE = `<form method="POST" action="/login" id="login_form">
  <input type="hidden" name="token" value="csrf-token" />
  <input type="text" name="username" /><input type="password" name="password" />
</form>`

const HOME_PAGE = `<div id="userinfo"><a class="username" href="/user.php?id=42">retrofan</a>
  <a id="nav_seeding" href="#"><span id="nav_seeding_r">12</span></a></div>`

const PROFILE_PAGE = `${HOME_PAGE}
<span class="rank">Retro Rookie</span>
<div id="bonusdiv"><h4>Credits: 1,234.5</h4></div>
<ul class="stats nobullet">
  <li>Joined: <span class="time" alt="Jan 01 2025, 00:00" title="Jan 01 2025, 00:00">1 year ago</span></li>
  <li>Last Seen: <span class="time" alt="Oct 01 2026, 09:30" title="Oct 01 2026, 09:30">Just now</span></li>
  <li>Uploaded: <span>150.00 GiB</span></li>
  <li>Downloaded: <span>50.00 GiB</span></li>
  <li>Ratio: <span class="r20">3.00</span></li>
  <li>Required ratio: 0.50</li>
  <li><a href="/userhistory.php?action=token_history&amp;userid=42">Tokens</a>: 3</li>
  <li>Seeding: 12 (80.00 GiB)</li>
</ul>`

const CREDS = JSON.stringify({ username: "retrofan", password: "pass" })

function html(body: string, setCookies: string[] = [], status = 200): Response {
  const headers = new Headers({ "content-type": "text/html" })
  for (const c of setCookies) headers.append("set-cookie", c)
  return new Response(body, { status, headers })
}

function redirect(location: string, setCookies: string[] = [], status = 303): Response {
  const headers = new Headers({ location })
  for (const c of setCookies) headers.append("set-cookie", c)
  return new Response(null, { status, headers })
}

describe("Luminance parsing", () => {
  it("parses credentials", () => {
    expect(parseLuminanceCredentials(CREDS)).toEqual({
      username: "retrofan",
      password: "pass",
    })
    expect(() => parseLuminanceCredentials("{}")).toThrow()
  })

  it("reads the login form token and the user id", () => {
    expect(parseLuminanceLoginToken(LOGIN_PAGE)).toBe("csrf-token")
    expect(parseLuminanceUserId(HOME_PAGE, HOST)).toBe(42)
  })

  it("maps the profile page into TrackerStats", () => {
    const stats = parseLuminanceProfile(PROFILE_PAGE, HOST, 42)
    expect(stats.username).toBe("retrofan")
    expect(stats.group).toBe("Retro Rookie")
    expect(stats.uploadedBytes).toBe(150n * 1024n ** 3n)
    expect(stats.downloadedBytes).toBe(50n * 1024n ** 3n)
    expect(stats.ratio).toBe(3)
    expect(stats.seedingCount).toBe(12)
    expect(stats.leechingCount).toBeNull()
    expect(stats.seedbonus).toBe(1234.5)
    expect(stats.remoteUserId).toBe(42)
    expect(stats.requiredRatio).toBe(0.5)
    expect(stats.freeleechTokens).toBe(3)
    expect(stats.joinedDate).toBe("2025-01-01 00:00")
    expect(stats.lastAccessDate).toBe("2026-10-01 09:30")
    expect(stats.hitAndRuns).toBeNull()
    expect(stats.warned).toBeNull()
  })

  it("leaves dates unset when a time title is not in the site's format", () => {
    const page = PROFILE_PAGE.replace('title="Jan 01 2025, 00:00"', 'title="soon"')
    const stats = parseLuminanceProfile(page, HOST)
    expect(stats.joinedDate).toBeUndefined()
    expect(stats.lastAccessDate).toBe("2026-10-01 09:30")
  })

  // A month the table does not know would otherwise index to 0 and store a
  // date in month 00.
  it("leaves a date unset when its month name is not one the site prints", () => {
    const page = PROFILE_PAGE.replace('title="Jan 01 2025, 00:00"', 'title="Foo 01 2025, 00:00"')
    expect(parseLuminanceProfile(page, HOST).joinedDate).toBeUndefined()
  })

  it("falls back to the stats list for class and seeding", () => {
    const page = `<a class="username" href="/user.php?id=1">x</a><ul class="stats">
      <li>Class: Analog Ace</li><li>Uploaded: 1 GiB</li><li>Downloaded: 0 B</li>
      <li>Seeding: 7 (1 GiB)</li></ul>`
    const stats = parseLuminanceProfile(page, HOST)
    expect(stats.group).toBe("Analog Ace")
    expect(stats.seedingCount).toBe(7)
  })

  it("reports no class rather than an empty one when the page shows none", () => {
    const page = `<a class="username" href="/user.php?id=1">x</a><span class="rank"> </span>
      <ul class="stats"><li>Uploaded: 1 GiB</li><li>Downloaded: 0 B</li></ul>`
    expect(parseLuminanceProfile(page, HOST).group).toBeNull()
  })

  it("fails rather than reporting zero when a byte total is unreadable", () => {
    const read = () => parseLuminanceProfile(PROFILE_PAGE.replace("150.00 GiB", "n/a"), HOST)
    expect(read).toThrow(/unreadable Uploaded/)
    // The host is what makes the card read it as an unexpected response.
    expect(read).toThrow(`Unexpected response from ${HOST}:`)
  })

  it("treats the login form served in place of the profile as an expired session", () => {
    expect(() => parseLuminanceProfile(LOGIN_PAGE, HOST)).toThrow(SessionExpiredError)
  })

  // Only the login form means the session is gone. Calling a redesign or a
  // maintenance page an expiry posts the password again on every poll.
  it("reads a page that is neither the profile nor the login form as an unexpected response", () => {
    const reshaped = `${HOME_PAGE}<ul class="profile-stats"><li>Uploaded: 150.00 GiB</li></ul>`
    const read = () => parseLuminanceProfile(reshaped, HOST)
    expect(read).toThrow(`Unexpected response from ${HOST}:`)
    expect(read).not.toThrow(SessionExpiredError)
  })

  it("treats a home page with no user id as an unexpected response unless it is the login form", () => {
    const read = () => parseLuminanceUserId("<html>Down for maintenance</html>", HOST)
    expect(read).toThrow(`Unexpected response from ${HOST}:`)
    expect(read).not.toThrow(SessionExpiredError)
    expect(() => parseLuminanceUserId(LOGIN_PAGE, HOST)).toThrow(SessionExpiredError)
  })
})

describe("LuminanceAdapter", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.mocked(proxyFetch).mockReset()
    ;(globalThis as { __trackerLoginSessions?: Map<string, string> }).__trackerLoginSessions?.clear()
  })

  it("logs in with the form token and reads the profile", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(html(LOGIN_PAGE, ["cid=client; path=/"]))
      .mockResolvedValueOnce(redirect("/", ["sid=session; path=/; httponly"]))
      .mockResolvedValueOnce(html(HOME_PAGE))
      .mockResolvedValueOnce(html(PROFILE_PAGE))

    const stats = await new LuminanceAdapter().fetchStats(BASE, CREDS, "/user.php")

    expect(stats.username).toBe("retrofan")
    const [loginUrl, loginInit] = fetchSpy.mock.calls[1]
    expect(loginUrl).toBe(`${BASE}/login`)
    const body = new URLSearchParams(String(loginInit?.body))
    expect(body.get("token")).toBe("csrf-token")
    expect(body.get("username")).toBe("retrofan")
    expect(body.get("keeploggedin")).toBe("1")
    expect(body.get("cinfo")?.split("|")).toHaveLength(5)
    const loginHeaders = loginInit?.headers as Record<string, string> | undefined
    expect(loginHeaders?.Cookie).toBe("cid=client")
    expect(fetchSpy.mock.calls[3][0]).toBe(`${BASE}/user.php?id=42`)
    const profileHeaders = fetchSpy.mock.calls[3][1]?.headers as Record<string, string>
    expect(profileHeaders.Cookie).toBe("cid=client; sid=session")
    expect(profileHeaders["User-Agent"]).toBe(DEFAULT_USER_AGENT)
    expect(loginHeaders?.["User-Agent"]).toBe(DEFAULT_USER_AGENT)
    // Navigation headers belong with a browser's User-Agent, not the app's.
    expect(profileHeaders["Sec-Fetch-Mode"]).toBeUndefined()
  })

  it("reuses the session instead of logging in on every poll", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(html(LOGIN_PAGE, ["cid=client"]))
      .mockResolvedValueOnce(redirect("/", ["sid=session"]))
      .mockResolvedValueOnce(html(PROFILE_PAGE))
      .mockResolvedValueOnce(html(PROFILE_PAGE))
    const adapter = new LuminanceAdapter()

    await adapter.fetchStats(BASE, CREDS, "/user.php", { remoteUserId: 42 })
    await adapter.fetchStats(BASE, CREDS, "/user.php", { remoteUserId: 42 })

    expect(fetchSpy).toHaveBeenCalledTimes(4)
  })

  it("logs in again when the cached session has expired", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(html(LOGIN_PAGE, ["cid=client"]))
      .mockResolvedValueOnce(redirect("/", ["sid=old"]))
      .mockResolvedValueOnce(html(PROFILE_PAGE))
      .mockResolvedValueOnce(html(LOGIN_PAGE))
      .mockResolvedValueOnce(html(LOGIN_PAGE, ["cid=client"]))
      .mockResolvedValueOnce(redirect("/", ["sid=new"]))
      .mockResolvedValueOnce(html(PROFILE_PAGE))
    const adapter = new LuminanceAdapter()

    await adapter.fetchStats(BASE, CREDS, "/user.php", { remoteUserId: 42 })
    const stats = await adapter.fetchStats(BASE, CREDS, "/user.php", { remoteUserId: 42 })

    expect(stats.username).toBe("retrofan")
    expect(fetchSpy).toHaveBeenCalledTimes(7)
  })

  it("reports a wrong password as invalid credentials, without the tracker's text", async () => {
    const flash = encodeURIComponent(JSON.stringify([{ message: "Invalid username or password" }]))
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(html(LOGIN_PAGE, ["cid=client"]))
      .mockResolvedValueOnce(redirect("/login", [`flashes=${flash}; path=/`]))

    const err = await failure(new LuminanceAdapter().fetchStats(BASE, CREDS, "/user.php"))

    expect(err.message).toBe("Invalid Luminance credentials")
    expect(sanitizeNetworkError(err.message, "Poll failed")).toBe("Invalid credentials")
  })

  it("reads the flash cookie Luminance writes, rawurlencoded JSON", () => {
    const json = JSON.stringify([{ message: "Unsupported platform", severity: "error" }])
    expect(flashMessages(encodeURIComponent(json))).toEqual(["Unsupported platform"])
    expect(flashMessages("deleted")).toEqual([])
  })

  it("reads a bounce to the login page with no flash as a wrong password", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(html(LOGIN_PAGE, ["cid=client"]))
      .mockResolvedValueOnce(redirect("/login"))

    await expect(new LuminanceAdapter().fetchStats(BASE, CREDS, "/user.php")).rejects.toThrow(
      "Invalid Luminance credentials"
    )
  })

  it("returns the parsed profile for the debug view", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(html(LOGIN_PAGE, ["cid=client"]))
      .mockResolvedValueOnce(redirect("/", ["sid=session"]))
      .mockResolvedValueOnce(html(PROFILE_PAGE))

    const calls = await new LuminanceAdapter().fetchRaw(BASE, CREDS, "/user.php", {
      remoteUserId: 42,
    })

    expect(calls).toHaveLength(1)
    expect(calls[0].error).toBeNull()
    expect(calls[0].data).toMatchObject({ username: "retrofan" })
    expect(calls[0].endpoint).toBe("/user.php?id=42")
  })

  it("reports the error instead of throwing when the login fails", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(html(LOGIN_PAGE, ["cid=client"]))
      .mockResolvedValueOnce(redirect("/login"))

    const [call, profile] = await new LuminanceAdapter().fetchRaw(BASE, CREDS, "/user.php")

    expect(call.data).toBeNull()
    expect(call.error).toBe("Invalid Luminance credentials")
    expect(profile.error).toMatch(/^Skipped/)
  })

  it("names two-factor login as the cause, and the card does not give TorrentLeech's advice", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(html(LOGIN_PAGE, ["cid=client"]))
      .mockResolvedValueOnce(redirect("/twofactor/login", ["sid=half"]))

    const err = await failure(new LuminanceAdapter().fetchStats(BASE, CREDS, "/user.php"))

    expect(err.message).toBe("Luminance login refused: the account uses two-factor login")
    expect(sanitizeNetworkError(err.message, "Poll failed")).toBe(
      "Two-factor login is on for this account. Add a session cookie from a browser login to the tracker's credentials"
    )
  })
})

/** The rejection a promise ends in, for asserting on its message and its card. */
async function failure(promise: Promise<unknown>): Promise<Error> {
  const err = await promise.then(
    () => null,
    (e: unknown) => e
  )
  if (!(err instanceof Error)) throw new Error("expected a rejection")
  return err
}

function loginPosts(spy: { mock: { calls: unknown[][] } }): number {
  return spy.mock.calls.filter(
    ([url, init]) => String(url).endsWith("/login") && (init as RequestInit)?.method === "POST"
  ).length
}

describe("LuminanceAdapter login outcomes", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.mocked(proxyFetch).mockReset()
    ;(globalThis as { __trackerLoginSessions?: Map<string, string> }).__trackerLoginSessions?.clear()
  })

  function loginAnswers(post: Response, form: Response = html(LOGIN_PAGE, ["cid=client"])) {
    return vi.spyOn(global, "fetch").mockResolvedValueOnce(form).mockResolvedValueOnce(post)
  }

  // Each needs a different action from the user, and none of them is a wrong
  // password, so each has its own fixed message and card.
  it.each([
    [
      "/disabled",
      "Luminance login refused: the account is disabled",
      "Account is disabled on the tracker. Log in on the site to see why",
    ],
    [
      "/reactivate",
      "Luminance login refused: the account is disabled",
      "Account is disabled on the tracker. Log in on the site to see why",
    ],
    [
      "/pwned",
      "Luminance login refused: the password is in a known breach",
      "Tracker refused the password as breached. Change it on the site, then update it here",
    ],
  ])("reads a redirect to %s by its path", async (location, message, card) => {
    loginAnswers(redirect(location))

    const err = await failure(new LuminanceAdapter().fetchStats(BASE, CREDS, "/user.php"))

    expect(err.message).toBe(message)
    expect(sanitizeNetworkError(err.message, "Poll failed")).toBe(card)
  })

  // Luminance refuses a login whose client details look scripted with the same
  // bounce as a wrong password. Sending the user to change a working password
  // would not help.
  it("does not call a refused client-details check a wrong password", async () => {
    const flash = encodeURIComponent(
      JSON.stringify([{ message: "Unsupported platform", severity: "error" }])
    )
    loginAnswers(redirect("/login", [`flashes=${flash}; path=/`]))

    const err = await failure(new LuminanceAdapter().fetchStats(BASE, CREDS, "/user.php"))

    expect(err.message).toBe(
      `Unexpected response from ${HOST}: the login refused the client details`
    )
    expect(sanitizeNetworkError(err.message, "Poll failed")).toBe(
      "Tracker returned an unexpected response"
    )
  })

  // Flash text is the tracker's. Passed through, words in it such as "requires
  // 2FA" pick the card, and it reaches the events feed and webhooks.
  it("never puts the tracker's flash text, the Location or cookie names in a message", async () => {
    const flash = encodeURIComponent(
      JSON.stringify([{ message: "Your IP requires 2FA verification, contact staff" }])
    )
    loginAnswers(redirect("/login?from=xyz", [`flashes=${flash}; path=/`, "tracecookie=1"]))

    const err = await failure(new LuminanceAdapter().fetchStats(BASE, CREDS, "/user.php"))

    expect(err.message).not.toMatch(/requires 2FA|staff|from=xyz|tracecookie|flashes/)
    expect(sanitizeNetworkError(err.message, "Poll failed")).toBe("Invalid credentials")
  })

  it("reads a login that sets no session and names no refusal as an unexpected response", async () => {
    loginAnswers(redirect("/"))

    const err = await failure(new LuminanceAdapter().fetchStats(BASE, CREDS, "/user.php"))

    expect(err.message).toBe(`Unexpected response from ${HOST}: the login answered without a session`)
  })

  // A 5xx or a 429 says nothing about the password. Reported as a refused
  // login, the card sends the user to re-enter one that works.
  it.each([
    [503, "Service Unavailable", "post"],
    [500, "Internal Server Error", "post"],
    [429, "Too Many Requests", "form"],
    [503, "Service Unavailable", "form"],
  ] as const)("reports a %i on the login %s by its status", async (status, statusText, step) => {
    const down = new Response("<h1>Down for maintenance</h1>", { status, statusText })
    const spy =
      step === "form" ? loginAnswers(down, down) : loginAnswers(down, html(LOGIN_PAGE, ["cid=c"]))

    const err = await failure(new LuminanceAdapter().fetchStats(BASE, CREDS, "/user.php"))

    expect(err.message).toBe(`Tracker API error: ${status} ${statusText}`)
    expect(sanitizeNetworkError(err.message, "Poll failed")).toBe(`API returned ${status}`)
    if (step === "form") expect(loginPosts(spy)).toBe(0)
  })

  it.each(["form", "post"] as const)(
    "names a Cloudflare challenge on the login %s",
    async (step) => {
      const challenge = html("<html><head><title>Just a moment...</title></head></html>", [], 503)
      if (step === "form") loginAnswers(challenge, challenge)
      else loginAnswers(challenge)

      const err = await failure(new LuminanceAdapter().fetchStats(BASE, CREDS, "/user.php"))

      expect(err.message).toBe("Cloudflare challenge detected on the Luminance login page")
      expect(sanitizeNetworkError(err.message, "Poll failed")).toBe(
        "Cloudflare challenge blocked the request"
      )
    }
  )
})

describe("LuminanceAdapter sessions", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.mocked(proxyFetch).mockReset()
    ;(globalThis as { __trackerLoginSessions?: Map<string, string> }).__trackerLoginSessions?.clear()
  })

  // Each login is a new keep-logged-in session on the account, and Luminance
  // logs them. A page the parser cannot read must cost no login at all.
  it.each([
    [
      "the profile page changes shape",
      `${HOME_PAGE}<ul class="profile-stats"><li>Uploaded: 150.00 GiB</li></ul>`,
      42,
    ],
    ["the home page carries no user id", "<html>Down for maintenance</html>", undefined],
  ])("does not log in again when %s", async (_case, page, remoteUserId) => {
    const spy = vi.spyOn(global, "fetch").mockImplementation(async (url, init) => {
      if (String(url).endsWith("/login")) {
        return init?.method === "POST" ? redirect("/", ["sid=s"]) : html(LOGIN_PAGE, ["cid=c"])
      }
      return html(page)
    })
    const adapter = new LuminanceAdapter()
    const errors: string[] = []

    for (let poll = 0; poll < 3; poll++) {
      await adapter
        .fetchStats(BASE, CREDS, "/user.php", { remoteUserId })
        .catch((e: Error) => errors.push(e.message))
    }

    expect(loginPosts(spy)).toBe(1)
    expect(errors).toHaveLength(3)
    expect(sanitizeNetworkError(errors[0], "Poll failed")).toBe(
      "Tracker returned an unexpected response"
    )
  })

  // The connection test authenticates through the same cache, so a session the
  // right password opened must not pass a wrong one.
  it("logs in again for a different password instead of reusing the session", async () => {
    const spy = vi.spyOn(global, "fetch").mockImplementation(async (url, init) => {
      if (String(url).endsWith("/login")) {
        return init?.method === "POST" ? redirect("/", ["sid=s"]) : html(LOGIN_PAGE, ["cid=c"])
      }
      return html(PROFILE_PAGE)
    })
    const adapter = new LuminanceAdapter()
    const wrong = JSON.stringify({ username: "retrofan", password: "WRONG" })

    await adapter.fetchStats(BASE, CREDS, "/user.php", { remoteUserId: 42 })
    await adapter.fetchStats(BASE, wrong, "/user.php", { remoteUserId: 42 })

    expect(loginPosts(spy)).toBe(2)
  })

  it("logs in again when a page bounces to the login page", async () => {
    const spy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(html(LOGIN_PAGE, ["cid=client"]))
      .mockResolvedValueOnce(redirect("/", ["sid=old"]))
      .mockResolvedValueOnce(redirect("/login"))
      .mockResolvedValueOnce(html(LOGIN_PAGE, ["cid=client"]))
      .mockResolvedValueOnce(redirect("/", ["sid=new"]))
      .mockResolvedValueOnce(html(PROFILE_PAGE))

    const stats = await new LuminanceAdapter().fetchStats(BASE, CREDS, "/user.php", {
      remoteUserId: 42,
    })

    expect(stats.username).toBe("retrofan")
    expect(loginPosts(spy)).toBe(2)
  })

  // Luminance answers a dead sid with back(), a 302 to the site root that
  // deletes the cookie. Resending the same cookie there only loops, so the
  // root has to read as an expiry.
  it("logs in again when the tracker sends a dead session back to the site root", async () => {
    let sessions = 0
    const spy = vi.spyOn(global, "fetch").mockImplementation(async (url, init) => {
      if (String(url).endsWith("/login")) {
        return init?.method === "POST"
          ? redirect("/", [`sid=s${++sessions}`])
          : html(LOGIN_PAGE, ["cid=c"])
      }
      const cookie = (init?.headers as Record<string, string> | undefined)?.Cookie ?? ""
      return cookie.includes("sid=s1") ? redirect("/", ["sid=deleted"], 302) : html(PROFILE_PAGE)
    })

    const stats = await new LuminanceAdapter().fetchStats(BASE, CREDS, "/user.php", {
      remoteUserId: 42,
    })

    expect(stats.username).toBe("retrofan")
    expect(loginPosts(spy)).toBe(2)
  })

  it("follows a redirect to another page of the site without logging in again", async () => {
    const spy = vi.spyOn(global, "fetch").mockImplementation(async (url, init) => {
      const target = String(url)
      if (target.endsWith("/login")) {
        return init?.method === "POST" ? redirect("/", ["sid=s"]) : html(LOGIN_PAGE, ["cid=c"])
      }
      return target.endsWith("/user.php?id=42") ? redirect("/user/42", [], 301) : html(PROFILE_PAGE)
    })

    const stats = await new LuminanceAdapter().fetchStats(BASE, CREDS, "/user.php", {
      remoteUserId: 42,
    })

    expect(stats.username).toBe("retrofan")
    expect(loginPosts(spy)).toBe(1)
    expect(String(spy.mock.calls.at(-1)?.[0])).toBe(`${BASE}/user/42`)
  })

  it("lists the user id lookup as its own debug call", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(html(LOGIN_PAGE, ["cid=client"]))
      .mockResolvedValueOnce(redirect("/", ["sid=session"]))
      .mockResolvedValueOnce(html(HOME_PAGE))
      .mockResolvedValueOnce(html(PROFILE_PAGE))

    const calls = await new LuminanceAdapter().fetchRaw(BASE, CREDS, "/user.php")

    expect(calls.map((c) => [c.label, c.endpoint, c.error])).toEqual([
      ["Home Page", "/", null],
      ["Profile", "/user.php?id=42", null],
    ])
    expect(calls[0].data).toEqual({ userId: 42 })
  })
})

describe("LuminanceAdapter through a proxy", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.mocked(proxyFetch).mockReset()
    ;(globalThis as { __trackerLoginSessions?: Map<string, string> }).__trackerLoginSessions?.clear()
  })

  function proxied(status: number, body: string, headers: Record<string, string | string[]> = {}) {
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: "",
      headers,
      json: async () => ({}),
      text: async () => body,
      buffer: async () => Buffer.from(body),
    }
  }

  it("logs in through the proxy, keeping its Set-Cookie and sending the app User-Agent", async () => {
    vi.mocked(proxyFetch)
      .mockResolvedValueOnce(proxied(200, LOGIN_PAGE, { "set-cookie": ["cid=client; path=/"] }))
      .mockResolvedValueOnce(proxied(303, "", { location: "/", "set-cookie": ["sid=session"] }))
      .mockResolvedValueOnce(proxied(200, PROFILE_PAGE))
    const fetchSpy = vi.spyOn(global, "fetch")

    const stats = await new LuminanceAdapter().fetchStats(BASE, CREDS, "/user.php", {
      proxyAgent: {} as never,
      remoteUserId: 42,
    })

    expect(stats.username).toBe("retrofan")
    expect(fetchSpy).not.toHaveBeenCalled()
    const [post, profile] = [
      vi.mocked(proxyFetch).mock.calls[1],
      vi.mocked(proxyFetch).mock.calls[2],
    ]
    expect(post[2]?.method).toBe("POST")
    expect(post[2]?.headers?.["User-Agent"]).toBe(DEFAULT_USER_AGENT)
    expect(profile[2]?.headers?.Cookie).toBe("cid=client; sid=session")
  })

  it("words a proxied login timeout as a timeout naming the host", async () => {
    vi.mocked(proxyFetch).mockRejectedValueOnce(new Error("Request timed out after 15000ms"))

    const err = await failure(
      new LuminanceAdapter().fetchStats(BASE, CREDS, "/user.php", { proxyAgent: {} as never })
    )

    expect(err.message).toBe(`Request to ${HOST} timed out (via proxy)`)
    expect(sanitizeNetworkError(err.message, "Poll failed")).toBe("Request timed out")
  })

  // https-proxy-agent hands a refused CONNECT back as the response, and its
  // reason phrase is what names the proxy on the card.
  it("reports a proxy that wants its own credentials as a proxy problem", async () => {
    vi.mocked(proxyFetch).mockResolvedValueOnce({
      ...proxied(407, "<h1>407 Proxy Authentication Required</h1>"),
      statusText: "Proxy Authentication Required",
    })

    const err = await failure(
      new LuminanceAdapter().fetchStats(BASE, CREDS, "/user.php", { proxyAgent: {} as never })
    )

    expect(err.message).toBe("Tracker API error: 407 Proxy Authentication Required")
    expect(sanitizeNetworkError(err.message, "Poll failed")).toBe("Proxy connection failed")
  })
})

describe("LuminanceAdapter with a pasted session cookie", () => {
  const UA = "Mozilla/5.0 (X11; Linux x86_64) Firefox/131.0"
  const COOKIE_CREDS = JSON.stringify({ username: "retrofan", cookies: "sid=abc; cid=def", userAgent: UA })

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.mocked(proxyFetch).mockReset()
  })

  it("parses a pasted session, with no password key", () => {
    expect(parseLuminanceCredentials(COOKIE_CREDS)).toStrictEqual({
      username: "retrofan",
      cookies: "sid=abc; cid=def",
      userAgent: UA,
    })
  })

  it("refuses a cookie without sid, or without the browser's User-Agent", () => {
    expect(() =>
      parseLuminanceCredentials(JSON.stringify({ username: "u", cookies: "cid=1", userAgent: UA }))
    ).toThrow("no sid cookie")
    expect(() =>
      parseLuminanceCredentials(JSON.stringify({ username: "u", cookies: "sid=1" }))
    ).toThrow("userAgent cannot be empty")
    expect(() => parseLuminanceCredentials(JSON.stringify({ username: "u" }))).toThrow(
      "must contain password"
    )
  })

  // The session was issued to that browser, so the poll has to look like it.
  it("never logs in, and sends the stored browser User-Agent with navigation headers", async () => {
    const spy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(html(HOME_PAGE))
      .mockResolvedValueOnce(html(PROFILE_PAGE))

    const stats = await new LuminanceAdapter().fetchStats(BASE, COOKIE_CREDS, "/user.php")

    expect(stats.username).toBe("retrofan")
    expect(loginPosts(spy)).toBe(0)
    expect(spy.mock.calls.map(([url]) => String(url))).toEqual([
      `${BASE}/`,
      `${BASE}/user.php?id=42`,
    ])
    const headers = spy.mock.calls[1][1]?.headers as Record<string, string>
    expect(headers.Cookie).toBe("sid=abc; cid=def")
    expect(headers["User-Agent"]).toBe(UA)
    expect(headers["Sec-Fetch-Mode"]).toBe("navigate")
  })

  it("asks for a fresh cookie when the pasted session has expired, without trying to log in", async () => {
    const spy = vi.spyOn(global, "fetch").mockResolvedValueOnce(redirect("/login"))

    const err = await failure(
      new LuminanceAdapter().fetchStats(BASE, COOKIE_CREDS, "/user.php", { remoteUserId: 42 })
    )

    expect(err).toBeInstanceOf(SessionExpiredError)
    expect(err.message).toBe(
      "Session expired. Paste a fresh session cookie from a browser login into this tracker's credentials"
    )
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it("asks for a fresh cookie when the tracker sends the pasted session back to the site root", async () => {
    const spy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(redirect("/", ["sid=deleted"], 302))

    const err = await failure(
      new LuminanceAdapter().fetchStats(BASE, COOKIE_CREDS, "/user.php", { remoteUserId: 42 })
    )

    expect(err).toBeInstanceOf(SessionExpiredError)
    expect(sanitizeNetworkError(err.message, "Poll failed")).toBe("Session expired")
    expect(spy).toHaveBeenCalledTimes(1)
  })
})
