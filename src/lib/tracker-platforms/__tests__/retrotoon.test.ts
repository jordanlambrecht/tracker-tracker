// src/lib/tracker-platforms/__tests__/retrotoon.test.ts

import { parse as parseHtml } from "node-html-parser"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  extractOwnUserId,
  parseRetrotoonBonus,
  parseRetrotoonCredentials,
  parseRetrotoonHitAndRuns,
  parseRetrotoonHnrTokens,
  parseRetrotoonProfile,
  RetrotoonAdapter,
} from "../adapters/retrotoon"
import type { RetrotoonPlatformMeta } from "../contract"
import { SessionExpiredError } from "../helpers/errors"

const HOST = "retrotoon.world"

const VALID_TOKEN = JSON.stringify({
  cookies: "PHPSESSID=0123456789abcdef0123456789abcdef",
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) TestUA",
})

// ---------------------------------------------------------------------------
// Rebuilt from a live capture rather than pasted, since the real page embeds
// the passkey and IP log. The fidelity tests below pin what the parser relies on.
// ---------------------------------------------------------------------------

const PAGE_HEAD = `<!DOCTYPE html>
<html><head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<title>RetroToon World :: Details for ToonCollector</title>
<link rel="shortcut icon" href="/favicon.ico" type="image/x-icon">
</head><body>
<table class=mainouter width="100%" border=0 cellspacing=0 cellpadding=0><tr><td class=clear>
<table class=main border=0 cellspacing=0 cellpadding=0>
<tr><td class=navigation align=center>
<a href="index.php">Home</a> <a href="browse.php">Browse</a> <a href="upload.php">Upload</a>
<a href="forums.php">Forum</a> <a href="requests.php">Requests</a>
<a href="statistics.php">Stats</a> <a href="staff.php">Staff</a>
</td></tr>
`

const HEADER_STRIP = `<tr><td class='clear'>
  <div>
    Hello: <b><a href="userdetails.php?id=4242">ToonCollector</a></b>
    (Toon)
    [<a href="userdetails.php?id=4242">Profile</a>]
    [<a href="myhr.php">Hit&amp;run</a>]
    [<a href="achievements.php">Achievements</a>]
    [<a href="logout.php">Logout</a>]
  </div>
  <div>
    <b><font color='#0000AA'>Ratio:</font> &infin;</b>
    <b><font color='#008000'>Uploaded:</font> 2.10 GB</b>
    <b><font color='#AA0000'>Downloaded:</font> 0.00 kB</b>
    <a href='bonus.php'><b><font color='#7a5c00'>Bonus:</font> 0</b></a>
  </div>
</td></tr>
`

const PAGE_FOOT = `</table></td></tr></table>
<div class="dc-status-container state-ok"><span class="status-dot"></span>All Systems Operational</div>
</body></html>`

/** Owner's own userdetails.php table, 17 rowhead rows as the server sends it. */
const PROFILE_ROWS = `<tr><td class=clear>
<div class="rt-form-card"><h2>ToonCollector</h2>
<table class=main width="100%" border=1 cellspacing=0 cellpadding=5>
<tr><td class='rowhead'>Join&nbsp;date</td><td align='left'>2026-08-02 19:56:52 (4 weeks ago)</td></tr>
<tr><td class='rowhead'>Last&nbsp;seen</td><td align='left'>2026-08-31 17:49:11 (3 min ago)</td></tr>
<tr><td class=rowhead>Activity</td><td align=left>Average browsing on RetroToon 1 minutes a day.</td></tr>
<tr><td class=rowhead>IP Log</td><td align=left><table><tr><td>2026-08-31 17:49:11 (3 min afo)</td><td>192.0.2.10 (host.example.net)</td></tr></table><a href="javascript:void(0);">[Show / Hide]</a></td></tr>
<tr><td class="rowhead">Passkey</td><td align="left">00000000000000000000000000000000 <a href="javascript:void(0);">Copy</a></td></tr>
<tr><td class='rowhead'>Bonus points</td><td align='left'>0.0</td></tr>
<tr><td class='rowhead'>Freeleech slots</td><td align='left'>0</td></tr>
<tr><td class=rowhead><nobr>Bonus log<div id="nobonus"></div></nobr></td><td align=left>[See the list]</td></tr>
<tr><td class=rowhead>Uploaded</td><td align=left>2.10 GB</td></tr>
<tr><td class=rowhead>Downloaded</td><td align=left>0.00 kB</td></tr>
<tr><td class=rowhead>Class</td><td align=left>Toon</td></tr>
<tr><td class=rowhead>Torrent comments</td><td align=left>0</td></tr>
<tr><td class=rowhead>Forum posts</td><td align=left>0</td></tr>
<tr><td class=rowhead>Bulk .torrent download</td><td align=left><a href="bulk.php">Download my torrents</a>Grab a ZIP of your full snatchlist.</td></tr>
<tr><td class=rowhead>Snatchlist&nbsp;(0)</td><td align=left>No snatches found for this user.</td></tr>
<tr><td class=rowhead>Uploaded&nbsp;(0)</td><td align=left>This user hasn't uploaded any torrents yet.</td></tr>
<tr><td class=rowhead>Seeding&nbsp;(Loading)</td><td align=left></td></tr>
</table></div></td></tr>
`

const PROFILE_PAGE = PAGE_HEAD + HEADER_STRIP + PROFILE_ROWS + PAGE_FOOT

/**
 * Same shape with real traffic on it, to exercise the paths a fresh account
 * cannot reach: grouping commas, a finite ratio, a promoted class, and a
 * populated snatch/upload count.
 */
const ACTIVE_PROFILE_PAGE =
  PAGE_HEAD +
  HEADER_STRIP.replace("2.10 GB", "12,345.67 GB").replace("0.00 kB", "9,876.54 GB") +
  PROFILE_ROWS.replace(">2.10 GB<", ">12,345.67 GB<")
    .replace(">0.00 kB<", ">9,876.54 GB<")
    .replace(">Toon<", ">Toon Hero<")
    .replace("Snatchlist&nbsp;(0)", "Snatchlist&nbsp;(1,204)")
    .replace("Uploaded&nbsp;(0)", "Uploaded&nbsp;(37)")
    // Distinct values: every count is 0 on the fresh account, so swapping two
    // field assignments in the parser would otherwise go undetected.
    .replace(">Torrent comments</td><td align=left>0<", ">Torrent comments</td><td align=left>18<")
    .replace(">Forum posts</td><td align=left>0<", ">Forum posts</td><td align=left>452<")
    .replace(
      ">0.0</td></tr>\n<tr><td class='rowhead'>Freeleech slots",
      ">1,250.5</td></tr>\n<tr><td class='rowhead'>Freeleech slots"
    ) +
  PAGE_FOOT

/** staff.php: the header greeting is ours, the listed profile links are not. */
const STAFF_PAGE =
  PAGE_HEAD +
  HEADER_STRIP +
  `<tr><td class=clear><div class="rt-form-card">
    <a href="userdetails.php?id=1">StaffOne</a>
    <a href="userdetails.php?id=42">SomeoneElse</a>
  </div></td></tr>
` +
  PAGE_FOOT

/**
 * A member link before the greeting. The live pages happen to put the header
 * first, so no real capture distinguishes the anchored regex from a naive
 * "first userdetails.php link" match. This pins the anchor's intent explicitly.
 */
const LINK_BEFORE_GREETING_PAGE =
  PAGE_HEAD +
  `<tr><td class=clear>Toon of the day uploaded by <a href="userdetails.php?id=99">StaffOne</a></td></tr>
` +
  HEADER_STRIP +
  PROFILE_ROWS +
  PAGE_FOOT

const LOGIN_PAGE = `<!DOCTYPE html><html><head><title>RetroToon World :: Login</title></head>
<body><form action="takelogin.php" method="post"><input name="username"></form></body></html>`

const CLOUDFLARE_PAGE = `<!DOCTYPE html><html><head><title>Just a moment...</title></head>
<body><script>window._cf_chl_opt={};</script></body></html>`

const BONUS_PAGE =
  PAGE_HEAD +
  HEADER_STRIP +
  `<tr><td class=clear>
  <div class="bp-stat-card"><div class="bp-stat-label">Balance</div><div class="bp-stat-value">0.0</div><div>bonus points</div></div>
  <div class="bp-stat-card"><div class="bp-stat-label">Earning Rate</div><div class="bp-stat-value">0.00</div><div>points / hour</div></div>
  <div class="bp-stat-card"><div class="bp-stat-label">Active Seeds</div><div class="bp-stat-value">0</div><div>torrents seeding</div></div>
  <div class="bp-stat-card"><div class="bp-stat-label">Daily Estimate</div><div class="bp-stat-value">0.0</div><div>points / day</div></div>
</td></tr>
` +
  PAGE_FOOT

const ACTIVE_BONUS_PAGE = BONUS_PAGE.replace(
  '<div class="bp-stat-label">Active Seeds</div><div class="bp-stat-value">0</div>',
  '<div class="bp-stat-label">Active Seeds</div><div class="bp-stat-value">1,337</div>'
).replace(
  '<div class="bp-stat-label">Earning Rate</div><div class="bp-stat-value">0.00</div>',
  '<div class="bp-stat-label">Earning Rate</div><div class="bp-stat-value">42.75</div>'
)

const HNR_PAGE_CLEAN =
  PAGE_HEAD +
  HEADER_STRIP +
  `<tr><td class=clear>
  <div class="rt-form-card">
    <div class="rt-section-head">&#128737; H&amp;R Cleanup Tokens</div>
    <div>0 tokens available. &mdash; Earn tokens from the Bonus Shop.</div>
  </div>
  <div class="rt-form-card">
    <div class="rt-section-head">Pending Hit &amp; Runs</div>
    <div>&#10003; You have no pending Hit &amp; Runs. Nice work!</div>
  </div>
</td></tr>
` +
  PAGE_FOOT

/** Same page with the empty-state sentence gone, standing in for a shape we have never seen. */
const HNR_PAGE_POPULATED = HNR_PAGE_CLEAN.replace(
  "<div>&#10003; You have no pending Hit &amp; Runs. Nice work!</div>",
  "<table><tr><td>Some.Cartoon.1954</td><td>12h / 72h</td></tr></table>"
).replace("0 tokens available", "3 tokens available")

// ---------------------------------------------------------------------------

describe("parseRetrotoonCredentials", () => {
  it("accepts a well-formed blob and returns the cookies verbatim", () => {
    expect(parseRetrotoonCredentials(VALID_TOKEN)).toEqual({
      cookies: "PHPSESSID=0123456789abcdef0123456789abcdef",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) TestUA",
    })
  })

  it("strips a copied 'Cookie: ' prefix", () => {
    const token = JSON.stringify({ cookies: "Cookie: PHPSESSID=abc123", userAgent: "UA" })
    expect(parseRetrotoonCredentials(token).cookies).toBe("PHPSESSID=abc123")
  })

  it("rejects a bare cookie name pasted instead of the header value", () => {
    const token = JSON.stringify({ cookies: "PHPSESSID", userAgent: "UA" })
    expect(() => parseRetrotoonCredentials(token)).toThrow(/pasted a cookie name/i)
  })

  it("rejects a DevTools-truncated value containing an ellipsis", () => {
    const token = JSON.stringify({ cookies: "PHPSESSID=abc…", userAgent: "UA" })
    expect(() => parseRetrotoonCredentials(token)).toThrow(/non-ASCII character/i)
  })

  it("rejects a string with no key=value pair", () => {
    const token = JSON.stringify({ cookies: "not-a-cookie", userAgent: "UA" })
    expect(() => parseRetrotoonCredentials(token)).toThrow(/key=value pairs/i)
  })

  it("rejects a non-JSON token and names both required fields", () => {
    expect(() => parseRetrotoonCredentials("rt_plain_api_key")).toThrow(
      /RetroToon World credentials must be a JSON object with cookies and userAgent/
    )
  })

  it("rejects a blob missing userAgent", () => {
    expect(() => parseRetrotoonCredentials(JSON.stringify({ cookies: "a=b" }))).toThrow(
      /must contain cookies \(string\) and userAgent \(string\)/
    )
  })
})

describe("fixture fidelity against the live capture", () => {
  // The fixtures above are hand-rebuilt, so they are only worth as much as
  // their agreement with the real pages. These lists are transcribed from the
  // live retrotoon.world DOM on 2026-08-31, with the account identity replaced.
  // If someone edits a fixture into a shape the site never serves, this fails.
  const normalize = (value: string) => value.replace(/\s+/g, " ").trim()

  function rowheadPairs(html: string): string[] {
    const doc = parseHtml(html)
    return doc.querySelectorAll("td.rowhead").map((cell) => {
      const label = normalize(cell.textContent ?? "")
      // Redacted in the fixture and ignored by the parser.
      if (label === "Passkey" || label === "IP Log") return label
      return `${label} => ${normalize(cell.nextElementSibling?.textContent ?? "")}`
    })
  }

  it("reproduces all 17 profile rows exactly as the server sends them", () => {
    expect(rowheadPairs(PROFILE_PAGE)).toEqual([
      "Join date => 2026-08-02 19:56:52 (4 weeks ago)",
      "Last seen => 2026-08-31 17:49:11 (3 min ago)",
      "Activity => Average browsing on RetroToon 1 minutes a day.",
      "IP Log",
      "Passkey",
      "Bonus points => 0.0",
      "Freeleech slots => 0",
      "Bonus log => [See the list]",
      "Uploaded => 2.10 GB",
      "Downloaded => 0.00 kB",
      "Class => Toon",
      "Torrent comments => 0",
      "Forum posts => 0",
      "Bulk .torrent download => Download my torrentsGrab a ZIP of your full snatchlist.",
      "Snatchlist (0) => No snatches found for this user.",
      "Uploaded (0) => This user hasn't uploaded any torrents yet.",
      // Empty value cell: the count arrives later from ajax_peers.php.
      "Seeding (Loading) => ",
    ])
  })

  it("keeps the U+00A0 the site puts inside its labels", () => {
    // The raw label is "Join date". If a fixture edit replaced it with a
    // plain space the parser would still pass, and the real page would not.
    expect(PROFILE_PAGE).toContain("Join&nbsp;date")
    expect(PROFILE_PAGE).toContain("Snatchlist&nbsp;(0)")
    const joinLabel = parseHtml(PROFILE_PAGE).querySelector("td.rowhead")?.textContent ?? ""
    expect(joinLabel).toBe("Join date")
  })

  it("keeps all three attribute-quoting styles the page mixes", () => {
    expect(PROFILE_PAGE).toContain("class='rowhead'")
    expect(PROFILE_PAGE).toContain('class="rowhead"')
    expect(PROFILE_PAGE).toContain("class=rowhead>")
  })

  it("reproduces the four bonus-shop stat cards", () => {
    const cards = parseHtml(BONUS_PAGE)
      .querySelectorAll(".bp-stat-card")
      .map(
        (c) =>
          `${normalize(c.querySelector(".bp-stat-label")?.textContent ?? "")} => ${normalize(
            c.querySelector(".bp-stat-value")?.textContent ?? ""
          )}`
      )
    expect(cards).toEqual([
      "Balance => 0.0",
      "Earning Rate => 0.00",
      "Active Seeds => 0",
      "Daily Estimate => 0.0",
    ])
  })

  it("reproduces the hit-and-run card headings and empty-state sentence", () => {
    const headings = parseHtml(HNR_PAGE_CLEAN)
      .querySelectorAll("div.rt-form-card")
      .map((c) => normalize(c.querySelector(".rt-section-head")?.textContent ?? ""))
    expect(headings).toEqual(["🛡 H&R Cleanup Tokens", "Pending Hit & Runs"])
    expect(normalize(parseHtml(HNR_PAGE_CLEAN).textContent ?? "")).toContain(
      "You have no pending Hit & Runs. Nice work!"
    )
  })

  it("keeps the header strip's ∞ ratio, which the parser must not trust", () => {
    expect(normalize(parseHtml(PROFILE_PAGE).textContent ?? "")).toContain(
      "Ratio: ∞ Uploaded: 2.10 GB Downloaded: 0.00 kB Bonus: 0"
    )
  })
})

describe("extractOwnUserId", () => {
  it("reads the id out of the header greeting", () => {
    expect(extractOwnUserId(PROFILE_PAGE)).toBe(4242)
  })

  it("ignores other members' profile links on a page that lists users", () => {
    // The greeting comes first in the document, so a naive "first
    // userdetails.php link" match would still work here; the anchor on
    // "Hello:" is what guarantees it.
    expect(extractOwnUserId(STAFF_PAGE)).toBe(4242)
  })

  it("returns undefined on a page with no greeting", () => {
    expect(extractOwnUserId(LOGIN_PAGE)).toBeUndefined()
  })

  it("is anchored on the greeting, not on the first profile link in the page", () => {
    // Dropping the "Hello:" anchor makes this return 99, another member's id,
    // and every later poll would then scrape the wrong user's profile.
    expect(extractOwnUserId(LINK_BEFORE_GREETING_PAGE)).toBe(4242)
  })
})

describe("parseRetrotoonProfile", () => {
  it("parses every field off a fresh account's profile", () => {
    const stats = parseRetrotoonProfile(PROFILE_PAGE, HOST)

    expect(stats.username).toBe("ToonCollector")
    expect(stats.group).toBe("Toon")
    expect(stats.uploadedBytes).toBe(2_100_000_000n)
    expect(stats.downloadedBytes).toBe(0n)
    expect(stats.bufferBytes).toBe(2_100_000_000n)
    expect(stats.joinedDate).toBe("2026-08-02")
    expect(stats.lastAccessDate).toBe("2026-08-31")
    expect(stats.seedbonus).toBe(0)
    expect(stats.freeleechTokens).toBe(0)
  })

  it("derives an infinite ratio from the byte totals rather than the header's ∞", () => {
    expect(parseRetrotoonProfile(PROFILE_PAGE, HOST).ratio).toBe(Number.POSITIVE_INFINITY)
  })

  it("reports every unpublished figure as null, never as a measured zero", () => {
    const stats = parseRetrotoonProfile(PROFILE_PAGE, HOST)

    // Filled in from bonus.php by the adapter, not by this parser.
    expect(stats.seedingCount).toBeNull()
    // Not published anywhere on the site.
    expect(stats.leechingCount).toBeNull()
    expect(stats.requiredRatio).toBeNull()
    expect(stats.warned).toBeNull()
    // Comes from myhr.php.
    expect(stats.hitAndRuns).toBeNull()
  })

  it("keeps the byte row and the torrent-count row apart despite near-identical labels", () => {
    const stats = parseRetrotoonProfile(PROFILE_PAGE, HOST)
    const meta = stats.platformMeta as RetrotoonPlatformMeta

    // "Uploaded" is 2.10 GB; "Uploaded (0)" is a torrent count. Reading the
    // latter as a byte total would silently zero the account's upload.
    expect(stats.uploadedBytes).toBe(2_100_000_000n)
    expect(meta.uploadedTorrents).toBe(0)
    expect(meta.snatched).toBe(0)
  })

  it("collects the community counts into platformMeta", () => {
    const meta = parseRetrotoonProfile(PROFILE_PAGE, HOST).platformMeta as RetrotoonPlatformMeta
    expect(meta).toEqual({
      snatched: 0,
      uploadedTorrents: 0,
      torrentComments: 0,
      forumPosts: 0,
    })
  })

  it("handles grouping commas, a finite ratio, and a promoted class", () => {
    const stats = parseRetrotoonProfile(ACTIVE_PROFILE_PAGE, HOST)
    const meta = stats.platformMeta as RetrotoonPlatformMeta

    expect(stats.group).toBe("Toon Hero")
    expect(stats.uploadedBytes).toBe(12_345_670_000_000n)
    expect(stats.downloadedBytes).toBe(9_876_540_000_000n)
    expect(stats.ratio).toBeCloseTo(1.2499, 3)
    expect(stats.bufferBytes).toBe(2_469_130_000_000n)
    expect(stats.seedbonus).toBe(1250.5)
    expect(meta.snatched).toBe(1204)
    expect(meta.uploadedTorrents).toBe(37)
    expect(meta.torrentComments).toBe(18)
    expect(meta.forumPosts).toBe(452)
  })

  it("parses the site's lower-case kB unit", () => {
    // parseBytes' decimal table is case-sensitive (KB), the site prints kB.
    expect(parseRetrotoonProfile(PROFILE_PAGE, HOST).downloadedBytes).toBe(0n)
    const page = PROFILE_PAGE.replace(">0.00 kB<", ">512.00 kB<")
    expect(parseRetrotoonProfile(page, HOST).downloadedBytes).toBe(512_000n)
  })

  it("throws session-expired on a page with no logout link", () => {
    expect(() => parseRetrotoonProfile(LOGIN_PAGE, HOST)).toThrow(/Session expired/)
  })

  it("prefers the Cloudflare message over the generic session one", () => {
    expect(() => parseRetrotoonProfile(CLOUDFLARE_PAGE, HOST)).toThrow(
      /Cloudflare challenge detected/
    )
  })

  it("throws when an authenticated page carries no profile table", () => {
    expect(() => parseRetrotoonProfile(STAFF_PAGE, HOST)).toThrow(
      "Unexpected response from retrotoon.world: Could not find profile stats on the RetroToon page. The page may not be authenticated"
    )
  })

  it("throws naming the uploaded total when only the Downloaded row can be read", () => {
    // A petabyte cell sits outside tryParseSiteBytes' unit table, so the row is
    // present and still unreadable.
    const page = PROFILE_PAGE.replace(">2.10 GB<", ">2.10 PB<")
    expect(() => parseRetrotoonProfile(page, HOST)).toThrow(
      "Unexpected response from retrotoon.world: unreadable uploaded byte total"
    )
  })

  it("throws naming the downloaded total when only the Uploaded row can be read", () => {
    const page = PROFILE_PAGE.replace(">0.00 kB<", ">1.50 PB<")
    expect(() => parseRetrotoonProfile(page, HOST)).toThrow(
      "Unexpected response from retrotoon.world: unreadable downloaded byte total"
    )
  })
})

describe("parseRetrotoonBonus", () => {
  it("reads the seeding count and earning rate off the stat cards", () => {
    expect(parseRetrotoonBonus(BONUS_PAGE)).toEqual({ seedingCount: 0, bonusPerHour: 0 })
  })

  it("strips grouping commas from a real seeding count", () => {
    expect(parseRetrotoonBonus(ACTIVE_BONUS_PAGE)).toEqual({
      seedingCount: 1337,
      bonusPerHour: 42.75,
    })
  })

  it("returns a null seeding count when the card is absent rather than guessing zero", () => {
    const page = BONUS_PAGE.replace(/<div class="bp-stat-card">[\s\S]*?<\/div><\/div>/g, "")
    expect(parseRetrotoonBonus(page).seedingCount).toBeNull()
  })

  it("throws session-expired on a login page", () => {
    expect(() => parseRetrotoonBonus(LOGIN_PAGE)).toThrow(/Session expired/)
  })
})

describe("parseRetrotoonHitAndRuns", () => {
  it("reports a verified zero from the empty-state sentence", () => {
    expect(parseRetrotoonHitAndRuns(HNR_PAGE_CLEAN)).toBe(0)
  })

  it("reports unknown, not zero, when the card holds something it has not seen", () => {
    // The populated markup has never been observed on a live account. Guessing
    // a count here would feed an invented number into the health tiers.
    expect(parseRetrotoonHitAndRuns(HNR_PAGE_POPULATED)).toBeNull()
  })

  it("reports unknown when the card is missing entirely", () => {
    expect(parseRetrotoonHitAndRuns(PROFILE_PAGE)).toBeNull()
  })
})

describe("parseRetrotoonHnrTokens", () => {
  it("reads the cleanup-token count", () => {
    expect(parseRetrotoonHnrTokens(HNR_PAGE_CLEAN)).toBe(0)
    expect(parseRetrotoonHnrTokens(HNR_PAGE_POPULATED)).toBe(3)
  })

  it("returns undefined when the sentence is absent", () => {
    expect(parseRetrotoonHnrTokens(PROFILE_PAGE)).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------

function okPage(html: string): Response {
  return { ok: true, status: 200, text: async () => html } as Response
}

describe("RetrotoonAdapter.fetchStats", () => {
  const adapter = new RetrotoonAdapter()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("fetches bonus, profile and hit-and-run pages and merges them", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(okPage(ACTIVE_BONUS_PAGE))
      .mockResolvedValueOnce(okPage(PROFILE_PAGE))
      .mockResolvedValueOnce(okPage(HNR_PAGE_CLEAN))

    const stats = await adapter.fetchStats("https://retrotoon.world", VALID_TOKEN, "")

    expect(fetchSpy.mock.calls.map((c) => c[0])).toEqual([
      "https://retrotoon.world/bonus.php",
      "https://retrotoon.world/userdetails.php?id=4242",
      "https://retrotoon.world/myhr.php",
    ])
    expect(stats.username).toBe("ToonCollector")
    expect(stats.seedingCount).toBe(1337)
    expect(stats.hitAndRuns).toBe(0)
    expect(stats.remoteUserId).toBe(4242)
    expect(stats.platformMeta as RetrotoonPlatformMeta).toMatchObject({
      bonusPerHour: 42.75,
      hnrCleanupTokens: 0,
      snatched: 0,
    })
  })

  it("sends the pasted cookies and the copied User-Agent on the wire", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(okPage(BONUS_PAGE))
      .mockResolvedValueOnce(okPage(PROFILE_PAGE))
      .mockResolvedValueOnce(okPage(HNR_PAGE_CLEAN))

    await adapter.fetchStats("https://retrotoon.world", VALID_TOKEN, "")

    const headers = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>
    expect(headers.Cookie).toBe("PHPSESSID=0123456789abcdef0123456789abcdef")
    expect(headers["User-Agent"]).toBe("Mozilla/5.0 (Windows NT 10.0; Win64; x64) TestUA")
  })

  it("uses a cached remoteUserId instead of the greeting", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(okPage(BONUS_PAGE))
      .mockResolvedValueOnce(okPage(PROFILE_PAGE))
      .mockResolvedValueOnce(okPage(HNR_PAGE_CLEAN))

    const stats = await adapter.fetchStats("https://retrotoon.world", VALID_TOKEN, "", {
      remoteUserId: 9001,
    })

    expect(fetchSpy.mock.calls[1][0]).toBe("https://retrotoon.world/userdetails.php?id=9001")
    expect(stats.remoteUserId).toBe(9001)
  })

  it("keeps the poll alive when the hit-and-run page fails", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(okPage(ACTIVE_BONUS_PAGE))
      .mockResolvedValueOnce(okPage(PROFILE_PAGE))
      .mockRejectedValueOnce(new Error("boom"))

    const stats = await adapter.fetchStats("https://retrotoon.world", VALID_TOKEN, "")

    expect(stats.uploadedBytes).toBe(2_100_000_000n)
    expect(stats.seedingCount).toBe(1337)
    // Unknown rather than a fabricated zero.
    expect(stats.hitAndRuns).toBeNull()
  })

  it("fails the poll when the hit-and-run page is a login page served with 200", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(okPage(ACTIVE_BONUS_PAGE))
      .mockResolvedValueOnce(okPage(PROFILE_PAGE))
      .mockResolvedValueOnce(okPage(LOGIN_PAGE))

    await expect(
      adapter.fetchStats("https://retrotoon.world", VALID_TOKEN, "")
    ).rejects.toBeInstanceOf(SessionExpiredError)
  })

  it("throws without fetching the profile when the greeting is missing", async () => {
    // Authenticated (the logout link is there) but with no "Hello:" greeting.
    const noGreeting = `${PAGE_HEAD}<tr><td class=clear><a href="logout.php">Logout</a></td></tr>${PAGE_FOOT}`
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce(okPage(noGreeting))

    await expect(adapter.fetchStats("https://retrotoon.world", VALID_TOKEN, "")).rejects.toThrow(
      "Unexpected response from retrotoon.world: Could not find the account greeting on the RetroToon page. The page may not be authenticated"
    )
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it("reports a session problem when the bonus page is a login page served with 200", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce(okPage(LOGIN_PAGE))

    await expect(
      adapter.fetchStats("https://retrotoon.world", VALID_TOKEN, "")
    ).rejects.toBeInstanceOf(SessionExpiredError)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it("throws session-expired when a 302 points at the login page", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { location: "/login.php" } })
    )

    await expect(adapter.fetchStats("https://retrotoon.world", VALID_TOKEN, "")).rejects.toThrow(
      "Session expired. Browser cookies need to be refreshed"
    )
  })

  it("refuses to follow a redirect off the tracker's origin", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { location: "https://evil.example/steal" } })
    )

    await expect(adapter.fetchStats("https://retrotoon.world", VALID_TOKEN, "")).rejects.toThrow(
      /redirected off-site; refusing to send credentials/
    )
  })

  it("ignores a stale persisted apiPath", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(okPage(BONUS_PAGE))
      .mockResolvedValueOnce(okPage(PROFILE_PAGE))
      .mockResolvedValueOnce(okPage(HNR_PAGE_CLEAN))

    await adapter.fetchStats("https://retrotoon.world", VALID_TOKEN, "/api/user")

    expect(fetchSpy.mock.calls[1][0]).toBe("https://retrotoon.world/userdetails.php?id=4242")
  })
})

describe("RetrotoonAdapter.fetchRaw", () => {
  const adapter = new RetrotoonAdapter()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("returns one entry per page with the parsed payload", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(okPage(ACTIVE_BONUS_PAGE))
      .mockResolvedValueOnce(okPage(PROFILE_PAGE))
      .mockResolvedValueOnce(okPage(HNR_PAGE_CLEAN))

    const calls = await adapter.fetchRaw("https://retrotoon.world", VALID_TOKEN, "")

    expect(calls.map((c) => c.endpoint)).toEqual([
      "/bonus.php",
      "/userdetails.php?id=4242",
      "/myhr.php",
    ])
    expect(calls.every((c) => c.error === null)).toBe(true)
    expect(calls[2].data).toEqual({ hitAndRuns: 0, hnrCleanupTokens: 0 })
  })

  it("records a per-page error instead of throwing, and sanitizes it", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(okPage(BONUS_PAGE))
      .mockRejectedValueOnce(new Error("profile exploded at https://retrotoon.world/x?tok=SECRET"))
      .mockResolvedValueOnce(okPage(HNR_PAGE_CLEAN))

    const calls = await adapter.fetchRaw("https://retrotoon.world", VALID_TOKEN, "")

    expect(calls[0].error).toBeNull()
    // The raw message is replaced with a host-only summary, so a URL carrying a
    // token can never reach the debug panel or a log.
    expect(calls[1].error).toBe("Failed to connect to retrotoon.world: Error")
    expect(calls[1].error).not.toMatch(/SECRET/)
    expect(calls[2].error).toBeNull()
  })

  it("throws on a malformed credential blob rather than recording a call", async () => {
    await expect(adapter.fetchRaw("https://retrotoon.world", "not-json", "")).rejects.toThrow(
      /must be a JSON object/
    )
  })
})
