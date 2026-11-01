// src/lib/tracker-platforms/__tests__/funfile.test.ts
//
// Fixtures are synthetic, built after the site's markup with invented figures.

import { beforeEach, describe, expect, it, vi } from "vitest"
import { sanitizeNetworkError } from "@/lib/error-utils"
import { FunfileAdapter, parseFunfileCredentials, parseFunfilePage } from "../adapters/funfile"
import { CredentialsRejectedError, SessionExpiredError } from "../helpers/errors"

const BASE_URL = "https://www.funfile.org"
const HOST = "www.funfile.org"
const GiB = 2 ** 30
const PASSWORD = "s3cret-p@ss&"

function page(header: string, details: string): string {
  return `<!DOCTYPE html><html><head><title>FunFile</title></head><body>
<div class="menubox"><a href="https://www.funfile.org/logout.php"><b>Logout</b></a></div>
<div class="no_side"><div class="head_banner">
<div style="float: left;">
<a href="https://www.funfile.org/userdetails.php?id=1234" style="font-weight: bold;">someone</a>
<br />
${header}
</div>
<div style="clear:both;"></div><div><p>You need to <b>upload</b> another <b>25.000 GB</b> to reach the next class.</p></div></div>
<table class="mainframe"><tr><td class="mf_content">
<h1>Details for someone</h1>
<table>
${details}
</table>
</td></tr></table></div></body></html>`
}

const HEADER = `<b style="color: #666666;">Delusional</b>, 3 invites, <a href="https://www.funfile.org/mycredits.php">1,234.50 cr.</a>
</div>
<div style="float: right;">
Currently idle | Max 25 DL Slots
<br />
Total: <b>200.000 GB</b> up, <b>1.049 TB</b> down, <b>4.000</b> ratio`

const DETAILS = `<tr><td class="rowhead" >Join Date</td><td class="row1" >2020-01-02 03:04:05 (300 wks ago)</td></tr>
<tr><td class="rowhead" >Last Seen</td><td class="row1" >2026-10-20 10:00:00 (2 days ago) | Current Status: <span>Site</span></td></tr>
<tr><td class="rowhead" >Uploaded</td><td class="row1" >200.000 GB | Daily: 10.00 MB</td></tr>
<tr><td class="rowhead" >Downloaded</td><td class="row1" >50.000 GB | FreeLeech: 1.000 TB | Total: 1.049 TB | Daily: 5.00 MB</td></tr>
<tr><td class="rowhead" >Ratio</td><td class="row1" ><span>4.000</span></td></tr>
<tr><td class="rowhead" >Credits</td><td class="row1" ><a href="mycredits.php?view=history">1,234.50 cr.</a></td></tr>
<tr><td class="rowhead" >Class</td><td class="row1" ><b style="color: #666666">Delusional</b></td></tr>
<tr><td class="rowhead" >Comments</td><td class="row1" ><a href="../userhistory.php?action=viewcomments&amp;id=1234">7</a></td></tr>
<tr><td class="rowhead" >Posts</td><td class="row1" >2</td></tr>`

const PROFILE = page(HEADER, DETAILS)

const LOGIN_FORM = `<!DOCTYPE html><html><body><table><tr><td class="mf_content">
<form name="login" method="post" action="https://www.funfile.org/takelogin.php">
<input type="text" name="username" /><input type="password" name="password" />
</form></td></tr></table></body></html>`

interface Sent {
  url: string
  method: string
  cookie: string
  body?: string
}

type LoginOutcome = "ok" | "404" | "login-redirect" | "login-form"

/**
 * A FunFile in front of the adapter. A session is signed in when its cookies
 * include the pass cookie set by a successful login.
 */
function mockSite(login: LoginOutcome = "ok", options: { staySignedOut?: boolean } = {}): Sent[] {
  const sent: Sent[] = []
  vi.spyOn(global, "fetch").mockImplementation((async (input: string, init: RequestInit) => {
    const url = String(input)
    const headers = (init.headers ?? {}) as Record<string, string>
    const method = init.method ?? "GET"
    sent.push({ url, method, cookie: headers.Cookie ?? "", body: init.body as string | undefined })
    const signedIn = !options.staySignedOut && /pass=good/.test(headers.Cookie ?? "")

    if (url.endsWith("/takelogin.php")) {
      if (login === "404") return new Response("File not found.\n", { status: 404 })
      if (login === "login-form") return new Response(LOGIN_FORM, { status: 200 })
      const location = login === "login-redirect" ? "/login.php?returnto=" : "/index.php"
      const res = new Response(null, { status: 302, headers: { Location: location } })
      res.headers.append("Set-Cookie", "uid=1234; path=/; domain=.funfile.org")
      res.headers.append("Set-Cookie", "pass=good; path=/; domain=.funfile.org")
      return res
    }
    if (url.endsWith("/index.php")) {
      const res = new Response(signedIn ? PROFILE : LOGIN_FORM, { status: 200 })
      res.headers.append("Set-Cookie", "PHPSESSID=abc; path=/")
      return res
    }
    if (url.includes("/userdetails.php")) {
      if (!signedIn) {
        return new Response(null, {
          status: 302,
          headers: { Location: "https://www.funfile.org/login.php?returnto=%2Fuserdetails.php" },
        })
      }
      return new Response(PROFILE, { status: 200 })
    }
    return new Response("unexpected", { status: 500 })
  }) as unknown as typeof fetch)
  return sent
}

const creds = (username: string) => JSON.stringify({ username, password: PASSWORD })
const posts = (sent: Sent[]) => sent.filter((s) => s.method === "POST")

beforeEach(() => {
  vi.restoreAllMocks()
})

describe("parseFunfileCredentials", () => {
  it("keeps the password as typed", () => {
    expect(parseFunfileCredentials(JSON.stringify({ username: " a ", password: " b " }))).toEqual({
      username: "a",
      password: " b ",
    })
  })
})

describe("parseFunfilePage", () => {
  it("reads the header and the details table", () => {
    const stats = parseFunfilePage(PROFILE, HOST)
    expect(stats).toMatchObject({
      username: "someone",
      group: "Delusional",
      remoteUserId: 1234,
      seedbonus: 1234.5,
      seedingCount: 0,
      leechingCount: 0,
      joinedDate: "2020-01-02",
      lastAccessDate: "2026-10-20",
      warned: null,
    })
    expect(stats.platformMeta).toEqual({
      freeleechDownloadedBytes: 1024 * GiB,
      totalDownloadedBytes: Math.round(1.049 * 1024 * GiB),
      invites: 3,
      downloadSlots: 25,
      nextClassUploadBytes: 25 * GiB,
      posts: 2,
      comments: 7,
    })
  })

  it("counts only the non-freeleech download, as the site's ratio does", () => {
    const stats = parseFunfilePage(PROFILE, HOST)
    expect(stats.uploadedBytes).toBe(BigInt(200 * GiB))
    expect(stats.downloadedBytes).toBe(BigInt(50 * GiB))
    expect(stats.ratio).toBe(4)
  })

  it("reads no invites as zero", () => {
    const stats = parseFunfilePage(PROFILE.replace("3 invites", "no invites"), HOST)
    expect(stats.platformMeta).toMatchObject({ invites: 0 })
  })

  it("reads a page without the logout link as an expired session", () => {
    expect(() => parseFunfilePage(LOGIN_FORM, HOST)).toThrow(SessionExpiredError)
  })
})

describe("FunfileAdapter", () => {
  const adapter = new FunfileAdapter()

  it("logs in, keeps the cookies set across the redirect, and reuses the session", async () => {
    const sent = mockSite()

    const stats = await adapter.fetchStats(BASE_URL, creds("first"), "/userdetails.php")

    expect(stats.username).toBe("someone")
    expect(sent.map((s) => `${s.method} ${s.url}`)).toEqual([
      `POST ${BASE_URL}/takelogin.php`,
      `GET ${BASE_URL}/index.php`,
      `GET ${BASE_URL}/userdetails.php?id=1234`,
    ])
    expect(new URLSearchParams(sent[0].body)).toEqual(
      new URLSearchParams({ username: "first", password: PASSWORD, returnto: "", login: "Login" })
    )
    expect(sent[2].cookie).toBe("uid=1234; pass=good; PHPSESSID=abc")

    const again = mockSite()
    await adapter.fetchStats(BASE_URL, creds("first"), "/userdetails.php")
    expect(posts(again)).toEqual([])
  })

  it.each(["404", "login-redirect", "login-form"] as const)(
    "throws CredentialsRejectedError on a rejected login (%s), after one attempt",
    async (outcome) => {
      const sent = mockSite(outcome)

      const err = (await adapter
        .fetchStats(BASE_URL, creds(`rejected-${outcome}`), "/userdetails.php")
        .catch((e: unknown) => e)) as Error

      expect(err).toBeInstanceOf(CredentialsRejectedError)
      expect(err.message).not.toContain(PASSWORD)
      expect(posts(sent)).toHaveLength(1)
      expect(sanitizeNetworkError(err.message)).toBe(
        "FunFile login failed with the stored username and password. Polling was paused to avoid an IP ban"
      )
    }
  )

  it("logs in exactly once when the cached session has expired", async () => {
    mockSite()
    await adapter.fetchStats(BASE_URL, creds("expires"), "/userdetails.php")

    // The cached cookies now lead to the login page, as after a server-side logout.
    const sent = mockSite("ok")
    vi.mocked(global.fetch).mockImplementationOnce((async (input: string, init: RequestInit) => {
      sent.push({ url: String(input), method: init.method ?? "GET", cookie: "" })
      return new Response(null, { status: 302, headers: { Location: "/login.php?returnto=" } })
    }) as unknown as typeof fetch)

    const stats = await adapter.fetchStats(BASE_URL, creds("expires"), "/userdetails.php")

    expect(stats.username).toBe("someone")
    expect(posts(sent)).toHaveLength(1)
  })

  it("does not log in a second time when the new session is also signed out", async () => {
    const sent = mockSite("ok", { staySignedOut: true })

    await expect(
      adapter.fetchStats(BASE_URL, creds("signed-out"), "/userdetails.php")
    ).rejects.toBeDefined()

    expect(posts(sent)).toHaveLength(1)
  })

  it("keeps the password out of the debug view", async () => {
    mockSite("404")
    const calls = await adapter.fetchRaw(BASE_URL, creds("debug"), "/userdetails.php")

    expect(calls).toHaveLength(1)
    expect(calls[0].error).toMatch(/FunFile login failed/)
    expect(JSON.stringify(calls)).not.toContain(PASSWORD)
  })
})
