// src/lib/tracker-platforms/__tests__/portugas.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"
import { parseBytes } from "@/lib/parser"
import { PortugasAdapter, parsePortugasHomepage, parsePortugasProfile } from "../adapters/portugas"
import type { PortugasPlatformMeta } from "../contract"

// Synthetic fixture shaped like the custom UNIT3D build's profile page. No
// real account data: names, ids and totals are invented.
const HOME_HTML = `<!DOCTYPE html><html><body>
<nav class="top-nav">
  <ul class="top-nav__stats"><li class="top-nav__stats-up">2 GiB</li></ul>
  <div class="top-nav__username">
    <a class="user-tag__link" href="https://portugas.org/users/testuser" title="Mouro">testuser</a>
  </div>
  <form role="form" method="POST" action="https://portugas.org/logout"></form>
  <ul class="top-nav__ratio-bar">
    <li class="ratio-bar__uploaded"><a href="https://portugas.org/users/testuser/uploads">2 GiB</a></li>
    <li class="ratio-bar__downloaded"><a href="https://portugas.org/users/testuser/torrents">512 MiB</a></li>
    <li class="ratio-bar__seeding"><a href="https://portugas.org/users/testuser/active">27</a></li>
    <li class="ratio-bar__leeching"><a href="https://portugas.org/users/testuser/active">0</a></li>
    <li class="ratio-bar__buffer"><a href="https://portugas.org/users/testuser/torrents">1.5 GiB</a></li>
    <li class="ratio-bar__points"><a href="https://portugas.org/users/testuser/earnings">19 910</a></li>
    <li class="ratio-bar__ratio"><a href="https://portugas.org/users/testuser/torrents">4.00</a></li>
    <li class="ratio-bar__tokens"><a href="https://portugas.org/users/testuser">3</a></li>
    <li class="ratio-bar__invites"><a href="https://portugas.org/users/testuser/invites/create">2</a></li>
  </ul>
</nav>
</body></html>`

const PROFILE_HTML = `<!DOCTYPE html><html><body>
<nav class="top-nav">
  <ul class="top-nav__stats"><li class="top-nav__stats-up">2 GiB</li></ul>
  <form role="form" method="POST" action="https://portugas.org/logout"></form>
</nav>
<time datetime="2026-08-23 19:23:40" class="profile__registration">Data de Registo: 2026-08-23</time>
<dl class="key-value">
  <div class="key-value__group"><dt>Contagem de HnR (desde sempre)</dt><dd>0</dd></div>
  <div class="key-value__group"><dt>Avisos Ativos</dt><dd>1</dd></div>
  <div class="key-value__group"><dt>Tamanho das Sementes (Todos os Torrents)</dt><dd>1 GiB</dd></div>
  <div class="key-value__group"><dt>Real Rácio</dt><dd>4.12</dd></div>
  <div class="key-value__group"><dt>ID do Utilizador</dt><dd>6615</dd></div>
  <div class="key-value__group"><dt>Última Ação</dt><dd><time datetime="2026-10-21 21:15:31">há 1 segundo</time></dd></div>
</dl>
</body></html>`

const HOST = "https://portugas.org"
const CREDENTIALS = JSON.stringify({
  cookies: "laravel_session=abc; XSRF-TOKEN=def",
  userAgent: "Mozilla/5.0",
})

const htmlResponse = (body: string) =>
  ({
    ok: true,
    status: 200,
    statusText: "OK",
    headers: { get: () => null },
    text: async () => body,
  }) as unknown as Response

describe("parsePortugasHomepage", () => {
  it("maps the ratio bar into TrackerStats", () => {
    const { stats, username } = parsePortugasHomepage(HOME_HTML, "portugas.org")
    const meta = stats.platformMeta as PortugasPlatformMeta

    expect(username).toBe("testuser")
    expect(stats.username).toBe("testuser")
    expect(stats.group).toBe("Mouro")
    expect(stats.uploadedBytes).toBe(parseBytes("2 GiB"))
    expect(stats.downloadedBytes).toBe(parseBytes("512 MiB"))
    expect(stats.ratio).toBe(4)
    expect(stats.bufferBytes).toBe(parseBytes("1.5 GiB"))
    expect(stats.seedingCount).toBe(27)
    expect(stats.leechingCount).toBe(0)
    expect(stats.seedbonus).toBe(19910)
    expect(stats.freeleechTokens).toBe(3)
    expect(meta.invites).toBe(2)
  })

  it("rejects a page without the logged-in navigation", () => {
    expect(() => parsePortugasHomepage("<html><body>login</body></html>", "portugas.org")).toThrow(
      /Session expired/
    )
  })

  it("fails when a byte total is missing", () => {
    const html = HOME_HTML.replace(/<li class="ratio-bar__uploaded">[\s\S]*?<\/li>/, "")
    expect(() => parsePortugasHomepage(html, "portugas.org")).toThrow(/missing uploaded total/)
  })
})

describe("parsePortugasProfile", () => {
  it("reads the profile sidebar figures", () => {
    const profile = parsePortugasProfile(PROFILE_HTML)
    const meta = profile.platformMeta as PortugasPlatformMeta

    expect(profile.remoteUserId).toBe(6615)
    expect(profile.joinedDate).toBe("2026-08-23")
    expect(profile.lastAccessDate).toBe("2026-10-21")
    expect(profile.hitAndRuns).toBe(0)
    expect(profile.warned).toBe(true)
    expect(meta.hnrCount).toBe(0)
    expect(meta.seedSizeBytes).toBe(Number(parseBytes("1 GiB")))
    expect(meta.realRatio).toBe(4.12)
  })
})

describe("PortugasAdapter", () => {
  const adapter = new PortugasAdapter()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("merges the homepage and profile pages", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(htmlResponse(HOME_HTML))
      .mockResolvedValueOnce(htmlResponse(PROFILE_HTML))

    const stats = await adapter.fetchStats(HOST, CREDENTIALS, "/")
    const meta = stats.platformMeta as PortugasPlatformMeta

    expect(stats.uploadedBytes).toBe(parseBytes("2 GiB"))
    expect(stats.group).toBe("Mouro")
    expect(stats.joinedDate).toBe("2026-08-23")
    expect(stats.remoteUserId).toBe(6615)
    expect(meta.invites).toBe(2)
    expect(meta.hnrCount).toBe(0)
  })

  it("keeps the homepage stats when the profile request fails", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(htmlResponse(HOME_HTML))
      .mockRejectedValueOnce(new TypeError("fetch failed"))

    const stats = await adapter.fetchStats(HOST, CREDENTIALS, "/")

    expect(stats.uploadedBytes).toBe(parseBytes("2 GiB"))
    expect(stats.joinedDate).toBeUndefined()
  })

  it("sends the pasted cookies and user agent", async () => {
    let capturedInit: RequestInit | undefined
    vi.spyOn(global, "fetch")
      .mockImplementationOnce((_url, init) => {
        capturedInit = init
        return Promise.resolve(htmlResponse(HOME_HTML))
      })
      .mockResolvedValueOnce(htmlResponse(PROFILE_HTML))

    await adapter.fetchStats(HOST, CREDENTIALS, "/")

    const headers = capturedInit?.headers as Record<string, string> | undefined
    expect(headers?.Cookie).toBe("laravel_session=abc; XSRF-TOKEN=def")
    expect(headers?.["User-Agent"]).toBe("Mozilla/5.0")
  })

  it("returns both pages for the debug view", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(htmlResponse(HOME_HTML))
      .mockResolvedValueOnce(htmlResponse(PROFILE_HTML))

    const calls = await adapter.fetchRaw(HOST, CREDENTIALS, "/")

    expect(calls).toHaveLength(2)
    expect(calls[0].label).toBe("Home Page")
    expect(calls[0].endpoint).toBe("/")
    expect(calls[0].error).toBeNull()
    expect(calls[1].label).toBe("Profile")
    expect(calls[1].endpoint).toBe("/users/testuser")
    expect(calls[1].error).toBeNull()
  })
})
