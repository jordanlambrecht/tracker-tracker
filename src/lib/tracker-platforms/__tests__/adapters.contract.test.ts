// src/lib/tracker-platforms/__tests__/adapters.contract.test.ts
//
// One set of rules applied to every registered adapter, so a new adapter
// inherits them. The credential-leak case matters most, since only adapter
// discipline keeps a credential out of errors and debug calls.

import fs from "node:fs"
import path from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_API_PATHS, VALID_PLATFORM_TYPES } from "@/data/platform-types"
import { getAdapter } from "@/lib/tracker-platforms"

/** Appears somewhere inside every credential below. Must never come back out. */
const CANARY = "CANARY9f3a2b1c0d4e5f6a7b8c9d0e1f2a3b"

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
const cookieBlob = (extra: Record<string, string> = {}) =>
  JSON.stringify({ cookies: `uid=1; pass=${CANARY}`, userAgent: UA, ...extra })

/**
 * A plausible credential per platform. Adding an adapter without adding an
 * entry here fails the first test below, which is the point: the registry is
 * the one place a contributor declares what their adapter needs to be driven.
 */
const CREDENTIALS: Record<string, string> = {
  unit3d: CANARY,
  gazelle: CANARY,
  ggn: CANARY,
  nebulance: CANARY,
  btn: CANARY,
  hawke: CANARY,
  animebytes: JSON.stringify({ token: CANARY, username: "someone" }),
  tr4ker: CANARY,
  c411: CANARY,
  mam: CANARY,
  avistaz: cookieBlob({ username: "someone" }),
  filelist: cookieBlob(),
  iptorrents: cookieBlob(),
  retrotoon: cookieBlob(),
  torrentleech: JSON.stringify({ username: "someone", password: CANARY }),
  funfile: JSON.stringify({ username: "someone", password: CANARY }),
  digitalcore: JSON.stringify({ uid: "54321", pass: CANARY }),
  luminance: JSON.stringify({ username: "someone", password: CANARY }),
}

/**
 * BTN serves its API from a fixed host, not the configured baseUrl, so its
 * errors name that host. Declaring it is a claim that the host is part of the
 * protocol. A second adapter like this wants a lookup, not a second const.
 */
const BTN_API_HOST = "api.broadcasthe.net"

const HOST = "tracker.example"
const BASE_URL = `https://${HOST}`
const PLATFORMS = VALID_PLATFORM_TYPES.filter((p) => p !== "custom")

const ADAPTERS_DIR = path.resolve(process.cwd(), "src/lib/tracker-platforms/adapters")
const adapterSource = (platform: string) =>
  fs.readFileSync(path.join(ADAPTERS_DIR, `${platform}.ts`), "utf8")

/**
 * Platforms whose credential is a JSON blob, so a malformed one must throw.
 *
 * Read from the adapter sources, not hand-listed: the case below sits inside an
 * `if`, so a blob adapter missing from the set skips it silently, and a skipped
 * case reads like a passing one.
 *
 * Two spellings, because `digitalcore.ts` hand-rolls its parser instead of
 * calling `parseCredentialJson`.
 */
const JSON_BLOB_PLATFORMS = new Set(
  PLATFORMS.filter((p) => /parseCredentialJson|JSON\.parse\(apiToken/.test(adapterSource(p)))
)

/**
 * Platforms that put a plain token in a request header, read from the sources
 * for the same reason as the blob set. An adapter that skips the guard drops out
 * of this set, but the malformed-credential case below still catches it.
 */
const HEADER_TOKEN_PLATFORMS = new Set(
  PLATFORMS.filter((p) => /validateHeaderToken\(apiToken\)/.test(adapterSource(p)))
)

const pathFor = (platform: string) => DEFAULT_API_PATHS[platform] ?? "/"

/** Whether a platform's own fixture is a JSON blob rather than a plain token. */
function isJsonObject(platform: string): boolean {
  try {
    return typeof JSON.parse(CREDENTIALS[platform]) === "object"
  } catch {
    return false
  }
}

/** Everything an adapter could put in front of a user, as one string. */
function surfaceOf(value: unknown): string {
  if (value instanceof Error) return `${value.name} ${value.message} ${value.stack ?? ""}`
  return JSON.stringify(value) ?? String(value)
}

async function drive(platform: string) {
  const adapter = getAdapter(platform)
  const token = CREDENTIALS[platform]
  const path = pathFor(platform)
  const surfaces: string[] = []

  await adapter
    .fetchStats(BASE_URL, token, path)
    .then((stats) => surfaces.push(surfaceOf(stats)))
    .catch((err: unknown) => surfaces.push(surfaceOf(err)))

  await adapter
    .fetchRaw(BASE_URL, token, path)
    .then((calls) => surfaces.push(surfaceOf(calls)))
    .catch((err: unknown) => surfaces.push(surfaceOf(err)))

  return surfaces.join("\n")
}

describe("every registered adapter", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("has a credential fixture, so the rules below actually run against it", () => {
    const missing = PLATFORMS.filter((p) => !CREDENTIALS[p])
    expect(missing).toEqual([])
  })

  it("agrees with the fixtures about which credentials are JSON blobs", () => {
    // The source pattern can miss an adapter silently and skip its blob case.
    // The fixtures cross-check it, so a platform the pattern calls a blob must
    // have a JSON fixture and the rest must not.
    const disagree = PLATFORMS.filter((p) => JSON_BLOB_PLATFORMS.has(p) !== isJsonObject(p))
    expect(disagree).toEqual([])
  })

  for (const platform of PLATFORMS) {
    describe(platform, () => {
      it("never lets the credential reach an error, a thrown message or a debug call", async () => {
        // Two shapes of failure, because adapters word them differently: a
        // transport rejection and an authenticated-but-refused response.
        for (const mock of [
          () => Promise.reject(new TypeError("fetch failed")),
          () =>
            Promise.resolve({
              ok: false,
              status: 401,
              statusText: "Unauthorized",
              headers: { get: () => null, getSetCookie: () => [] },
              text: async () => "denied",
              json: async () => ({ error: "denied" }),
            } as unknown as Response),
        ]) {
          vi.spyOn(global, "fetch").mockImplementation(mock as unknown as typeof fetch)
          const surface = await drive(platform)
          expect(surface).not.toContain(CANARY)
        }
      })

      it("names the host when the request times out", async () => {
        vi.spyOn(global, "fetch").mockRejectedValue(
          Object.assign(new Error("The operation was aborted due to timeout"), {
            name: "TimeoutError",
          })
        )

        const err = await getAdapter(platform)
          .fetchStats(BASE_URL, CREDENTIALS[platform], pathFor(platform))
          .then(() => null)
          .catch((e: unknown) => (e instanceof Error ? e : null))

        expect(err).not.toBeNull()
        // Without a host the card cannot say which tracker went quiet.
        expect(err?.message).toContain(platform === "btn" ? BTN_API_HOST : HOST)
      })

      it("returns debug calls with the declared shape and a Title Case label", async () => {
        vi.spyOn(global, "fetch").mockResolvedValue({
          ok: false,
          status: 401,
          statusText: "Unauthorized",
          headers: { get: () => null, getSetCookie: () => [] },
          text: async () => "denied",
          json: async () => ({ error: "denied" }),
        } as unknown as Response)

        const calls = await getAdapter(platform)
          .fetchRaw(BASE_URL, CREDENTIALS[platform], pathFor(platform))
          .catch(() => null)

        // An adapter is allowed to throw here; what it must not do is resolve
        // with a malformed entry.
        if (calls === null) return
        expect(Array.isArray(calls)).toBe(true)
        for (const call of calls) {
          expect(typeof call.label).toBe("string")
          expect(typeof call.endpoint).toBe("string")
          expect(call.error === null || typeof call.error === "string").toBe(true)
          expect(call.label).toMatch(/^[A-Z]/)
        }
      })

      it("keeps a malformed credential out of every request header and every surface", async () => {
        // A credential carrying a control character must be refused before it
        // reaches a header (standard 2.5). If one ever got there, undici would
        // throw a TypeError quoting the whole header, credential included, and
        // classifyFetchError refuses to trust that message. A plain token gets
        // a real CR LF; a blob gets the JSON escape, which its parser decodes.
        const injected = JSON_BLOB_PLATFORMS.has(platform) ? "\\r\\nX: 1" : "\r\nX: 1"
        const dirty = CREDENTIALS[platform].replace(CANARY, `${CANARY}${injected}`)
        const sentHeaders: string[] = []
        vi.spyOn(global, "fetch").mockImplementation(((...args: unknown[]) => {
          const init = args[1] as { headers?: Record<string, string> } | undefined
          // Recorded as passed. Headers would throw on the very value under test.
          const quoted = JSON.stringify(init?.headers ?? {})
          sentHeaders.push(quoted)
          // What undici actually does: name the offending header value.
          return Promise.reject(new TypeError(`Headers.append: "${quoted}" is invalid`))
        }) as unknown as typeof fetch)

        const adapter = getAdapter(platform)
        const surfaces: string[] = []
        await adapter
          .fetchStats(BASE_URL, dirty, pathFor(platform))
          .then((s) => surfaces.push(surfaceOf(s)))
          .catch((e: unknown) => surfaces.push(surfaceOf(e)))
        await adapter
          .fetchRaw(BASE_URL, dirty, pathFor(platform))
          .then((c) => surfaces.push(surfaceOf(c)))
          .catch((e: unknown) => surfaces.push(surfaceOf(e)))

        expect(sentHeaders.join("\n")).not.toContain(CANARY)
        expect(surfaces.join("\n")).not.toContain(CANARY)
      })
      if (JSON_BLOB_PLATFORMS.has(platform)) {
        it("throws on a malformed credential blob rather than reporting it as a call", async () => {
          vi.spyOn(global, "fetch").mockResolvedValue({
            ok: true,
            status: 200,
            statusText: "OK",
            headers: { get: () => null, getSetCookie: () => [] },
            text: async () => "{}",
            json: async () => ({}),
          } as unknown as Response)

          // Parsed outside the try, so the route sees the real reason instead
          // of a call list with one useless entry.
          await expect(
            getAdapter(platform).fetchRaw(BASE_URL, "not-a-json-blob", pathFor(platform))
          ).rejects.toThrow()
        })
      }
      if (HEADER_TOKEN_PLATFORMS.has(platform)) {
        it("sends the trimmed token, since https.request refuses a stored line break", async () => {
          const sent: string[] = []
          vi.spyOn(global, "fetch").mockImplementation(((...args: unknown[]) => {
            const init = args[1] as { headers?: Record<string, string> } | undefined
            sent.push(...Object.values(init?.headers ?? {}))
            return Promise.reject(new TypeError("fetch failed"))
          }) as unknown as typeof fetch)

          const adapter = getAdapter(platform)
          await adapter.fetchStats(BASE_URL, `  ${CANARY}\n`, pathFor(platform)).catch(() => null)
          await adapter.fetchRaw(BASE_URL, `  ${CANARY}\n`, pathFor(platform))

          const carrying = sent.filter((value) => value.includes(CANARY))
          expect(carrying.length).toBeGreaterThan(1)
          for (const value of carrying) expect(value).toMatch(new RegExp(`(^| )${CANARY}$`))
        })

        it("throws on a malformed token rather than reporting it as a call", async () => {
          const fetchSpy = vi.spyOn(global, "fetch")

          await expect(
            getAdapter(platform).fetchRaw(BASE_URL, `${CANARY}\r\nX: 1`, pathFor(platform))
          ).rejects.toThrow("Invalid API token")
          expect(fetchSpy).not.toHaveBeenCalled()
        })
      }
    })
  }
})
