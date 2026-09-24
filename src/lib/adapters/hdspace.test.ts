// src/lib/adapters/hdspace.test.ts

import { beforeEach, describe, expect, it, vi } from "vitest"
import { HdspaceAdapter, parseHdspaceCredentials, parseHdspaceProfile } from "./hdspace"

// Trimmed from a real HD-Space "User Control Panel" page (xbtit markup, 2026-09).
// Numbers changed; structure — unclosed <td>s, <font> tags, icon images between
// the active-torrent counts — is what the site actually emits.
const PANEL_HTML = `<!DOCTYPE html><html><head><title>HD-Space - Sharing The Universe .::. Index->My Panel</title></head><body>
<table class="lista" cellpadding="0" cellspacing="0" width="100%" align="center"><tr>
<td class="" align="center" style="text-align:center;">Welcome back <span style='color:#F5FFFA'>deusx</span> <a href="logout.php">(Logout)</a></td>
<td class="" align="center" style="text-align:center;"><align=center class=>Last access:<font color=steelblue> 23/09/2026 21:41:18</font></td>
<td align='center' style='text-align:center'> Site Free Leech: <font color='red'>Not Active</font> </td>
<td align="center"><td class='' align='center' style='text-align:center'>Active Torrents : <b><img src='images/actseed.png'> <font color="green">16</font> <img src='images/actleech.png'> <font color="red">0</font></b></td>
</tr></table>
<table class="lista" border="0" width="100%" cellpadding="4" cellspacing="1"><tr>
<td style="text-align:center;" align="center">Rank: HD Spacer</td>
<td class="green" align="center"> UP: 22.01 GB</td><td class="red" align="center"> DL: 10.90 MB</td><td class="yellow" align="center"> Ratio: 2,067.83</td>
<td class="green" align="center"><a href=index.php?page=modules&module=seedbonus>Bonus: 11,673.65</a></td>
<td style="text-align:center;" align="center"><a href="index.php?page=usercp&amp;uid=260903">My Panel</a></td>
</tr></table>
<table><tr><td class="header" align="left">User:</td><td class="lista" align="left">deusx</td></tr>
<tr><td class="header" align="left">Rank:</td><td class="lista" align="left">HD Spacer</td></tr>
<tr><td class="header" align="left">Joined on:</td><td class="lista" colspan="2" align="left">September 03, 2026,&nbsp;17:10:02&nbsp;</td></tr>
<tr><td class="header" align="left">Last access:</td><td class="lista" colspan="2" align="left"><b>Today</b> at&nbsp;02:41:18&nbsp;</td></tr></table>
</body></html>`

const CREDS = JSON.stringify({
  cookies: "cf_clearance=abc.def-ghi; PHPSESSID=s3ss10n; uid=260903; pass=deadbeef",
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0.0.0",
})

function htmlResponse(body: string, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "OK",
    headers: new Headers(),
    text: async () => body,
  } as Response
}

describe("parseHdspaceProfile", () => {
  it("reads the xbtit header block, the username and the panel's joined date", () => {
    const stats = parseHdspaceProfile(PANEL_HTML)
    expect(stats.username).toBe("deusx")
    expect(stats.group).toBe("HD Spacer")
    // xbtit's "GB"/"MB" are binary: 22.01 GiB and 10.90 MiB (the site's own ratio, 2,067.83, proves it)
    const up = 23_633_057_546n // 22.01 × 1024³, truncated
    const dl = 11_429_478n // 10.90 × 1024², truncated
    expect(stats.uploadedBytes).toBe(up)
    expect(stats.downloadedBytes).toBe(dl)
    expect(stats.ratio).toBeCloseTo(2067.7, 0) // the site shows 2,067.83 from exact bytes; the header rounds to 2 dp
    expect(stats.bufferBytes).toBe(up - dl)
    expect(stats.seedingCount).toBe(16)
    expect(stats.leechingCount).toBe(0)
    expect(stats.seedbonus).toBeCloseTo(11673.65)
    expect(stats.remoteUserId).toBe(260903)
    expect(stats.joinedDate).toBe("2026-09-03T17:10:02.000Z")
    expect(stats.hitAndRuns).toBeNull()
    expect(stats.warned).toBeNull()
    expect(stats.requiredRatio).toBeNull()
    expect(stats.freeleechTokens).toBeNull()
  })

  it("derives Infinity for a zero-download account", () => {
    const stats = parseHdspaceProfile(PANEL_HTML.replace("DL: 10.90 MB", "DL: 0.00 KB"))
    expect(stats.downloadedBytes).toBe(0n)
    expect(stats.ratio).toBe(Infinity)
  })

  it("treats a page without the logout link as an expired session", () => {
    const html = `<html><body><form action="index.php?page=login"><input name="uid"><input name="pwd"></form></body></html>`
    expect(() => parseHdspaceProfile(html)).toThrow(/Session expired/)
  })

  it("recognises a Cloudflare challenge page before anything else", () => {
    const html = `<html><head><title>Just a moment...</title></head><body><script>cf_chl_opt={}</script></body></html>`
    expect(() => parseHdspaceProfile(html)).toThrow(/Cloudflare/)
  })

  it("fails loudly when the header block is missing from an authenticated page", () => {
    const html = `<html><body>Welcome back <span>deusx</span> <a href="logout.php">(Logout)</a><p>maintenance</p></body></html>`
    expect(() => parseHdspaceProfile(html)).toThrow(/Could not find UP/)
  })
})

describe("parseHdspaceCredentials", () => {
  it("accepts a cookies/userAgent JSON blob and strips a pasted 'Cookie:' prefix", () => {
    const creds = parseHdspaceCredentials(
      JSON.stringify({ cookies: "Cookie: cf_clearance=x; uid=1; pass=y", userAgent: " UA " })
    )
    expect(creds).toEqual({ cookies: "cf_clearance=x; uid=1; pass=y", userAgent: "UA" })
  })

  it("rejects a bare API key", () => {
    expect(() => parseHdspaceCredentials("abc123")).toThrow(/HD-Space credentials/)
  })
})

describe("HdspaceAdapter", () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal("fetch", fetchMock)
  })

  it("fetches the user panel with the pasted cookies and the browser's User-Agent", async () => {
    fetchMock.mockResolvedValueOnce(htmlResponse(PANEL_HTML))

    const stats = await new HdspaceAdapter().fetchStats(
      "https://hd-space.org",
      CREDS,
      "/index.php?page=usercp"
    )

    expect(stats.username).toBe("deusx")
    expect(stats.group).toBe("HD Spacer")
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("https://hd-space.org/index.php?page=usercp")
    expect(init.headers.Cookie).toBe("cf_clearance=abc.def-ghi; PHPSESSID=s3ss10n; uid=260903; pass=deadbeef")
    expect(init.headers["User-Agent"]).toBe("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0.0.0")
    expect(init.headers["Sec-Fetch-Mode"]).toBe("navigate")
  })

  it("reports a redirect to the login page as an expired session", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 302,
      statusText: "Found",
      headers: new Headers({ location: "https://hd-space.org/index.php?page=login" }),
      text: async () => "",
    } as Response)

    await expect(
      new HdspaceAdapter().fetchStats("https://hd-space.org", CREDS, "/index.php?page=usercp")
    ).rejects.toThrow(/Session expired/)
  })

  it("surfaces a Cloudflare challenge as a cf_clearance problem", async () => {
    fetchMock.mockResolvedValueOnce(
      htmlResponse(`<html><head><title>Just a moment...</title></head><body>cf_chl_opt</body></html>`)
    )
    await expect(
      new HdspaceAdapter().fetchStats("https://hd-space.org", CREDS, "")
    ).rejects.toThrow(/cf_clearance/)
  })

  it("fetchRaw returns the parsed stats or the error without throwing", async () => {
    fetchMock.mockResolvedValueOnce(htmlResponse(PANEL_HTML))
    const ok = await new HdspaceAdapter().fetchRaw("https://hd-space.org", CREDS, "")
    expect(ok[0].error).toBeNull()
    expect((ok[0].data as { username: string }).username).toBe("deusx")

    fetchMock.mockResolvedValueOnce(htmlResponse("<html><body>nope</body></html>"))
    const bad = await new HdspaceAdapter().fetchRaw("https://hd-space.org", CREDS, "")
    expect(bad[0].data).toBeNull()
    expect(bad[0].error).toMatch(/Session expired/)
  })
})
