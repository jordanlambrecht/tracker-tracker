// src/lib/tracker-platforms/__tests__/flaresolverr.test.ts

import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  cookieHeaderToSolverCookies,
  createSolverSession,
  destroySolverSession,
  formPageUrl,
  solverClearance,
  solverGet,
  solverPostForm,
  solverReady,
  unwrapSolverJson,
} from "../helpers/flaresolverr"

const CONFIG = { url: "http://flaresolverr.example:8191", maxTimeout: 60000 }

function reply(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function ok(solution: Record<string, unknown> = {}): Response {
  return reply({
    status: "ok",
    message: "",
    solution: {
      url: "https://tracker.example/",
      status: 200,
      response: "<html></html>",
      ...solution,
    },
  })
}

/** The page inside a data: URL, decoded. */
function pageOf(url: string): string {
  return decodeURIComponent(url.slice(url.indexOf(",") + 1))
}

function payloads(spy: { mock: { calls: unknown[][] } }): Record<string, unknown>[] {
  return spy.mock.calls.map((call) => JSON.parse(String((call[1] as RequestInit).body)))
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe("formPageUrl", () => {
  it("builds a page that submits the fields once encoded, in the site's charset", () => {
    const page = pageOf(
      formPageUrl(
        "https://tracker.example/login.php",
        { user: "someone", pass: `p@ss&w%rd+Ж!"<'` },
        "windows-1251"
      )
    )
    expect(page).toContain(
      '<form id="f" method="post" action="https://tracker.example/login.php" accept-charset="windows-1251">'
    )
    expect(page).toContain(
      '<input type="hidden" name="pass" value="p@ss&amp;w%rd+Ж!&quot;&lt;&#39;">'
    )
    expect(page).toContain('document.getElementById("f").submit()')
  })
})

describe("unwrapSolverJson", () => {
  it("takes the JSON out of the page the browser shows it in", () => {
    const html =
      '<html><head></head><body><pre style="word-wrap: break-word;">{"a":"2.86&amp;nbsp;GB","b":"&lt;x&gt;"}</pre></body></html>'
    expect(JSON.parse(unwrapSolverJson(html))).toEqual({ a: "2.86&nbsp;GB", b: "<x>" })
  })

  it("leaves text that is not such a page alone", () => {
    expect(unwrapSolverJson('{"a":1}')).toBe('{"a":1}')
  })
})

describe("cookieHeaderToSolverCookies", () => {
  it("splits a Cookie header into name and value pairs", () => {
    expect(cookieHeaderToSolverCookies("a=1; b=x=y;  ; c")).toEqual([
      { name: "a", value: "1" },
      { name: "b", value: "x=y" },
    ])
  })
})

describe("FlareSolverr calls", () => {
  it("opens and closes a browser session", async () => {
    const spy = vi.spyOn(global, "fetch").mockImplementation(async () => ok())

    const session = await createSolverSession(CONFIG)
    await destroySolverSession(CONFIG, session)

    expect(payloads(spy)).toEqual([
      { cmd: "sessions.create", session },
      { cmd: "sessions.destroy", session },
    ])
  })

  it("returns the page, where the browser landed, and its cookies", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      ok({
        url: "https://tracker.example/index.php",
        response: "<html>x</html>",
        cookies: [{ name: "sid", value: "v", domain: ".tracker.example", path: "/" }],
      })
    )

    expect(await solverGet(CONFIG, "https://tracker.example/")).toEqual({
      url: "https://tracker.example/index.php",
      status: 200,
      html: "<html>x</html>",
      cookies: [{ name: "sid", value: "v", domain: ".tracker.example" }],
    })
  })

  it("words FlareSolverr's own failure", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      reply({ status: "error", message: "Error: Challenge not detected!" }, 500)
    )

    await expect(solverGet(CONFIG, "https://tracker.example/")).rejects.toThrow(
      "FlareSolverr: Error: Challenge not detected!"
    )
  })

  it("reads a connection failure as FlareSolverr being unreachable", async () => {
    const cause = Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" })
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new TypeError("fetch failed", { cause }))

    await expect(solverGet(CONFIG, "https://tracker.example/")).rejects.toThrow(
      /^FlareSolverr unreachable: .*flaresolverr\.example/
    )
  })

  it("omits a submitted field from an error message that includes the URL", async () => {
    const secret = "hunter2-secret"
    vi.spyOn(global, "fetch").mockImplementationOnce(async (_url, init) => {
      const sent = JSON.parse(String(init?.body)) as { url: string }
      return reply({ status: "error", message: `Error loading ${sent.url} (${secret})` }, 500)
    })

    const err = (await solverPostForm(CONFIG, "https://tracker.example/login.php", {
      password: secret,
    }).catch((e: unknown) => e)) as Error

    expect(err.message).toMatch(/^FlareSolverr: /)
    expect(err.message).not.toContain(secret)
    expect(err.message).not.toContain("data:")
  })
})

describe("solverReady", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("returns the version FlareSolverr reports once ready", async () => {
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(reply({ msg: "FlareSolverr is ready!", version: "3.5.2" }))

    await expect(solverReady(CONFIG.url, 5000)).resolves.toBe("3.5.2")
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(`${CONFIG.url}/`)
  })

  it("throws when the URL returns something other than FlareSolverr", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(new Response("<html></html>", { status: 200 }))

    await expect(solverReady(CONFIG.url, 5000)).rejects.toThrow(/No FlareSolverr at this URL/)
  })

  it("reports an unreachable FlareSolverr as unreachable", async () => {
    vi.spyOn(global, "fetch").mockRejectedValueOnce(
      Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNREFUSED" } })
    )

    await expect(solverReady(CONFIG.url, 5000)).rejects.toThrow(/^FlareSolverr unreachable: /)
  })
})

describe("solverClearance", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("solves outside any session and returns only cf_clearance", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValueOnce(
      ok({
        cookies: [
          { name: "cf_clearance", value: "cleared", domain: ".tracker.example" },
          { name: "bb_guid", value: "guid", domain: ".tracker.example" },
        ],
      })
    )

    await expect(solverClearance(CONFIG, "https://tracker.example/login.php")).resolves.toEqual([
      { name: "cf_clearance", value: "cleared" },
    ])
    const sent = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(sent).not.toHaveProperty("session")
    expect(sent).toMatchObject({ cmd: "request.get", disableMedia: true })
  })
})
