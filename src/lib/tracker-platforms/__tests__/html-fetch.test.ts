// src/lib/tracker-platforms/__tests__/html-fetch.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"
import { sanitizeNetworkError } from "@/lib/error-utils"
import { DEFAULT_USER_AGENT } from "@/lib/user-agent"
import { SessionExpiredError } from "../helpers/errors"
import { fetchTrackerHtml } from "../helpers/html-fetch"

const BASE = {
  url: "https://tracker.example/profile",
  cookies: "uid=1; pass=abc",
  label: "ExampleTracker",
  sessionExpiredMessage: "Session expired. Browser cookies need to be refreshed",
}

function htmlResponse(body: string): Response {
  return { ok: true, status: 200, statusText: "OK", text: async () => body } as Response
}

function redirectResponse(location: string, status = 302): Response {
  return {
    ok: false,
    status,
    statusText: "Found",
    headers: { get: (name: string) => (name.toLowerCase() === "location" ? location : null) },
  } as unknown as Response
}

describe("fetchTrackerHtml - headers", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  // A session the app logged in for itself announces the app, and a copied one
  // keeps the browser it was issued to.
  it("sends browser navigation headers only when a User-Agent is supplied", async () => {
    let headers: Record<string, string> | undefined
    vi.spyOn(global, "fetch").mockImplementation((_url, init) => {
      headers = init?.headers as Record<string, string>
      return Promise.resolve(htmlResponse("<html></html>"))
    })

    await fetchTrackerHtml({ ...BASE, userAgent: "Mozilla/5.0 (Test)" })
    expect(headers?.["User-Agent"]).toBe("Mozilla/5.0 (Test)")
    expect(headers?.["Sec-Fetch-Mode"]).toBe("navigate")
    expect(headers?.DNT).toBe("1")

    await fetchTrackerHtml(BASE)
    expect(headers?.["User-Agent"]).toBe(DEFAULT_USER_AGENT)
    expect(headers?.["Sec-Fetch-Mode"]).toBeUndefined()
    expect(headers?.DNT).toBeUndefined()
  })

  it("always sends the cookie header and an HTML Accept", async () => {
    let headers: Record<string, string> | undefined
    vi.spyOn(global, "fetch").mockImplementationOnce((_url, init) => {
      headers = init?.headers as Record<string, string>
      return Promise.resolve(htmlResponse("<html></html>"))
    })

    await fetchTrackerHtml(BASE)

    expect(headers?.Cookie).toBe("uid=1; pass=abc")
    expect(headers?.Accept).toContain("text/html")
  })

  it("sets a request timeout", async () => {
    let signal: AbortSignal | undefined
    vi.spyOn(global, "fetch").mockImplementationOnce((_url, init) => {
      signal = init?.signal as AbortSignal | undefined
      return Promise.resolve(htmlResponse("<html></html>"))
    })

    await fetchTrackerHtml(BASE)

    expect(signal).toBeInstanceOf(AbortSignal)
    expect(signal?.aborted).toBe(false)
  })
})

describe("fetchTrackerHtml - redirects", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("treats a 302 as an expired session when redirects are not followed", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(redirectResponse("/login"))

    await expect(fetchTrackerHtml(BASE)).rejects.toThrow("Session expired")
  })

  // The TorrentLeech retry and the DigitalCore enrichment rethrow both branch
  // on this type, so rewording the message cannot change control flow.
  it("raises an expired session as a type a caller can branch on", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(redirectResponse("/login"))

    await expect(
      fetchTrackerHtml({ ...BASE, sessionExpiredMessage: "Reworded entirely" })
    ).rejects.toBeInstanceOf(SessionExpiredError)
  })

  it("follows a non-login redirect when configured to", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(redirectResponse("/t"))
      .mockResolvedValueOnce(htmlResponse("<html>stats</html>"))

    const html = await fetchTrackerHtml({
      ...BASE,
      followRedirects: { loginPattern: /\/auth\/login|\/login/i },
    })

    expect(html).toBe("<html>stats</html>")
  })

  it("reports an expired session when a followed redirect points at login", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(redirectResponse("/auth/login"))

    await expect(
      fetchTrackerHtml({ ...BASE, followRedirects: { loginPattern: /\/auth\/login|\/login/i } })
    ).rejects.toThrow("Session expired")
  })

  // The headers carry the user's tracker session cookie, and Location is chosen by
  // the remote host, so following it off-origin would hand that cookie to whoever
  // the tracker names. These assert the request is never made, not merely that the
  // call rejects.
  it("refuses to follow a redirect to another host, and sends nothing there", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(redirectResponse("https://attacker.example/collect"))

    await expect(
      fetchTrackerHtml({ ...BASE, followRedirects: { loginPattern: /\/login/i } })
    ).rejects.toThrow("redirected off-site")

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(String(fetchSpy.mock.calls[0][0])).not.toContain("attacker.example")
  })

  it("refuses a protocol-relative redirect, which also leaves the origin", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(redirectResponse("//attacker.example/collect"))

    await expect(
      fetchTrackerHtml({ ...BASE, followRedirects: { loginPattern: /\/login/i } })
    ).rejects.toThrow("redirected off-site")

    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  // A status missing from the redirect set is handed back as though it were the
  // final response, so it never reaches the same-origin check, the guard would
  // be silently narrower than it looks. 307 and 308 preserve the method and are
  // ordinary on CDN-fronted hosts.
  it.each([301, 303, 307, 308])("refuses an off-site redirect sent as %i", async (status) => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(redirectResponse("https://attacker.example/collect", status))

    await expect(
      fetchTrackerHtml({ ...BASE, followRedirects: { loginPattern: /\/login/i } })
    ).rejects.toThrow("redirected off-site")

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(String(fetchSpy.mock.calls[0][0])).not.toContain("attacker.example")
  })

  it.each([301, 303, 307, 308])(
    "treats a %i as an expired session when redirects are not followed",
    async (status) => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(redirectResponse("/login", status))

      await expect(fetchTrackerHtml(BASE)).rejects.toThrow("Session expired")
    }
  )

  it("refuses a redirect to a private address", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(redirectResponse("http://127.0.0.1:8080/"))

    await expect(
      fetchTrackerHtml({ ...BASE, followRedirects: { loginPattern: /\/login/i } })
    ).rejects.toThrow("redirected off-site")

    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it("still follows a same-origin redirect that changes only the path", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(redirectResponse("https://tracker.example/t?page=2"))
      .mockResolvedValueOnce(htmlResponse("<html>stats</html>"))

    const html = await fetchTrackerHtml({
      ...BASE,
      followRedirects: { loginPattern: /\/login/i },
    })

    expect(html).toBe("<html>stats</html>")
  })

  it("gives up after the hop limit rather than looping", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(redirectResponse("/next"))

    await expect(
      fetchTrackerHtml({
        ...BASE,
        followRedirects: { loginPattern: /\/login/i, maxHops: 2 },
      })
    ).rejects.toThrow("Too many redirects from ExampleTracker")
  })

  it("stops on a redirect with no Location header, which is a malformed reply and no loop", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(redirectResponse(""))

    await expect(
      fetchTrackerHtml({ ...BASE, followRedirects: { loginPattern: /\/login/i } })
    ).rejects.toThrow("Unexpected response from tracker.example: redirect with no Location")
  })

  it("reads an unreadable Location as an unexpected response, not as bad credentials", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(redirectResponse("http://["))

    const err = await fetchTrackerHtml({
      ...BASE,
      followRedirects: { loginPattern: /\/login/i },
    }).catch((e: Error) => e)

    expect((err as Error).message).toBe(
      "Unexpected response from tracker.example: redirect to an unreadable Location"
    )
    expect(sanitizeNetworkError((err as Error).message)).toBe(
      "Tracker returned an unexpected response"
    )
  })
})

describe("fetchTrackerHtml - errors", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  // The scheduler sanitizes the thrown message once, so the card text is what
  // that one pass makes of it.
  async function cardFor(status: number, statusText: string): Promise<string> {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status,
      statusText,
      headers: { get: () => null },
      text: async () => "",
    } as unknown as Response)
    const err = await fetchTrackerHtml(BASE)
      .then(() => null)
      .catch((e: unknown) => (e instanceof Error ? e : null))
    return sanitizeNetworkError(err?.message ?? "", "Poll failed")
  }

  it("words a failed status the way adapterFetch does", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      headers: { get: () => null },
    } as unknown as Response)

    await expect(fetchTrackerHtml(BASE)).rejects.toThrow(
      "Tracker API error: 500 Internal Server Error"
    )
  })

  it("names the status on the card rather than reading as Poll failed", async () => {
    expect(await cardFor(500, "Internal Server Error")).toBe("API returned 500")
    expect(await cardFor(503, "Service Unavailable")).toBe("API returned 503")
  })

  it("reads an auth failure on the card as one", async () => {
    expect(await cardFor(401, "Unauthorized")).toBe("Authentication failed")
    expect(await cardFor(403, "Forbidden")).toBe("Authentication failed")
  })

  it("classifies a connection failure by hostname", async () => {
    const cause = Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" })
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new TypeError("fetch failed", { cause }))

    await expect(fetchTrackerHtml(BASE)).rejects.toThrow("tracker.example")
  })
})

describe("fetchTrackerHtml - a Cloudflare page on a failed status", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  // Read by its status alone, a challenge served with a 403 becomes
  // "Authentication failed" and sends the user to re-paste cookies that work.
  function failWith(status: number, statusText: string, body: string): Promise<Error | null> {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status,
      statusText,
      headers: { get: () => null },
      text: async () => body,
    } as unknown as Response)
    return fetchTrackerHtml(BASE)
      .then(() => null)
      .catch((e: unknown) => (e instanceof Error ? e : null))
  }

  it.each([
    [403, "Forbidden"],
    [503, "Service Unavailable"],
  ])("reads the interstitial served with a %i as a challenge", async (status, statusText) => {
    const err = await failWith(
      status,
      statusText,
      "<!DOCTYPE html><html><head><title>Just a moment...</title></head></html>"
    )

    expect(err?.message).toBe("Cloudflare challenge detected on ExampleTracker")
    expect(sanitizeNetworkError(err?.message ?? "", "Poll failed")).toBe(
      "Cloudflare challenge blocked the request"
    )
  })

  it("reads a Turnstile page served with a 403 as a challenge", async () => {
    const err = await failWith(
      403,
      "Forbidden",
      '<html><script src="https://challenges.cloudflare.com/turnstile/v0/api.js"></script></html>'
    )

    expect(err?.message).toBe("Cloudflare challenge detected on ExampleTracker")
  })

  it("keeps an ordinary 403 an authentication failure", async () => {
    const err = await failWith(403, "Forbidden", "<html>Access denied</html>")

    expect(err?.message).toBe("Tracker API error: 403 Forbidden")
    expect(sanitizeNetworkError(err?.message ?? "", "Poll failed")).toBe("Authentication failed")
  })

  it("falls back to the status when the body of a 403 cannot be read", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: "Forbidden",
      headers: { get: () => null },
      text: async () => {
        throw new TypeError("terminated")
      },
    } as unknown as Response)

    await expect(fetchTrackerHtml(BASE)).rejects.toThrow("Tracker API error: 403 Forbidden")
  })
})

// ---------------------------------------------------------------------------
// The proxy branch runs the same redirect handling as the direct one, or
// followRedirects is dead for a proxied user and a login bounce surfaces as a
// raw status.
// ---------------------------------------------------------------------------

describe("fetchTrackerHtml - through a proxy", () => {
  const proxyAgent = { proxy: "http://127.0.0.1:8080" } as never

  function proxyResponse(
    status: number,
    body: string,
    headers: Record<string, string | string[]> = {}
  ) {
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 302 ? "Found" : "OK",
      headers,
      buffer: async () => Buffer.from(body, "utf8"),
    }
  }

  let proxyFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.resetModules()
    proxyFetch = vi.fn()
    vi.doMock("@/lib/tunnel", () => ({ proxyFetch }))
  })

  async function run(request: Record<string, unknown>) {
    const { fetchTrackerHtml: fresh } = await import("../helpers/html-fetch")
    return fresh({ ...BASE, proxyAgent, ...request } as Parameters<typeof fetchTrackerHtml>[0])
  }

  it("follows a same-origin redirect instead of failing on the 302", async () => {
    proxyFetch
      .mockResolvedValueOnce(proxyResponse(302, "", { location: "/t" }))
      .mockResolvedValueOnce(proxyResponse(200, "<html>stats</html>"))

    const html = await run({ followRedirects: { loginPattern: /login/ } })

    expect(html).toContain("stats")
    expect(proxyFetch).toHaveBeenCalledTimes(2)
    expect(String(proxyFetch.mock.calls[1][0])).toBe("https://tracker.example/t")
  })

  it("reports an expired session when a proxied redirect points at login", async () => {
    proxyFetch.mockResolvedValueOnce(proxyResponse(302, "", { location: "/auth/login" }))

    await expect(run({ followRedirects: { loginPattern: /login/ } })).rejects.toThrow(
      "Session expired"
    )
  })

  it("treats a proxied 302 as an expired session when redirects are not followed", async () => {
    proxyFetch.mockResolvedValueOnce(proxyResponse(302, "", { location: "/auth/login" }))

    await expect(run({})).rejects.toThrow("Session expired")
  })

  it("keeps the reason a proxied request failed, worded like the other transports", async () => {
    proxyFetch.mockRejectedValueOnce(
      new Error("Proxy connection ended before receiving CONNECT response")
    )

    await expect(run({})).rejects.toThrow(
      "Failed to connect to tracker.example via proxy: Proxy connection ended before receiving CONNECT response"
    )
  })

  it("refuses to follow a proxied redirect off-origin, and sends nothing there", async () => {
    proxyFetch.mockResolvedValueOnce(
      proxyResponse(302, "", { location: "https://evil.example/harvest" })
    )

    await expect(run({ followRedirects: { loginPattern: /login/ } })).rejects.toThrow(
      /refusing to send credentials/
    )
    expect(proxyFetch).toHaveBeenCalledTimes(1)
  })

  it("reads a Cloudflare page on a proxied 403 as a challenge", async () => {
    proxyFetch.mockResolvedValueOnce(
      proxyResponse(403, "<html><head><title>Just a moment...</title></head></html>")
    )

    await expect(run({})).rejects.toThrow("Cloudflare challenge detected on ExampleTracker")
  })

  it("still returns the body on an ordinary proxied response", async () => {
    proxyFetch.mockResolvedValueOnce(proxyResponse(200, "<html>ok</html>"))

    expect(await run({})).toContain("ok")
  })

  // proxyFetch adds no User-Agent of its own, so a default missing here would
  // send none at all through the proxy.
  it("sends the app User-Agent through the proxy when the caller passes none", async () => {
    proxyFetch.mockResolvedValueOnce(proxyResponse(200, "<html>ok</html>"))

    await run({})

    const headers = proxyFetch.mock.calls[0][2].headers as Record<string, string>
    expect(headers["User-Agent"]).toBe(DEFAULT_USER_AGENT)
    expect(headers["Sec-Fetch-Mode"]).toBeUndefined()
  })
})
