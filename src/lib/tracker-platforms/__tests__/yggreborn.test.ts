// src/lib/tracker-platforms/__tests__/yggreborn.test.ts

import { parse as parseHtml } from "node-html-parser"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  parseYggrebornAccount,
  parseYggrebornActiveTorrents,
  parseYggrebornCredentials,
  YggrebornAdapter,
} from "../adapters/yggreborn"
import type { YggrebornPlatformMeta } from "../contract"
import { SessionExpiredError } from "../helpers/errors"

const HOST = "www.yggreborn.org"
const BASE_URL = `https://${HOST}`

const VALID_TOKEN = JSON.stringify({
  cookies: "session=0123456789abcdef0123456789abcdef",
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) TestUA",
})

// ---------------------------------------------------------------------------
// Rebuilt from /account/ and /account/torrents-actifs pages saved by a member
// on 2026-11-14 rather than pasted, since the real pages embed the email, the
// announce URL with its passkey, CSRF tokens and the member's torrent list. The username and every secret are invented; the
// markup, classes and French labels are the site's. The fidelity tests below
// pin what the parser relies on.
// ---------------------------------------------------------------------------

const PAGE_HEAD = `<!DOCTYPE html>
<html lang="fr" class="dark"><head><meta charset="utf-8">
<title>YggReborn | Mon compte</title>
</head><body class="bg-dark-900 text-dark-100">
<header class="sticky top-0 z-40">
  <nav class="flex items-center gap-4">
    <a href="/" class="font-bold">YggReborn</a>
    <span class="text-sm font-medium text-mint-400"> Ratio : 1.90 </span>
    <a href="/account/" class="text-sm">Mon compte</a>
  </nav>
</header>
<main class="max-w-6xl mx-auto px-4 py-8">
`

const GREETING = `<div class="mb-6">
  <h1 class="text-2xl font-bold">Mon compte</h1>
  <p class="text-dark-400">Bienvenue, <span class="text-mint-400 font-semibold">GrenierSeeder</span></p>
</div>
`

/** One stat card: the value <div>, then its label <div>. */
function statCard(value: string, label: string): string {
  return `<div class="rounded-lg p-3 text-center">
        <div class="text-xl font-bold truncate">${value}</div>
        <div class="text-[0.7rem] uppercase tracking-wider text-dark-400 mt-1">${label}</div>
      </div>
`
}

const TRACKER_STATS = `<div class="hero-card rounded-xl p-5">
  <div class="flex items-baseline justify-between gap-3 mb-4">
    <h3 class="text-sm font-semibold uppercase tracking-wider">Statistiques Tracker</h3>
  </div>
  <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      ${statCard("50.40 Go", "Upload")}      ${statCard("26.52 Go", "Download")}      ${statCard("0 o", "Freeleech DL")}      ${statCard("1.90", "Ratio")}  </div>
</div>
`

// The Score card prints U+2014 until the member has uploaded. Escaped here
// because the conformance suite bans the literal character.
const USER_STATUS = `<div class="hero-card rounded-xl p-5">
  <div class="flex items-baseline justify-between gap-3 mb-4">
    <h3 class="text-sm font-semibold uppercase tracking-wider">Statut Utilisateur</h3>
  </div>
  <div class="flex items-center gap-4 mb-4">
    <div class="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold">G</div>
    <div class="min-w-0">
      <span class="text-sm font-bold uppercase tracking-wider">Utilisateur</span>
      <div class="text-xs text-dark-400 mt-0.5">Aucun bonus</div>
    </div>
  </div>
  <div class="grid grid-cols-3 gap-3">
      ${statCard("\u2014", "Score")}      ${statCard("0", "Uploads")}      ${statCard("0", "Vérifiés")}  </div>
</div>
`

const QUICK_LINKS = `<div class="grid grid-cols-2 gap-3">
  <a href="/account/torrents">Mes torrents</a>
  <a href="/account/torrents-actifs">Torrents actifs</a>
  <a href="/uploader/GrenierSeeder">Page uploader</a>
  <a href="/account/profile">Modifier le profil</a>
  <a href="/contact">Contact</a>
  <a href="/inbox/">Messagerie</a>
</div>
`

/** One "Informations du compte" row: the label <span>, then its value element. */
function accountRow(label: string, valueHtml: string): string {
  return `<div class="flex items-center justify-between py-2 border-b border-dark-700">
      <span class="text-dark-400 text-sm">${label}</span>
      ${valueHtml}
    </div>
`
}

const ACCOUNT_INFO = `<div class="rounded-xl p-5">
  <h3 class="text-sm font-semibold uppercase tracking-wider mb-4">Informations du compte</h3>
    ${accountRow("Nom d'utilisateur", '<span class="font-medium">GrenierSeeder</span>')}    ${accountRow("Email", '<span class="font-medium">member@example.invalid</span>')}    ${accountRow("Membre depuis", '<span class="font-medium">05/05/2026</span>')}    ${accountRow("Dernière connexion", '<span class="font-medium">14/11/2026 15:04</span>')}    ${accountRow("Rôle", '<div><span class="px-2 py-0.5 rounded text-xs">Membre</span></div>')}    ${accountRow("Statut", '<span class="text-mint-400 font-medium">Actif</span>')}</div>
<div class="rounded-xl p-5">
  <h3 class="text-sm font-semibold uppercase tracking-wider mb-4">URL d'annonce</h3>
  <code id="announce-url">https://tracker.yggreborn.org/00000000000000000000000000000000/announce</code>
</div>
`

const LOGOUT_FORM = `<form action="/logout" method="post">
  <input type="hidden" name="csrf_token" value="redacted-csrf-token">
  <button type="submit">Déconnexion</button>
</form>
`

const PAGE_FOOT = `</main></body></html>`

const ACCOUNT_PAGE =
  PAGE_HEAD +
  GREETING +
  TRACKER_STATS +
  USER_STATUS +
  QUICK_LINKS +
  ACCOUNT_INFO +
  LOGOUT_FORM +
  PAGE_FOOT

/**
 * Same shape with an uploader's figures on it, to exercise the paths a
 * leech-only account cannot reach: a numeric Score, non-zero upload counts,
 * freeleech traffic, terabyte totals and a promoted rank. Distinct values, so
 * swapping two field assignments in the parser would not go unnoticed.
 */
const UPLOADER_PAGE = ACCOUNT_PAGE.replace(">50.40 Go<", ">3.25 To<")
  .replace(">26.52 Go<", ">512.00 Go<")
  .replace(">0 o<", ">750.50 Mo<")
  .replace(">\u2014</div>", ">1 280</div>")
  .replace(
    `>0</div>
        <div class="text-[0.7rem] uppercase tracking-wider text-dark-400 mt-1">Uploads<`,
    `>42</div>
        <div class="text-[0.7rem] uppercase tracking-wider text-dark-400 mt-1">Uploads<`
  )
  .replace(
    `>0</div>
        <div class="text-[0.7rem] uppercase tracking-wider text-dark-400 mt-1">Vérifiés<`,
    `>37</div>
        <div class="text-[0.7rem] uppercase tracking-wider text-dark-400 mt-1">Vérifiés<`
  )
  .replace(">Membre</span>", ">Modérateur</span>")

/** Signed in (the logout form is there) but not the account page. */
const OTHER_SIGNED_IN_PAGE = PAGE_HEAD + GREETING + QUICK_LINKS + LOGOUT_FORM + PAGE_FOOT

const LOGIN_PAGE = `<!DOCTYPE html><html lang="fr"><head><title>YggReborn | Connexion</title></head>
<body><form action="/login" method="post"><input name="username"><input name="password" type="password"></form></body></html>`

const CLOUDFLARE_PAGE = `<!DOCTYPE html><html><head><title>Just a moment...</title></head>
<body><div id="challenge-running"></div></body></html>`

/** One desktop row of the active list, cut down to the cells that carry figures. */
function activeRow(id: number, name: string, state: string, seeders: number): string {
  return `<div class="row-hover grid gap-1.5 px-4 py-3 items-center " style="border-bottom:1px solid var(--light-border);">
          <div class="min-w-0 flex items-center gap-1.5">
            <a href="/torrent/${id}" target="_blank" class="text-sm font-medium truncate min-w-0">${name}</a>
          </div>
          <div class="text-center"><span class="inline-flex rounded-lg px-2.5 py-1 text-xs font-bold">${state}</span></div>
          <div class="text-center text-sm font-mono">100%</div>
          <div class="text-center text-sm font-bold" style="color:#006b55;">${seeders}</div>
          <div class="text-center text-sm font-medium" style="color:#b91c1c;">0</div>
          <div class="text-center text-[0.66rem] leading-4 whitespace-nowrap"><div>\u21910 B</div><div>\u21932.7 GB</div></div>
        </div>
`
}

/**
 * /account/torrents-actifs. The header chips total the list; the rows under
 * them are one page of it. This page has no logout form, unlike /account/.
 */
function activePage(chips: string, rows: string): string {
  return `${PAGE_HEAD}<section class="hero-card rounded-lg p-4">
  <p class="ygg-hero-kicker text-left mb-1"><span>TORRENTS</span> <span class="accent-strike">Actifs</span></p>
  <p class="text-sm">
    <a href="/account/">\u2190 Mon compte</a>
    <span class="mx-2">/</span>
    <span>17 torrents actifs</span>
  </p>
  <div class="flex flex-wrap items-center gap-3 mt-4">
${chips}  </div>
  <form action="/account/torrents-actifs/approve-all" method="post">
    <input type="hidden" name="csrf_token" value="redacted-csrf-token">
    <button type="submit" disabled>Tout approuver (0)</button>
  </form>
</section>
<section class="flex flex-col gap-4">
  <div class="content-card rounded-lg overflow-hidden">
    <div class="hidden md:block table-scroll">
        <div class="grid gap-1.5 px-4 py-3 text-[0.68rem] font-semibold uppercase">
          <a href="/account/torrents-actifs?sort=seed&amp;order=desc">Seed</a>
          <a href="/account/torrents-actifs?sort=leech&amp;order=desc">Leech</a>
        </div>
        ${rows}    </div>
  </div>
</section>
${PAGE_FOOT}`
}

function chip(text: string): string {
  return `    <span class="ui-chip px-3 py-2 text-sm" style="color: var(--text-body);">${text}</span>
`
}

const ACTIVE_ROWS =
  activeRow(100001, "Example Film 2021 MULTi 1080p WEB H264-GROUP", "Partage", 13) +
  activeRow(100002, "Example Serie S01 FRENCH 720p WEB H264-GROUP", "Partage", 4)

const ACTIVE_PAGE = activePage(chip("17 en partage") + chip("0 en téléchargement"), ACTIVE_ROWS)

const GIB = 1024n ** 3n

function okPage(html: string): Response {
  return { ok: true, status: 200, text: async () => html } as Response
}

// ---------------------------------------------------------------------------
// Credentials
// ---------------------------------------------------------------------------

describe("parseYggrebornCredentials", () => {
  it("accepts a well-formed blob and returns the cookies verbatim", () => {
    expect(parseYggrebornCredentials(VALID_TOKEN)).toEqual({
      cookies: "session=0123456789abcdef0123456789abcdef",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) TestUA",
    })
  })

  it("keeps every cookie of a full header, whatever the site names them", () => {
    const token = JSON.stringify({
      cookies: "session=abc123; remember_token=7|def456; cf_clearance=ghi789",
      userAgent: "TestUA",
    })
    expect(parseYggrebornCredentials(token).cookies).toBe(
      "session=abc123; remember_token=7|def456; cf_clearance=ghi789"
    )
  })

  it("strips a copied 'Cookie: ' prefix", () => {
    const token = JSON.stringify({ cookies: "Cookie: session=abc123", userAgent: "TestUA" })
    expect(parseYggrebornCredentials(token).cookies).toBe("session=abc123")
  })

  it("rejects a bare cookie name pasted instead of the header value", () => {
    const token = JSON.stringify({ cookies: "session", userAgent: "TestUA" })
    expect(() => parseYggrebornCredentials(token)).toThrow(/pasted a cookie name/)
  })

  it("rejects a DevTools-truncated value containing an ellipsis", () => {
    const token = JSON.stringify({ cookies: "session=abc…def", userAgent: "TestUA" })
    expect(() => parseYggrebornCredentials(token)).toThrow(/truncated/)
  })

  it("rejects a non-JSON token and names both required fields", () => {
    expect(() => parseYggrebornCredentials("session=abc123")).toThrow(
      /YggReborn credentials must be a JSON object/
    )
    expect(() => parseYggrebornCredentials("session=abc123")).toThrow(/cookies.*userAgent/)
  })

  it("rejects a blob missing userAgent", () => {
    expect(() => parseYggrebornCredentials(JSON.stringify({ cookies: "session=abc123" }))).toThrow(
      /userAgent/
    )
  })
})

// ---------------------------------------------------------------------------
// Fixture fidelity
// ---------------------------------------------------------------------------

describe("fixture fidelity against the saved page", () => {
  const doc = parseHtml(ACCOUNT_PAGE)

  it("reproduces the seven stat cards as a value div followed by a text-only label div", () => {
    const labels = doc
      .querySelectorAll("div.rounded-lg.p-3.text-center")
      .map((card) => card.querySelectorAll("div").map((d) => d.textContent.trim()))
    expect(labels).toEqual([
      ["50.40 Go", "Upload"],
      ["26.52 Go", "Download"],
      ["0 o", "Freeleech DL"],
      ["1.90", "Ratio"],
      ["\u2014", "Score"],
      ["0", "Uploads"],
      ["0", "Vérifiés"],
    ])
  })

  it("reproduces the six account rows in the order the site prints them", () => {
    const labels = doc.querySelectorAll("span.text-dark-400.text-sm").map((s) => s.textContent)
    expect(labels).toEqual([
      "Nom d'utilisateur",
      "Email",
      "Membre depuis",
      "Dernière connexion",
      "Rôle",
      "Statut",
    ])
  })

  it("keeps the header's rounded Ratio, which the parser must not trust", () => {
    expect(ACCOUNT_PAGE).toContain(" Ratio : 1.90 ")
  })

  it("keeps the logout form the session check keys on", () => {
    expect(doc.querySelector('form[action="/logout"]')).not.toBeNull()
  })

  it("carries no real secret", () => {
    expect(ACCOUNT_PAGE).toContain("/00000000000000000000000000000000/announce")
    expect(ACCOUNT_PAGE).toContain("member@example.invalid")
    expect(ACCOUNT_PAGE).toContain('value="redacted-csrf-token"')
  })
})

// ---------------------------------------------------------------------------
// Account page parser
// ---------------------------------------------------------------------------

describe("parseYggrebornAccount", () => {
  it("parses every field off a member's account page", () => {
    const stats = parseYggrebornAccount(ACCOUNT_PAGE, HOST)

    expect(stats.username).toBe("GrenierSeeder")
    expect(stats.group).toBe("Membre")
    // 50.40 Go and 26.52 Go, read as binary gigabytes.
    expect(stats.uploadedBytes).toBe(54_116_587_930n)
    expect(stats.downloadedBytes).toBe(28_475_633_172n)
    expect(stats.bufferBytes).toBe(54_116_587_930n - 28_475_633_172n)
    expect(stats.joinedDate).toBe("2026-05-05")
    expect(stats.lastAccessDate).toBe("2026-11-14")
  })

  it("derives the ratio from the byte totals rather than the page's two-decimal figure", () => {
    const stats = parseYggrebornAccount(ACCOUNT_PAGE, HOST)
    expect(stats.ratio).toBeCloseTo(50.4 / 26.52, 6)
    expect(stats.ratio).not.toBe(1.9)
  })

  it("reports every unpublished figure as null, never as a measured zero", () => {
    const stats = parseYggrebornAccount(ACCOUNT_PAGE, HOST)
    // These two are filled by fetchStats from the active torrents page.
    expect(stats.seedingCount).toBeNull()
    expect(stats.leechingCount).toBeNull()
    expect(stats.seedbonus).toBeNull()
    expect(stats.hitAndRuns).toBeNull()
    expect(stats.requiredRatio).toBeNull()
    expect(stats.warned).toBeNull()
    expect(stats.freeleechTokens).toBeNull()
  })

  it("collects the uploader figures into platformMeta and leaves a dash Score out", () => {
    const meta = parseYggrebornAccount(ACCOUNT_PAGE, HOST).platformMeta as YggrebornPlatformMeta
    expect(meta).toEqual({
      freeleechDownloadedBytes: 0,
      uploadedTorrents: 0,
      verifiedUploads: 0,
    })
    expect("uploaderScore" in meta).toBe(false)
  })

  it("handles an uploader's page: terabytes, megabytes, a score and a promoted rank", () => {
    const stats = parseYggrebornAccount(UPLOADER_PAGE, HOST)

    expect(stats.group).toBe("Modérateur")
    expect(stats.uploadedBytes).toBe(3_573_412_790_272n) // 3.25 * 1024^4
    expect(stats.downloadedBytes).toBe(512n * GIB)
    expect(stats.ratio).toBeCloseTo(6.5, 6)
    expect(stats.platformMeta as YggrebornPlatformMeta).toEqual({
      freeleechDownloadedBytes: 786_956_288, // 750.50 * 1024^2
      uploaderScore: 1280,
      uploadedTorrents: 42,
      verifiedUploads: 37,
    })
  })

  it("reads a count grouped with the French thousands space, plain or non-breaking", () => {
    const narrow = UPLOADER_PAGE.replace(">1 280</div>", ">1\u202f280</div>")
    expect(
      (parseYggrebornAccount(narrow, HOST).platformMeta as YggrebornPlatformMeta).uploaderScore
    ).toBe(1280)
  })

  it("reads the group from the Rôle row, not the uploader status card", () => {
    // Both are on the page: "Membre" is the role, "Utilisateur" the uploader rank.
    expect(parseYggrebornAccount(ACCOUNT_PAGE, HOST).group).not.toBe("Utilisateur")
  })

  it("reports no group when the Rôle row is missing or empty", () => {
    const row = accountRow(
      "Rôle",
      '<div><span class="px-2 py-0.5 rounded text-xs">Membre</span></div>'
    )
    expect(ACCOUNT_PAGE).toContain(row)
    expect(parseYggrebornAccount(ACCOUNT_PAGE.replace(row, ""), HOST).group).toBeNull()
    expect(
      parseYggrebornAccount(ACCOUNT_PAGE.replace(">Membre</span>", "></span>"), HOST).group
    ).toBeNull()
  })

  it("leaves the dates undefined when their rows are missing or reshaped", () => {
    const html = ACCOUNT_PAGE.replace(">05/05/2026<", ">il y a 6 mois<").replace(
      accountRow("Dernière connexion", '<span class="font-medium">14/11/2026 15:04</span>'),
      ""
    )
    const stats = parseYggrebornAccount(html, HOST)
    expect(stats.joinedDate).toBeUndefined()
    expect(stats.lastAccessDate).toBeUndefined()
  })

  it("does not take the Ratio card or the header for a byte total", () => {
    // "Upload" must not match "Uploads", nor "Download" match "Freeleech DL".
    const stats = parseYggrebornAccount(UPLOADER_PAGE, HOST)
    expect(stats.uploadedBytes).not.toBe(42n)
    expect((stats.platformMeta as YggrebornPlatformMeta).uploadedTorrents).toBe(42)
  })

  it("throws session-expired on a login page served with a 200", () => {
    expect(() => parseYggrebornAccount(LOGIN_PAGE, HOST)).toThrow(SessionExpiredError)
  })

  it("prefers the Cloudflare message over the generic session one", () => {
    expect(() => parseYggrebornAccount(CLOUDFLARE_PAGE, HOST)).toThrow(
      "Cloudflare challenge detected. Cookies need refreshing"
    )
  })

  it("throws when a signed-in page carries no tracker statistics", () => {
    expect(() => parseYggrebornAccount(OTHER_SIGNED_IN_PAGE, HOST)).toThrow(
      "Unexpected response from www.yggreborn.org: Could not find the tracker statistics on the YggReborn account page. The page structure may have changed."
    )
  })

  it("throws naming the uploaded total when only Download can be read", () => {
    expect(() =>
      parseYggrebornAccount(ACCOUNT_PAGE.replace(">50.40 Go<", ">\u2014<"), HOST)
    ).toThrow("Unexpected response from www.yggreborn.org: unreadable uploaded byte total")
  })

  it("throws naming the downloaded total when only Upload can be read", () => {
    expect(() =>
      parseYggrebornAccount(ACCOUNT_PAGE.replace(">26.52 Go<", ">\u2014<"), HOST)
    ).toThrow("Unexpected response from www.yggreborn.org: unreadable downloaded byte total")
  })
})

// ---------------------------------------------------------------------------
// Active torrents page parser
// ---------------------------------------------------------------------------

describe("parseYggrebornActiveTorrents", () => {
  it("reads the seeding and leeching totals off the header chips", () => {
    expect(parseYggrebornActiveTorrents(ACTIVE_PAGE)).toEqual({
      seedingCount: 17,
      leechingCount: 0,
    })
  })

  it("takes the chips, not the rows on the page or their seeder columns", () => {
    // Two rows are listed and the first shows 13 seeders; the total is 17.
    const { seedingCount } = parseYggrebornActiveTorrents(ACTIVE_PAGE)
    expect(seedingCount).not.toBe(2)
    expect(seedingCount).not.toBe(13)
  })

  it("keeps the two chips apart", () => {
    const html = activePage(chip("3 en partage") + chip("12 en téléchargement"), ACTIVE_ROWS)
    expect(parseYggrebornActiveTorrents(html)).toEqual({ seedingCount: 3, leechingCount: 12 })
  })

  it("reads a total grouped with the French thousands space", () => {
    const html = activePage(chip("1\u202f204 en partage") + chip("0 en téléchargement"), "")
    expect(parseYggrebornActiveTorrents(html).seedingCount).toBe(1204)
  })

  it("reports a missing chip as unknown, never as zero", () => {
    expect(parseYggrebornActiveTorrents(activePage(chip("17 en partage"), ACTIVE_ROWS))).toEqual({
      seedingCount: 17,
      leechingCount: null,
    })
    expect(parseYggrebornActiveTorrents(LOGIN_PAGE)).toEqual({
      seedingCount: null,
      leechingCount: null,
    })
  })

  it("does not match the list-length line, which only resembles a chip", () => {
    const html = activePage("", ACTIVE_ROWS)
    expect(html).toContain("17 torrents actifs")
    expect(parseYggrebornActiveTorrents(html).seedingCount).toBeNull()
  })

  it("throws on a Cloudflare challenge", () => {
    expect(() => parseYggrebornActiveTorrents(CLOUDFLARE_PAGE)).toThrow(
      "Cloudflare challenge detected. Cookies need refreshing"
    )
  })
})

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

describe("YggrebornAdapter.fetchStats", () => {
  const adapter = new YggrebornAdapter()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  function mockBothPages() {
    return vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(okPage(ACCOUNT_PAGE))
      .mockResolvedValueOnce(okPage(ACTIVE_PAGE))
  }

  it("reads the account page, then the active torrents page, and merges them", async () => {
    const fetchSpy = mockBothPages()

    const stats = await adapter.fetchStats(BASE_URL, VALID_TOKEN, "")

    expect(fetchSpy.mock.calls.map((c) => c[0])).toEqual([
      "https://www.yggreborn.org/account/",
      "https://www.yggreborn.org/account/torrents-actifs",
    ])
    expect(stats.username).toBe("GrenierSeeder")
    expect(stats.group).toBe("Membre")
    expect(stats.uploadedBytes).toBe(54_116_587_930n)
    expect(stats.seedingCount).toBe(17)
    expect(stats.leechingCount).toBe(0)
  })

  it("sends the pasted cookies and the copied User-Agent on both requests", async () => {
    const fetchSpy = mockBothPages()

    await adapter.fetchStats(BASE_URL, VALID_TOKEN, "")

    for (const call of fetchSpy.mock.calls) {
      const headers = call[1]?.headers as Record<string, string>
      expect(headers.Cookie).toBe("session=0123456789abcdef0123456789abcdef")
      expect(headers["User-Agent"]).toBe("Mozilla/5.0 (Windows NT 10.0; Win64; x64) TestUA")
    }
  })

  it("ignores the apiPath it is given", async () => {
    const fetchSpy = mockBothPages()

    await adapter.fetchStats(BASE_URL, VALID_TOKEN, "/api")

    expect(fetchSpy.mock.calls[0][0]).toBe("https://www.yggreborn.org/account/")
  })

  it("keeps the poll alive with unknown counts when the active torrents page fails", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(okPage(ACCOUNT_PAGE))
      .mockRejectedValueOnce(new Error("boom"))

    const stats = await adapter.fetchStats(BASE_URL, VALID_TOKEN, "")

    expect(stats.uploadedBytes).toBe(54_116_587_930n)
    // Unknown rather than a fabricated zero.
    expect(stats.seedingCount).toBeNull()
    expect(stats.leechingCount).toBeNull()
  })

  it("fails the poll when the session dies between the two pages", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(okPage(ACCOUNT_PAGE))
      .mockResolvedValueOnce(
        new Response(null, { status: 302, headers: { location: "/login?next=/account/" } })
      )

    await expect(adapter.fetchStats(BASE_URL, VALID_TOKEN, "")).rejects.toBeInstanceOf(
      SessionExpiredError
    )
  })

  it("throws session-expired when the site redirects to its login page", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(null, { status: 302, headers: { location: "/login?next=/account/" } })
      )

    await expect(adapter.fetchStats(BASE_URL, VALID_TOKEN, "")).rejects.toThrow(
      "Session expired. Browser cookies need to be refreshed"
    )
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it("throws session-expired on a login page served with a 200", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(okPage(LOGIN_PAGE))

    await expect(adapter.fetchStats(BASE_URL, VALID_TOKEN, "")).rejects.toBeInstanceOf(
      SessionExpiredError
    )
  })

  it("names the host when the request times out", async () => {
    vi.spyOn(global, "fetch").mockRejectedValueOnce(
      new DOMException("The operation was aborted due to timeout", "TimeoutError")
    )

    await expect(adapter.fetchStats(BASE_URL, VALID_TOKEN, "")).rejects.toThrow(
      "Request to www.yggreborn.org timed out"
    )
  })

  it("throws on a malformed credential blob before any request", async () => {
    const fetchSpy = vi.spyOn(global, "fetch")

    await expect(adapter.fetchStats(BASE_URL, "not-json", "")).rejects.toThrow(
      /must be a JSON object/
    )
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe("YggrebornAdapter.fetchRaw", () => {
  const adapter = new YggrebornAdapter()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("returns one entry per page holding the parsed figures, not the pages", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(okPage(ACCOUNT_PAGE))
      .mockResolvedValueOnce(okPage(ACTIVE_PAGE))

    const calls = await adapter.fetchRaw(BASE_URL, VALID_TOKEN, "")

    expect(calls.map((c) => [c.label, c.endpoint])).toEqual([
      ["Account Page", "/account/"],
      ["Active Torrents Page", "/account/torrents-actifs"],
    ])
    expect(calls.every((c) => c.error === null)).toBe(true)
    expect(calls[0].data).toMatchObject({ username: "GrenierSeeder", group: "Membre" })
    expect(calls[1].data).toEqual({ seedingCount: 17, leechingCount: 0 })
    // Nothing off the pages beyond the parsed figures: no email, announce URL,
    // token or torrent name.
    const dump = JSON.stringify(calls, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
    expect(dump).not.toMatch(/example\.invalid|announce|csrf|Example Film/)
  })

  it("records a per-page error instead of throwing, and sanitizes it", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(okPage(ACCOUNT_PAGE))
      .mockRejectedValueOnce(new Error("exploded at https://www.yggreborn.org/x?tok=SECRET"))

    const calls = await adapter.fetchRaw(BASE_URL, VALID_TOKEN, "")

    expect(calls).toHaveLength(2)
    expect(calls[0].error).toBeNull()
    expect(calls[1].data).toBeNull()
    expect(calls[1].error).toBe("Failed to connect to www.yggreborn.org: Error")
    expect(calls[1].error).not.toMatch(/SECRET/)
  })

  it("records a parse failure on the account entry and still reads the other page", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(okPage(OTHER_SIGNED_IN_PAGE))
      .mockResolvedValueOnce(okPage(ACTIVE_PAGE))

    const calls = await adapter.fetchRaw(BASE_URL, VALID_TOKEN, "")

    expect(calls[0].data).toBeNull()
    expect(calls[0].error).toMatch(/^Unexpected response from www\.yggreborn\.org: /)
    expect(calls[1].error).toBeNull()
  })

  it("throws on a malformed credential blob rather than recording a call", async () => {
    await expect(adapter.fetchRaw(BASE_URL, "not-json", "")).rejects.toThrow(
      /must be a JSON object/
    )
  })
})
