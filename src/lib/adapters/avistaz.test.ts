// src/lib/adapters/avistaz.test.ts

import { beforeEach, describe, expect, it, vi } from "vitest"
import { AvistazAdapter, parseAvistazCredentials, parseAvistazProfile } from "./avistaz"
import type { AvistazPlatformMeta } from "./types"

// Minimal ratio bar HTML fixture matching the real AvistaZ DOM structure
const RATIO_BAR_HTML = `
<div class="ratio-bar">
  <div class="container">
    <ul class="list-inline">
      <li><i class="fa fa-user"></i>
        <a href="/profile/testuser"><span class="badge-user group-member">testuser</span></a>
      </li>
      <li><i class="fa fa-group"></i>
        <span class="badge-user group-member">Member</span>
      </li>
      <li data-toggle="tooltip" title="Upload">
        <i class="fa fa-arrow-up text-success"></i> 32.64 GB</li>
      <li data-toggle="tooltip" title="Download">
        <i class="fa fa-arrow-down text-orange"></i> 1.00 KB</li>
      <li data-toggle="tooltip" title="Ratio">
        <i class="fa fa-signal"></i> 999999.99</li>
      <li data-toggle="tooltip" title="Buffer">
        <i class="fa fa-database"></i> 32.64 GB
      </li>
      <li><i class="fa fa-upload text-success"></i>
        <a href="/profile/testuser/active">Seeding:</a>
        2
      </li>
      <li><i class="fa fa-download text-orange"></i>
        <a href="/profile/testuser/active">Leeching:</a>
        0
      </li>
      <li><i class="fa fa-star text-gold"></i>
        <a href="/profile/testuser/bonus">Bonus:</a>
        285.80
      </li>
      <li><i class="fa fa-exclamation-triangle text-orange"></i>
        <a href="/profile/testuser/reseed">Reseed:</a>
        0
      </li>
      <li><i class="fa fa-exclamation-triangle text-yellow"></i>
        <a href="/profile/testuser/history?hnr=1">Hit
          & Run:</a>
        0
      </li>
    </ul>
  </div>
</div>`

const PROFILE_TABLE_HTML = `
<table class="table table-condensed table-bordered table-striped">
  <tbody>
    <tr>
      <td><i class="fa fa-lock"></i> User ID</td>
      <td class="col-sm-7"><span>540792</span></td>
      <td rowspan="8" class="avatar-cell"></td>
    </tr>
    <tr><td>Username</td><td><span class="badge-user group-member">testuser</span></td></tr>
    <tr><td>Rank</td><td><span class="badge-user group-member">Member</span></td></tr>
    <tr><td>Joined</td><td>27 Feb 2026 07:21 pm (1 month ago)</td></tr>
    <tr><td>Downloaded</td><td>1.00 KB <span class="badge-extra small">0 MB</span></td></tr>
    <tr><td>Uploaded</td><td>32.64 GB <span class="badge-extra small">33,421 MB</span></td></tr>
    <tr><td>Ratio</td><td>999999.99</td></tr>
    <tr><td>Buffer</td><td>32.64 GB <span class="badge-extra small">33,421 MB</span></td></tr>
  </tbody>
</table>
<div class="well well-sm">
  <ul class="list-inline mb-0">
    <li><i class="fa fa-upload text-success"></i> Total Uploads: <strong>0</strong></li>
    <li><i class="fa fa-download text-danger"></i> Downloads: <strong>4</strong></li>
    <li><i class="fa fa-cloud-upload text-success"></i> Seeding: <strong>2</strong></li>
    <li><i class="fa fa-cloud-download text-danger"></i> Leeching: <strong>0</strong></li>
    <li><i class="fa fa-exclamation-triangle text-danger"></i> Hit & Run: <strong>0</strong></li>
  </ul>
</div>
<table class="table table-condensed table-bordered table-striped">
  <tbody>
    <tr><td><i class="fa fa-lock"></i> 2FA</td>
      <td><span class="text-danger"><i class="fa fa-times"></i> Not Enabled</span></td></tr>
    <tr><td><i class="fa fa-lock"></i> Last Access</td>
      <td>29 Mar 2026 08:08 pm (15 minutes ago)</td></tr>
    <tr><td><i class="fa fa-lock"></i> Bonus Points</td><td>285.80</td></tr>
    <tr><td><i class="fa fa-lock"></i> Invites</td><td>0</td></tr>
    <tr><td><i class="fa fa-lock"></i> Can Download</td><td>Yes</td></tr>
    <tr><td><i class="fa fa-lock"></i> Can Upload</td><td>Yes</td></tr>
    <tr><td><i class="fa fa-lock"></i> Donor</td><td>No</td></tr>
    <tr><td><i class="fa fa-lock"></i> VIP Expiry</td><td>-</td></tr>
  </tbody>
</table>`

const AVATAR_HTML = `
<div id="avatar-uploader" class="img-avatar pull-right"><div><div class="qq-uploader-selector text-center">
  <img src="https://avistaz.to/images/avatar/z/2/k/z2kyjx7a08ea.jpg" class="avatar-original img-thumbnail">
</div></div></div>`

const FULL_PAGE = `<!doctype html><html><head></head><body>${RATIO_BAR_HTML}<section class="container content" id="content-area">${PROFILE_TABLE_HTML}</section>${AVATAR_HTML}</body></html>`

describe("parseAvistazProfile", () => {
  it("extracts core stats from the ratio bar", () => {
    const stats = parseAvistazProfile(FULL_PAGE, "testuser")
    expect(stats.username).toBe("testuser")
    expect(stats.group).toBe("Member")
    expect(stats.uploadedBytes).toBe(BigInt(32_640_000_000)) // 32.64 GB decimal
    expect(stats.downloadedBytes).toBe(BigInt(1_000)) // 1.00 KB decimal
    expect(stats.ratio).toBe(999999.99)
    expect(stats.seedingCount).toBe(2)
    expect(stats.leechingCount).toBe(0)
    expect(stats.seedbonus).toBe(285.8)
    expect(stats.hitAndRuns).toBe(0)
  })

  it("extracts remoteUserId from profile table", () => {
    const stats = parseAvistazProfile(FULL_PAGE, "testuser")
    expect(stats.remoteUserId).toBe(540792)
  })

  it("extracts joinedDate from profile table", () => {
    const stats = parseAvistazProfile(FULL_PAGE, "testuser")
    expect(stats.joinedDate).toContain("2026")
  })

  it("extracts lastAccessDate from private table", () => {
    const stats = parseAvistazProfile(FULL_PAGE, "testuser")
    expect(stats.lastAccessDate).toContain("2026")
  })

  it("extracts platformMeta fields", () => {
    const stats = parseAvistazProfile(FULL_PAGE, "testuser")
    const meta = stats.platformMeta as AvistazPlatformMeta
    expect(meta.donor).toBe(false)
    expect(meta.invites).toBe(0)
    expect(meta.canDownload).toBe(true)
    expect(meta.canUpload).toBe(true)
    expect(meta.totalUploads).toBe(0)
    expect(meta.totalDownloads).toBe(4)
    expect(meta.twoFactorEnabled).toBe(false)
    expect(meta.reseedRequests).toBe(0)
  })

  it("extracts avatar URL from profile page", () => {
    const stats = parseAvistazProfile(FULL_PAGE, "testuser")
    expect(stats.avatarUrl).toBe("https://avistaz.to/images/avatar/z/2/k/z2kyjx7a08ea.jpg")
  })

  it("computes bufferBytes as upload minus download", () => {
    const stats = parseAvistazProfile(FULL_PAGE, "testuser")
    expect(stats.bufferBytes).toBe(BigInt(32_640_000_000) - BigInt(1_000))
  })

  it("detects login redirect and throws", () => {
    const loginRedirect = `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url='https://avistaz.to/auth/login'" /></head></html>`
    expect(() => parseAvistazProfile(loginRedirect, "testuser")).toThrow("Session expired")
  })

  it("detects Cloudflare challenge and throws", () => {
    const cfChallenge = `<!DOCTYPE html><html><head><title>Just a moment...</title></head><body></body></html>`
    expect(() => parseAvistazProfile(cfChallenge, "testuser")).toThrow("Cloudflare")
  })

  it("throws when ratio bar is missing", () => {
    const noRatioBar = `<!DOCTYPE html><html><head></head><body><p>No ratio bar here.</p></body></html>`
    expect(() => parseAvistazProfile(noRatioBar, "testuser")).toThrow("ratio bar")
  })

  it("falls back to passed username when badge-user span is absent", () => {
    const minimalPage = `<!doctype html><html><head></head><body>
      <div class="ratio-bar"><div class="container"><ul class="list-inline">
        <li data-toggle="tooltip" title="Upload"><i></i> 1.00 GB</li>
        <li data-toggle="tooltip" title="Download"><i></i> 500.00 MB</li>
        <li data-toggle="tooltip" title="Ratio"><i></i> 2.00</li>
        <li><a href="#">Seeding:</a> 1</li>
        <li><a href="#">Leeching:</a> 0</li>
        <li><a href="#">Bonus:</a> 100.00</li>
        <li><a href="#">Reseed:</a> 0</li>
        <li><a href="#">Hit & Run:</a> 0</li>
      </ul></div></div>
    </body></html>`
    const stats = parseAvistazProfile(minimalPage, "fallbackuser")
    expect(stats.username).toBe("fallbackuser")
  })

  it("parses BS5 ratio bar (data-bs-toggle, Uploaded/Downloaded titles)", () => {
    const bs5Page = `<!doctype html><html><head></head><body>
      <div class="ratio-bar"><div class="container"><ul class="list-inline">
        <li class="list-inline-item"><span class="badge-user">bs5user</span></li>
        <li class="list-inline-item"><span class="badge-user">Power User</span></li>
        <li class="list-inline-item" data-bs-toggle="tooltip" data-bs-placement="bottom" title="Uploaded">
          <i class="fa fa-arrow-up"></i> 27.05 GB</li>
        <li class="list-inline-item" data-bs-toggle="tooltip" data-bs-placement="bottom" title="Downloaded">
          <i class="fa fa-arrow-down"></i> 6.44 GB</li>
        <li class="list-inline-item" data-bs-toggle="tooltip" data-bs-placement="bottom" title="Ratio">
          <i class="fa fa-exchange"></i> 4.20</li>
      </ul></div></div>
    </body></html>`
    const stats = parseAvistazProfile(bs5Page, "bs5user")
    expect(stats.username).toBe("bs5user")
    expect(stats.group).toBe("Power User")
    expect(stats.uploadedBytes).toBe(27050000000n)
    expect(stats.downloadedBytes).toBe(6440000000n)
    expect(stats.ratio).toBeCloseTo(4.2)
  })

  it("extracts all fields from AnimeZ BS5 structure (datagrid + tooltip stats)", () => {
    const animezPage = `<!doctype html><html><head></head><body>
      <span class="badge bg-secondary-lt text-secondary badge-sm">Member</span>
      <div class="ratio-bar"><div class="container"><ul class="list-inline">
        <li class="list-inline-item" data-bs-toggle="tooltip" data-bs-placement="bottom" title="Uploaded">
          <i class="fa fa-arrow-up"></i> 10.00 GB</li>
        <li class="list-inline-item" data-bs-toggle="tooltip" data-bs-placement="bottom" title="Downloaded">
          <i class="fa fa-arrow-down"></i> 5.00 GB</li>
        <li class="list-inline-item" data-bs-toggle="tooltip" data-bs-placement="bottom" title="Ratio">
          <i class="fa fa-exchange"></i> 2.00</li>
        <li class="list-inline-item" data-bs-toggle="tooltip" data-bs-placement="bottom" title="Active Seeds">
          <i class="fa fa-arrow-up"></i> 7</li>
        <li class="list-inline-item" data-bs-toggle="tooltip" data-bs-placement="bottom" title="Active Leeches">
          <i class="fa fa-arrow-down"></i> 1</li>
        <li class="list-inline-item" data-bs-toggle="tooltip" data-bs-placement="bottom" title="Bonus Points">
          <i class="fa fa-star"></i> BP: 344</li>
      </ul></div></div>
      <div class="datagrid">
        <div class="datagrid-item">
          <div class="datagrid-title">Member Since</div>
          <div class="datagrid-content ">February 27, 2026</div>
        </div>
        <div class="datagrid-item">
          <div class="datagrid-title">Last Seen</div>
          <div class="datagrid-content ">11 seconds ago</div>
        </div>
        <div class="datagrid-item">
          <div class="datagrid-title">Invites</div>
          <div class="datagrid-content ">0</div>
        </div>
        <div class="datagrid-item">
          <div class="datagrid-title">2FA</div>
          <div class="datagrid-content ">Enabled</div>
        </div>
      </div>
    </body></html>`
    const stats = parseAvistazProfile(animezPage, "animezuser")
    expect(stats.username).toBe("animezuser")
    expect(stats.group).toBe("Member")
    expect(stats.uploadedBytes).toBe(10000000000n)
    expect(stats.downloadedBytes).toBe(5000000000n)
    expect(stats.ratio).toBeCloseTo(2.0)
    expect(stats.seedingCount).toBe(7)
    expect(stats.leechingCount).toBe(1)
    expect(stats.seedbonus).toBe(344)
    expect(stats.joinedDate).toBe("2026-02-27")
    expect((stats.platformMeta as { twoFactorEnabled?: boolean })?.twoFactorEnabled).toBe(true)
  })
})

describe("parseAvistazCredentials", () => {
  it("parses a valid JSON credential blob", () => {
    const json = JSON.stringify({
      cookies: "cf_clearance=abc; session=xyz",
      userAgent: "Mozilla/5.0",
      username: "testuser",
    })
    const creds = parseAvistazCredentials(json)
    expect(creds.cookies).toBe("cf_clearance=abc; session=xyz")
    expect(creds.userAgent).toBe("Mozilla/5.0")
    expect(creds.username).toBe("testuser")
  })

  it("throws on missing cookies field", () => {
    const json = JSON.stringify({ userAgent: "Mozilla/5.0", username: "testuser" })
    expect(() => parseAvistazCredentials(json)).toThrow("cookies")
  })

  it("throws on missing userAgent field", () => {
    const json = JSON.stringify({ cookies: "cf_clearance=abc", username: "testuser" })
    expect(() => parseAvistazCredentials(json)).toThrow()
  })

  it("throws on missing username field", () => {
    const json = JSON.stringify({ cookies: "cf_clearance=abc", userAgent: "Mozilla/5.0" })
    expect(() => parseAvistazCredentials(json)).toThrow()
  })

  it("throws on non-JSON string", () => {
    expect(() => parseAvistazCredentials("just-a-plain-string")).toThrow()
  })

  it("throws on empty cookies", () => {
    const json = JSON.stringify({ cookies: "   ", userAgent: "Mozilla/5.0", username: "user" })
    expect(() => parseAvistazCredentials(json)).toThrow("cookies")
  })

  it("throws when user pastes a cookie name instead of the full header", () => {
    const json = JSON.stringify({
      cookies: "cf_clearance",
      userAgent: "Mozilla/5.0",
      username: "user",
    })
    expect(() => parseAvistazCredentials(json)).toThrow("cookie name")
  })

  it("throws when cookie string has no key=value pairs", () => {
    const json = JSON.stringify({
      cookies: "some-random-text-no-equals",
      userAgent: "Mozilla/5.0",
      username: "user",
    })
    expect(() => parseAvistazCredentials(json)).toThrow("key=value")
  })
})

// ---------------------------------------------------------------------------
// AvistazAdapter.fetchStats — fetchHtml network error paths
// These tests verify that classifyFetchError is correctly wired in fetchHtml,
// i.e. that TypeError-wrapping from Node.js native fetch is unwrapped into a
// useful message before propagating up to the caller.
// ---------------------------------------------------------------------------

describe("AvistazAdapter.fetchStats — network error classification", () => {
  const adapter = new AvistazAdapter()
  const validToken = JSON.stringify({
    cookies: "cf_clearance=aaaa; session=bbbb",
    userAgent: "Mozilla/5.0",
    username: "testuser",
  })

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("unwraps TypeError wrapping ECONNREFUSED (Node.js native fetch pattern)", async () => {
    const cause = Object.assign(new Error("connect ECONNREFUSED 192.0.2.1:443"), {
      code: "ECONNREFUSED",
    })
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new TypeError("fetch failed", { cause }))

    await expect(adapter.fetchStats("https://avistaz.to", validToken, "")).rejects.toThrow(
      "Failed to connect to avistaz.to: ECONNREFUSED"
    )
  })

  it("unwraps TypeError wrapping ENOTFOUND", async () => {
    const cause = Object.assign(new Error("getaddrinfo ENOTFOUND avistaz.to"), {
      code: "ENOTFOUND",
    })
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new TypeError("fetch failed", { cause }))

    await expect(adapter.fetchStats("https://avistaz.to", validToken, "")).rejects.toThrow(
      "Failed to connect to avistaz.to: ENOTFOUND"
    )
  })

  it("produces a timeout message when the AbortSignal fires (TypeError wrapping TimeoutError)", async () => {
    const cause = new DOMException("The operation was timed out.", "TimeoutError")
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new TypeError("fetch failed", { cause }))

    await expect(adapter.fetchStats("https://avistaz.to", validToken, "")).rejects.toThrow(
      "Request to avistaz.to timed out"
    )
  })

  it("produces a timeout message for a bare DOMException TimeoutError", async () => {
    vi.spyOn(global, "fetch").mockRejectedValueOnce(
      new DOMException("signal timed out", "TimeoutError")
    )

    await expect(adapter.fetchStats("https://avistaz.to", validToken, "")).rejects.toThrow(
      "Request to avistaz.to timed out"
    )
  })

  it("produces a useful message for a bare TypeError with no cause", async () => {
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new TypeError("fetch failed"))

    await expect(adapter.fetchStats("https://avistaz.to", validToken, "")).rejects.toThrow(
      "Failed to connect to avistaz.to"
    )
  })

  it("propagates session-expired error when server returns 302 redirect", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 302,
      statusText: "Found",
    } as Response)

    await expect(adapter.fetchStats("https://avistaz.to", validToken, "")).rejects.toThrow(
      "Session expired"
    )
  })
})
