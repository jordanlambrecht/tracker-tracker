// src/lib/adapters/html-fetch.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fetchTrackerHtml } from "./html-fetch"

const BASE = {
  url: "https://tracker.example/profile",
  cookies: "uid=1; pass=abc",
  label: "ExampleTracker",
  sessionExpiredMessage: "Session expired — browser cookies need to be refreshed",
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
    expect(headers?.["User-Agent"]).toBeUndefined()
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

  it("gives up after the hop limit rather than looping", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(redirectResponse("/next"))

    await expect(
      fetchTrackerHtml({
        ...BASE,
        followRedirects: { loginPattern: /\/login/i, maxHops: 2 },
      })
    ).rejects.toThrow("Too many redirects from ExampleTracker")
  })

  it("stops on a redirect with no Location header", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(redirectResponse(""))

    await expect(
      fetchTrackerHtml({ ...BASE, followRedirects: { loginPattern: /\/login/i } })
    ).rejects.toThrow("Too many redirects from ExampleTracker")
  })
})

describe("fetchTrackerHtml - errors", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("falls back to a tracker-labelled message for an unrecognized status", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      headers: { get: () => null },
    } as unknown as Response)

    await expect(fetchTrackerHtml(BASE)).rejects.toThrow("ExampleTracker page fetch failed: 500")
  })

  it("sanitizes an auth failure rather than echoing the status", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: "Forbidden",
      headers: { get: () => null },
    } as unknown as Response)

    await expect(fetchTrackerHtml(BASE)).rejects.toThrow("Authentication failed")
  })

  it("classifies a connection failure by hostname", async () => {
    const cause = Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" })
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new TypeError("fetch failed", { cause }))

    await expect(fetchTrackerHtml(BASE)).rejects.toThrow("tracker.example")
  })
})
