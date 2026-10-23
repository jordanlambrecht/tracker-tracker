// src/lib/tracker-platforms/__tests__/luminance.test.ts

import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_USER_AGENT } from "@/lib/user-agent"
import {
  flashMessages,
  LuminanceAdapter,
  parseLuminanceCredentials,
  parseLuminanceLoginToken,
  parseLuminanceProfile,
  parseLuminanceUserId,
} from "../adapters/luminance"

const BASE = "https://www.cathode-ray.tube"

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

function html(body: string, setCookies: string[] = []): Response {
  const headers = new Headers({ "content-type": "text/html" })
  for (const c of setCookies) headers.append("set-cookie", c)
  return new Response(body, { status: 200, headers })
}

function redirect(location: string, setCookies: string[] = []): Response {
  const headers = new Headers({ location })
  for (const c of setCookies) headers.append("set-cookie", c)
  return new Response(null, { status: 303, headers })
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
    expect(parseLuminanceUserId(HOME_PAGE)).toBe(42)
  })

  it("maps the profile page into TrackerStats", () => {
    const stats = parseLuminanceProfile(PROFILE_PAGE, 42)
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
  })

  it("leaves dates unset when a time title is not in the site's format", () => {
    const page = PROFILE_PAGE.replace('title="Jan 01 2025, 00:00"', 'title="soon"')
    const stats = parseLuminanceProfile(page)
    expect(stats.joinedDate).toBeUndefined()
    expect(stats.lastAccessDate).toBe("2026-10-01 09:30")
  })

  it("falls back to the stats list for class and seeding", () => {
    const page = `<a class="username" href="/user.php?id=1">x</a><ul class="stats">
      <li>Class: Analog Ace</li><li>Uploaded: 1 GiB</li><li>Downloaded: 0 B</li>
      <li>Seeding: 7 (1 GiB)</li></ul>`
    const stats = parseLuminanceProfile(page)
    expect(stats.group).toBe("Analog Ace")
    expect(stats.seedingCount).toBe(7)
  })

  it("reports no class rather than an empty one when the page shows none", () => {
    const page = `<a class="username" href="/user.php?id=1">x</a><span class="rank"> </span>
      <ul class="stats"><li>Uploaded: 1 GiB</li><li>Downloaded: 0 B</li></ul>`
    expect(parseLuminanceProfile(page).group).toBeNull()
  })

  it("fails rather than reporting zero when a byte total is unreadable", () => {
    expect(() => parseLuminanceProfile(PROFILE_PAGE.replace("150.00 GiB", "n/a"))).toThrow(
      /unreadable Uploaded/
    )
  })

  it("treats a page without profile stats as an expired session", () => {
    expect(() => parseLuminanceProfile(LOGIN_PAGE)).toThrow(/^Session expired/)
  })
})

describe("LuminanceAdapter", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    ;(globalThis as { __luminanceSessions?: Map<string, string> }).__luminanceSessions?.clear()
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

  it("reports Luminance's own reason when the login fails", async () => {
    const flash = encodeURIComponent(JSON.stringify([{ message: "Invalid username or password" }]))
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(html(LOGIN_PAGE, ["cid=client"]))
      .mockResolvedValueOnce(redirect("/login", [`flashes=${flash}; path=/`]))

    await expect(new LuminanceAdapter().fetchStats(BASE, CREDS, "/user.php")).rejects.toThrow(
      "Luminance login failed: Invalid username or password"
    )
  })

  it("reads flash messages however the cookie value is encoded", () => {
    const json = JSON.stringify([{ message: "Unsupported platform", severity: "error" }])
    expect(flashMessages(json)).toEqual(["Unsupported platform"])
    expect(flashMessages(encodeURIComponent(json))).toEqual(["Unsupported platform"])
    expect(flashMessages(encodeURIComponent(json).replace(/%20/g, "+"))).toEqual([
      "Unsupported platform",
    ])
    expect(flashMessages("deleted")).toEqual([])
  })

  it("reports where the login went when there is no message", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(html(LOGIN_PAGE, ["cid=client"]))
      .mockResolvedValueOnce(redirect("/login"))

    await expect(new LuminanceAdapter().fetchStats(BASE, CREDS, "/user.php")).rejects.toThrow(
      "Luminance login failed: redirected to /login (cookies: none)"
    )
  })

  it("returns the parsed profile for the debug view", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(html(LOGIN_PAGE, ["cid=client"]))
      .mockResolvedValueOnce(redirect("/", ["sid=session"]))
      .mockResolvedValueOnce(html(PROFILE_PAGE))

    const [call] = await new LuminanceAdapter().fetchRaw(BASE, CREDS, "/user.php", {
      remoteUserId: 42,
    })

    expect(call.error).toBeNull()
    expect(call.data).toMatchObject({ username: "retrofan" })
  })

  it("reports the error instead of throwing when the login fails", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(html(LOGIN_PAGE, ["cid=client"]))
      .mockResolvedValueOnce(redirect("/login"))

    const [call] = await new LuminanceAdapter().fetchRaw(BASE, CREDS, "/user.php")

    expect(call.data).toBeNull()
    expect(call.error).toMatch(/^Luminance login failed/)
  })

  it("reports that 2FA is not supported", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(html(LOGIN_PAGE, ["cid=client"]))
      .mockResolvedValueOnce(redirect("/twofactor/login", ["sid=half"]))

    await expect(new LuminanceAdapter().fetchStats(BASE, CREDS, "/user.php")).rejects.toThrow(/2FA/)
  })
})
