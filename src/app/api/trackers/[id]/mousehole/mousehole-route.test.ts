// src/app/api/trackers/[id]/mousehole/mousehole-route.test.ts
//
// Tests for GET and POST /api/trackers/[id]/mousehole. The Bearer comes from
// the encrypted column and nowhere else, the token never reaches a URL, a
// response body or a log line, and Mousehole's answers map to the messages the
// card shows. Fixtures mirror Mousehole v0.5.0's responses.
//
// Crypto is real, because encrypt() under one key and a session carrying
// another is how a stale session reaches the route.

import type { Mock } from "vitest"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { authenticate, parseTrackerId } from "@/lib/api-helpers"
import { encrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { log } from "@/lib/logger"
import { GET, POST } from "./route"

vi.mock("@/lib/api-helpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-helpers")>()
  return {
    ...actual,
    authenticate: vi.fn(),
    parseTrackerId: vi.fn(),
  }
})

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
  },
}))

vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const KEY = Buffer.from("0123456789abcdef0123456789abcdef")
const OTHER_KEY = Buffer.from("fedcba9876543210fedcba9876543210")
const TOKEN = "fake-mousehole-token-7f3a"
const BASE = "http://mousehole-test:5010"

const HEALTH_OK = { lastMamContactResult: "ok" }
const STATE_OK = {
  hasCookie: true,
  hasAuth: true,
  nextContactAt: "2026-10-14T13:00:00.000+00:00[Etc/UTC]",
  lastMamContact: {
    at: "2026-10-14T12:00:00.000+00:00[Etc/UTC]",
    reached: true,
    ip: "203.0.113.7",
    asn: 64496,
    as: "Example Transit",
    ipUpdate: { success: true, msg: "No change", httpStatus: 200 },
  },
}
// Mousehole's 401 body depends on what was presented: nothing, or a Bearer.
const NO_CREDENTIALS = {
  type: "authentication-required",
  message: "No credentials presented",
}
const UNAUTHORIZED = {
  type: "authentication-required",
  message: "Rejected Bearer token (wrong value, or MOUSEHOLE_AUTH_TOKEN not set)",
}
const HOST_NOT_ALLOWED = {
  type: "host-not-allowed",
  message: 'Host "mousehole-test:5010" not allowed. (Add to MOUSEHOLE_ALLOWED_HOSTS to permit it.)',
}
const NOT_FOUND = { type: "not-found", message: "Not Found" }

const NO_MOUSEHOLE_API =
  "Mousehole v0.5.0 or newer was not found at this URL. Use its root address, without /web"
const REDIRECTED =
  "Mousehole redirected the request. Save the address it ends up at, checking http or https"
const TOKEN_REJECTED =
  "Mousehole rejected the API token. Check that MOUSEHOLE_AUTH_TOKEN on Mousehole matches the token saved in this tracker's settings"

// ---------------------------------------------------------------------------
// fetch mock
// ---------------------------------------------------------------------------

interface MockRoute {
  status: number
  body?: unknown
  /** A raw non-JSON body, served as text/html. */
  text?: string
  throws?: Error
}

interface Recorded {
  url: string
  init: RequestInit | undefined
}

let requested: Recorded[]
let routes: Map<string, MockRoute>

function installFetchMock() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      requested.push({ url, init })
      const route = routes.get(url)
      if (!route) throw new Error(`unmocked fetch: ${url}`)
      if (route.throws) throw route.throws
      if (route.text !== undefined) {
        return new Response(route.text, {
          status: route.status,
          headers: { "content-type": "text/html" },
        })
      }
      return new Response(route.body === undefined ? null : JSON.stringify(route.body), {
        status: route.status,
        headers: { "content-type": "application/json" },
      })
    })
  )
}

function mockTrackerRow(overrides: Record<string, unknown> = {}) {
  const row = {
    platformType: "mam",
    mouseholeUrl: BASE,
    mouseholePublicUrl: null,
    encryptedMouseholeToken: encrypt(TOKEN, KEY),
    ...overrides,
  }
  const limit = vi.fn().mockResolvedValue([row])
  const where = vi.fn().mockReturnValue({ limit })
  const from = vi.fn().mockReturnValue({ where })
  ;(db.select as Mock).mockReturnValue({ from })
}

function makeContext() {
  return { params: Promise.resolve({ id: "1" }) }
}

function authorizationSentTo(url: string): string | undefined {
  const headers = requested.find((r) => r.url === url)?.init?.headers as
    Record<string, string> | undefined
  return headers?.Authorization
}

/** Every argument the route handed the logger, flattened so a token can be searched for. */
function loggedText(): string {
  // An Error's message and stack are not enumerable, so a logged error would
  // stringify to {} and hide a leak unless expanded here.
  return JSON.stringify(
    [log.info, log.warn, log.error, log.debug].flatMap((fn) => (fn as Mock).mock.calls),
    (_key, value) =>
      value instanceof Error
        ? { name: value.name, message: value.message, stack: value.stack, cause: value.cause }
        : value
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  requested = []
  routes = new Map()
  ;(authenticate as Mock).mockResolvedValue({ encryptionKey: KEY.toString("hex") })
  ;(parseTrackerId as Mock).mockResolvedValue(1)
  installFetchMock()
})

// ---------------------------------------------------------------------------

describe("GET /api/trackers/[id]/mousehole", () => {
  it("sends the decrypted token as a Bearer and keeps it out of every URL, the body and the log", async () => {
    routes.set(`${BASE}/health`, { status: 200, body: HEALTH_OK })
    routes.set(`${BASE}/state`, { status: 200, body: STATE_OK })
    mockTrackerRow()

    const response = await GET(new Request("http://localhost"), makeContext())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(requested.map((r) => r.url)).toEqual([`${BASE}/health`, `${BASE}/state`])
    expect(authorizationSentTo(`${BASE}/state`)).toBe(`Bearer ${TOKEN}`)
    for (const r of requested) {
      expect(r.url).not.toContain("@")
      expect(r.url).not.toContain(TOKEN)
      // A redirect would carry the Bearer to whatever host Mousehole named.
      expect(r.init?.redirect).toBe("error")
    }
    expect(body).toMatchObject({
      result: "ok",
      hasCookie: true,
      ip: "203.0.113.7",
      asn: 64496,
      asOrg: "Example Transit",
      lastMessage: "No change",
      stateError: null,
    })
    expect(JSON.stringify(body)).not.toContain(TOKEN)
    expect(loggedText()).not.toContain(TOKEN)
  })

  it("sends no Authorization header when no token is saved", async () => {
    routes.set(`${BASE}/health`, { status: 200, body: HEALTH_OK })
    routes.set(`${BASE}/state`, { status: 401, body: NO_CREDENTIALS })
    mockTrackerRow({ encryptedMouseholeToken: null })

    await GET(new Request("http://localhost"), makeContext())

    expect(authorizationSentTo(`${BASE}/state`)).toBeUndefined()
  })

  it("keeps a trailing slash in the saved URL out of the request paths", async () => {
    routes.set(`${BASE}/health`, { status: 200, body: HEALTH_OK })
    routes.set(`${BASE}/state`, { status: 200, body: STATE_OK })
    mockTrackerRow({ mouseholeUrl: `${BASE}/` })

    const response = await GET(new Request("http://localhost"), makeContext())

    expect(response.status).toBe(200)
    expect(requested.map((r) => r.url)).toEqual([`${BASE}/health`, `${BASE}/state`])
  })

  it("refuses an unparseable stored URL before any request", async () => {
    mockTrackerRow({ mouseholeUrl: "not a url" })

    const response = await GET(new Request("http://localhost"), makeContext())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: "Invalid Mousehole URL in database" })
    expect(log.warn).toHaveBeenCalled()
    expect(requested).toEqual([])
  })

  it("returns 500 when the saved token is not ciphertext at all", async () => {
    // Too short to hold an IV and auth tag, which decrypt() reports in words
    // isDecryptionError does not key on, so this is the non-stale failure.
    mockTrackerRow({ encryptedMouseholeToken: "AAAA" })

    const response = await GET(new Request("http://localhost"), makeContext())

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: "Failed to read the Mousehole API token",
    })
    expect(log.error).toHaveBeenCalled()
    expect(requested).toEqual([])
  })

  it("reports an unreadable /state body instead of failing the card", async () => {
    routes.set(`${BASE}/health`, { status: 200, body: HEALTH_OK })
    routes.set(`${BASE}/state`, { status: 200, text: "<html>not json</html>" })
    mockTrackerRow()

    const response = await GET(new Request("http://localhost"), makeContext())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.result).toBe("ok")
    expect(body.stateError).toBe("Mousehole returned an unreadable /state response")
  })

  it("returns 401 when the session key cannot open the saved token, before any request", async () => {
    mockTrackerRow({ encryptedMouseholeToken: encrypt(TOKEN, OTHER_KEY) })

    const response = await GET(new Request("http://localhost"), makeContext())

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      error: "Session expired. Please log in again.",
    })
    expect(requested).toEqual([])
  })

  it("refuses a stored URL that carries userinfo, before any request", async () => {
    mockTrackerRow({ mouseholeUrl: `http://:${TOKEN}@mousehole-test:5010` })

    const response = await GET(new Request("http://localhost"), makeContext())
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toMatch(/Mousehole API token field/)
    expect(JSON.stringify(body)).not.toContain(TOKEN)
    expect(requested).toEqual([])
  })

  it("maps a 404 from /health to the version message", async () => {
    routes.set(`${BASE}/health`, { status: 404, body: NOT_FOUND })
    routes.set(`${BASE}/state`, { status: 404, body: NOT_FOUND })
    mockTrackerRow()

    const response = await GET(new Request("http://localhost"), makeContext())

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toEqual({ error: NO_MOUSEHOLE_API })
  })

  it("maps a /health 200 without lastMamContactResult to the version message", async () => {
    routes.set(`${BASE}/health`, { status: 200, body: {} })
    routes.set(`${BASE}/state`, { status: 200, body: STATE_OK })
    mockTrackerRow()

    const response = await GET(new Request("http://localhost"), makeContext())

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toEqual({ error: NO_MOUSEHOLE_API })
  })

  it("maps v0.4.0's out-of-sync /health 503 to the version message", async () => {
    routes.set(`${BASE}/health`, {
      status: 503,
      body: { ok: false, isOnline: true, neededUpdateReason: "IP changed since last update" },
    })
    routes.set(`${BASE}/state`, { status: 404, body: NOT_FOUND })
    mockTrackerRow()

    const response = await GET(new Request("http://localhost"), makeContext())

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toEqual({ error: NO_MOUSEHOLE_API })
  })

  it("says MOUSEHOLE_AUTH_TOKEN must be set when /state is 401 and no token is saved", async () => {
    routes.set(`${BASE}/health`, { status: 200, body: HEALTH_OK })
    routes.set(`${BASE}/state`, { status: 401, body: NO_CREDENTIALS })
    mockTrackerRow({ encryptedMouseholeToken: null })

    const response = await GET(new Request("http://localhost"), makeContext())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.result).toBe("ok")
    expect(body.stateError).toContain("MOUSEHOLE_AUTH_TOKEN")
    expect(body.stateError).toContain("password")
    expect(body.stateError).not.toMatch(/rejected/i)
  })

  it("says the token was rejected when /state is 401 with a token saved", async () => {
    routes.set(`${BASE}/health`, { status: 200, body: HEALTH_OK })
    routes.set(`${BASE}/state`, { status: 401, body: UNAUTHORIZED })
    mockTrackerRow()

    const response = await GET(new Request("http://localhost"), makeContext())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.stateError).toBe(TOKEN_REJECTED)
    expect(JSON.stringify(body)).not.toContain(TOKEN)
  })

  it("passes Mousehole's host-not-allowed message through", async () => {
    routes.set(`${BASE}/health`, { status: 200, body: HEALTH_OK })
    routes.set(`${BASE}/state`, { status: 403, body: HOST_NOT_ALLOWED })
    mockTrackerRow()

    const response = await GET(new Request("http://localhost"), makeContext())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.stateError).toBe(HOST_NOT_ALLOWED.message)
  })

  it("logs a header refusal without the quoted token", async () => {
    // undici's wording when it refuses a header value.
    const refusal = new TypeError(`Headers.append: "Bearer ${TOKEN}" is an invalid header value.`)
    routes.set(`${BASE}/health`, { status: 200, throws: refusal })
    routes.set(`${BASE}/state`, { status: 200, throws: refusal })
    mockTrackerRow()

    const response = await GET(new Request("http://localhost"), makeContext())

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toEqual({ error: "Mousehole unreachable" })
    expect(log.warn).toHaveBeenCalled()
    expect(loggedText()).not.toContain(TOKEN)
  })

  it("says Mousehole redirected when fetch refuses a 3xx", async () => {
    // Node's fetch rejects a 3xx under redirect: "error" in this shape.
    const redirect = new TypeError("fetch failed", { cause: new Error("unexpected redirect") })
    routes.set(`${BASE}/health`, { status: 200, throws: redirect })
    routes.set(`${BASE}/state`, { status: 200, throws: redirect })
    mockTrackerRow()

    const response = await GET(new Request("http://localhost"), makeContext())
    const body = await response.json()

    expect(response.status).toBe(502)
    expect(body).toEqual({ error: REDIRECTED })
    expect(JSON.stringify(body)).not.toContain(TOKEN)
    expect(loggedText()).not.toContain(TOKEN)
  })

  it("returns 504 when Mousehole does not answer in time", async () => {
    const aborted = new Error("This operation was aborted")
    aborted.name = "AbortError"
    routes.set(`${BASE}/health`, { status: 200, throws: aborted })
    routes.set(`${BASE}/state`, { status: 200, throws: aborted })
    mockTrackerRow()

    const response = await GET(new Request("http://localhost"), makeContext())

    expect(response.status).toBe(504)
    await expect(response.json()).resolves.toEqual({ error: "Mousehole request timed out" })
  })
})

describe("POST /api/trackers/[id]/mousehole", () => {
  it("posts to /updates with the Bearer and no body", async () => {
    routes.set(`${BASE}/updates`, { status: 200, body: STATE_OK })
    mockTrackerRow()

    const response = await POST(new Request("http://localhost", { method: "POST" }), makeContext())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(requested.map((r) => r.url)).toEqual([`${BASE}/updates`])
    expect(requested[0].init?.method).toBe("POST")
    expect(requested[0].init?.body).toBeUndefined()
    expect(requested[0].init?.redirect).toBe("error")
    expect(authorizationSentTo(`${BASE}/updates`)).toBe(`Bearer ${TOKEN}`)
  })

  it("maps a 401 from /updates to the rejected-token message", async () => {
    routes.set(`${BASE}/updates`, { status: 401, body: UNAUTHORIZED })
    mockTrackerRow()

    const response = await POST(new Request("http://localhost", { method: "POST" }), makeContext())
    const body = await response.json()

    expect(response.status).toBe(502)
    expect(body.error).toBe(TOKEN_REJECTED)
    expect(JSON.stringify(body)).not.toContain(TOKEN)
  })
})
