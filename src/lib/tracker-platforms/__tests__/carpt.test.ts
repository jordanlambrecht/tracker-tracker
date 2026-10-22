// src/lib/tracker-platforms/__tests__/carpt.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"
import { parseBytes } from "@/lib/parser"
import { CarptAdapter, parseCarptHomepage, parseCarptProfile } from "../adapters/carpt"
import type { CarptPlatformMeta } from "../contract"

// Synthetic fixture shaped like a NexusPHP page. No real account data.
const HOME_HTML = `<!DOCTYPE html><html><body>
<a href="logout.php">退出</a>
<span class="nowrap"><a href="https://carpt.net/userdetails.php?id=12345" class='User_Name'><b>testuser</b></a></span>
<font class = 'color_bonus'>魔力值 </font>[<a href="mybonus.php">使用</a>]: 24,840.1
<font class="color_ratio">分享率:</font> 12.697
<font class='color_uploaded'>上传量:</font> 1.097 TB
<font class='color_downloaded'> 下载量:</font> 88.46 GB
<font class='color_active'>当前活动:</font> <img class="arrowup" alt="Torrents seeding" title="当前做种" src="pic/trans.gif" />25  <img class="arrowdown" alt="Torrents leeching" title="当前下载" src="pic/trans.gif" />0
<font class='color_bonus'>H&R: </font> [<a href="myhr.php">0/<font color="red">3</font>/20</a>]
</body></html>`

const PROFILE_HTML = `<!DOCTYPE html><html><body>
<a href="logout.php">退出</a>
<a href="https://carpt.net/userdetails.php?id=12345"></a>
<table>
<tr><td class="rowhead nowrap">用户ID/UID</td><td class="rowfollow">12345</td></tr>
<tr><td class="rowhead nowrap">加入日期</td><td class="rowfollow">2026-09-26 01:23:27 (<span title="2026-09-26 01:23:27">26天4时前</span>, 3周)</td></tr>
<tr><td class="rowhead nowrap">最近动向</td><td class="rowfollow">2026-10-22 05:28:27 (<span title="2026-10-22 05:28:27">&lt; 1分钟前</span>)</td></tr>
<tr><td class="rowhead nowrap">等级</td><td class="rowfollow"><img alt="User" title="User" src="pic/user.gif" /> </td></tr>
<tr><td class="rowhead nowrap">种子评论</td><td class="rowfollow">0</td></tr>
<tr><td class="rowhead nowrap">论坛帖子</td><td class="rowfollow">0</td></tr>
<tr><td class="rowhead nowrap">魔力值</td><td class="rowfollow">24,840.1</td></tr>
<tr><td class="rowhead nowrap">做种积分</td><td class="rowfollow">22,661.2&nbsp;&nbsp;<span class='text-muted'>(更新时间: 2026-10-22 05:20:11)</span></td></tr>
</table>
</body></html>`

const HOST = "https://carpt.net"
const CREDENTIALS = JSON.stringify({
  cookies: "c_secure_uid=abc; c_secure_pass=def; PHPSESSID=ghi",
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

describe("parseCarptHomepage", () => {
  it("maps the NexusPHP welcome block into TrackerStats", () => {
    const { stats, uid } = parseCarptHomepage(HOME_HTML, "carpt.net")
    const meta = stats.platformMeta as CarptPlatformMeta

    expect(uid).toBe("12345")
    expect(stats.username).toBe("testuser")
    expect(stats.uploadedBytes).toBe(parseBytes("1.097 TB"))
    expect(stats.downloadedBytes).toBe(parseBytes("88.46 GB"))
    expect(stats.ratio).toBe(12.697)
    expect(stats.seedingCount).toBe(25)
    expect(stats.leechingCount).toBe(0)
    expect(stats.seedbonus).toBe(24840.1)
    expect(stats.hitAndRuns).toBe(3)
    expect(meta.hnrUnderInvestigation).toBe(0)
    expect(meta.hnrLimit).toBe(20)
  })

  it("rejects a page without the logged-in welcome block", () => {
    expect(() => parseCarptHomepage("<html><body>login</body></html>", "carpt.net")).toThrow(
      /Session expired/
    )
  })

  it("fails when a byte total is missing", () => {
    const html = HOME_HTML.replace(
      /<font class='color_uploaded'>[\s\S]*?<font class='color_downloaded'>/,
      "<font class='color_downloaded'>"
    )
    expect(() => parseCarptHomepage(html, "carpt.net")).toThrow(/missing uploaded total/)
  })
})

describe("parseCarptProfile", () => {
  it("reads the class and profile dates", () => {
    const profile = parseCarptProfile(PROFILE_HTML)
    const meta = profile.platformMeta as CarptPlatformMeta

    expect(profile.group).toBe("User")
    expect(profile.joinedDate).toBe("2026-09-26")
    expect(profile.lastAccessDate).toBe("2026-10-22")
    expect(profile.remoteUserId).toBe(12345)
    expect(meta.seedingPoints).toBe(22661.2)
    expect(meta.torrentComments).toBe(0)
    expect(meta.forumPosts).toBe(0)
  })
})

describe("CarptAdapter", () => {
  const adapter = new CarptAdapter()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("merges the home page and profile", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(htmlResponse(HOME_HTML))
      .mockResolvedValueOnce(htmlResponse(PROFILE_HTML))

    const stats = await adapter.fetchStats(HOST, CREDENTIALS, "/userdetails.php")
    const meta = stats.platformMeta as CarptPlatformMeta

    expect(stats.uploadedBytes).toBe(parseBytes("1.097 TB"))
    expect(stats.group).toBe("User")
    expect(stats.joinedDate).toBe("2026-09-26")
    expect(stats.remoteUserId).toBe(12345)
    expect(meta.seedingPoints).toBe(22661.2)
  })

  it("keeps the home page stats when the profile request fails", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(htmlResponse(HOME_HTML))
      .mockRejectedValueOnce(new TypeError("fetch failed"))

    const stats = await adapter.fetchStats(HOST, CREDENTIALS, "/userdetails.php")

    expect(stats.uploadedBytes).toBe(parseBytes("1.097 TB"))
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

    await adapter.fetchStats(HOST, CREDENTIALS, "/userdetails.php")

    const headers = capturedInit?.headers as Record<string, string> | undefined
    expect(headers?.Cookie).toBe("c_secure_uid=abc; c_secure_pass=def; PHPSESSID=ghi")
    expect(headers?.["User-Agent"]).toBe("Mozilla/5.0")
  })

  it("returns both pages for the debug view", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(htmlResponse(HOME_HTML))
      .mockResolvedValueOnce(htmlResponse(PROFILE_HTML))

    const calls = await adapter.fetchRaw(HOST, CREDENTIALS, "/userdetails.php")

    expect(calls).toHaveLength(2)
    expect(calls[0].label).toBe("Home Page")
    expect(calls[0].endpoint).toBe("/")
    expect(calls[0].error).toBeNull()
    expect(calls[1].label).toBe("Profile")
    expect(calls[1].endpoint).toBe("/userdetails.php?id=12345")
    expect(calls[1].error).toBeNull()
  })
})
