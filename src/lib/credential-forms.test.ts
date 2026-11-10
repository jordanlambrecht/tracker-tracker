// src/lib/credential-forms.test.ts
//
// Pins the stored blob shapes, which are a contract with the adapters'
// parseCredentialJson key lists, the cookie messages a user acts on, and the
// length cap each credential kind gets at the routes.

import { describe, expect, it } from "vitest"
import { VALID_PLATFORM_TYPES } from "@/data/platform-types"
import { LARGE_TOKEN_MAX, TRACKER_TOKEN_MAX } from "@/lib/limits"
import {
  buildCredentialBlob,
  CREDENTIAL_FORMS,
  credentialFormFor,
  credentialFormForPlatform,
  EMPTY_CREDENTIAL_VALUES,
  maxTokenLengthFor,
  validateCredentialValues,
} from "./credential-forms"

const UA = "Mozilla/5.0 (Test)"

function values(overrides: Partial<typeof EMPTY_CREDENTIAL_VALUES> = {}) {
  return { ...EMPTY_CREDENTIAL_VALUES, ...overrides }
}

function blob(platform: (typeof VALID_PLATFORM_TYPES)[number], overrides = {}) {
  return JSON.parse(buildCredentialBlob(CREDENTIAL_FORMS[platform], values(overrides), UA))
}

describe("CREDENTIAL_FORMS coverage", () => {
  it("has a row for every platform type", () => {
    expect(Object.keys(CREDENTIAL_FORMS).sort()).toEqual([...VALID_PLATFORM_TYPES].sort())
  })

  it("mirrors each cookie adapter's own example and extra cookie names", () => {
    // A client message that names different cookies than the adapter's would
    // send the user looking for the wrong value.
    expect(CREDENTIAL_FORMS.retrotoon).toMatchObject({
      extraCookieNames: ["PHPSESSID", "uid", "pass"],
      example: "PHPSESSID=abc123def456",
    })
    expect(CREDENTIAL_FORMS.filelist).toMatchObject({
      extraCookieNames: ["uid", "pass"],
      example: "uid=123; pass=abc123",
    })
    expect(CREDENTIAL_FORMS.avistaz).toMatchObject({
      extraCookieNames: ["love"],
      example: "cf_clearance=abc123; session=xyz",
    })
    expect(CREDENTIAL_FORMS.luminance.sessionCookie).toEqual({
      example: "sid=abc123",
      extraCookieNames: ["sid"],
      requiredCookieNames: ["sid"],
    })
  })
})

describe("credentialFormFor", () => {
  it("hides the Join Date for a gazelle tracker that enriches", () => {
    expect(credentialFormFor({ platform: "gazelle", gazelleEnrich: true }).hidesJoinDate).toBe(true)
  })

  it("shows the Join Date field for a gazelle tracker without enrichment", () => {
    expect(credentialFormFor({ platform: "gazelle" }).hidesJoinDate).toBe(false)
  })

  it("hides the Join Date field for exactly avistaz, c411, digitalcore, filelist, ggn, iptorrents, luminance, retrotoon, and funfile", () => {
    const hidden = VALID_PLATFORM_TYPES.filter((p) => CREDENTIAL_FORMS[p].hidesJoinDate)
    expect([...hidden].sort()).toEqual(
      [
        "avistaz",
        "c411",
        "digitalcore",
        "filelist",
        "ggn",
        "iptorrents",
        "luminance",
        "retrotoon",
        "funfile",
      ].sort()
    )
  })
})

describe("credentialFormForPlatform", () => {
  it("falls back to the plain token form for a platform this build does not know", () => {
    expect(credentialFormForPlatform("some-future-platform")).toBe(CREDENTIAL_FORMS.custom)
  })

  it("returns the platform's own row when it exists", () => {
    expect(credentialFormForPlatform("retrotoon")).toBe(CREDENTIAL_FORMS.retrotoon)
  })

  it("treats an inherited object property name as unknown", () => {
    expect(credentialFormForPlatform("constructor")).toBe(CREDENTIAL_FORMS.custom)
    expect(credentialFormForPlatform("__proto__")).toBe(CREDENTIAL_FORMS.custom)
  })
})

describe("maxTokenLengthFor", () => {
  it.each([
    ["unit3d", TRACKER_TOKEN_MAX], // token
    ["animebytes", TRACKER_TOKEN_MAX], // token-username
    ["iptorrents", LARGE_TOKEN_MAX], // cookies
    ["avistaz", LARGE_TOKEN_MAX], // cookies-username
    ["digitalcore", LARGE_TOKEN_MAX], // uid-pass
    ["torrentleech", LARGE_TOKEN_MAX], // login
    ["luminance", LARGE_TOKEN_MAX], // login with a session cookie
  ])("caps %s at %i", (platform, cap) => {
    expect(maxTokenLengthFor(platform)).toBe(cap)
  })

  it("gives the token cap when the platform is missing or unknown", () => {
    expect(maxTokenLengthFor(null)).toBe(TRACKER_TOKEN_MAX)
    expect(maxTokenLengthFor(undefined)).toBe(TRACKER_TOKEN_MAX)
    expect(maxTokenLengthFor("")).toBe(TRACKER_TOKEN_MAX)
    expect(maxTokenLengthFor("some-future-platform")).toBe(TRACKER_TOKEN_MAX)
  })

  // A minimal IPTorrents blob (cf_clearance + uid + pass + UA) lands around
  // 390-480 chars, so it squeaks under the old 500 cap. Once the session also
  // carries remember_web/XSRF cookies it runs past 700. The old cap therefore
  // failed unpredictably depending on the user's cookie set, the large cap
  // removes that cliff.
  const iptBlob = (cookies: string) =>
    JSON.stringify({ cookies, userAgent: `Mozilla/5.0 ${"z".repeat(120)}` })

  it("admits a full IPTorrents session blob that the plain cap would reject", () => {
    const full = iptBlob(
      `cf_clearance=${"x".repeat(250)}; uid=123456; pass=${"y".repeat(32)}; ` +
        `remember_web_59ba36=${"w".repeat(180)}; XSRF-TOKEN=${"v".repeat(40)}`
    )
    expect(full.length).toBeGreaterThan(TRACKER_TOKEN_MAX)
    expect(full.length).toBeLessThanOrEqual(maxTokenLengthFor("iptorrents"))
  })

  it("also admits a minimal blob that happened to fit under the old cap", () => {
    const minimal = iptBlob(`cf_clearance=${"x".repeat(250)}; uid=123456; pass=${"y".repeat(32)}`)
    expect(minimal.length).toBeLessThanOrEqual(maxTokenLengthFor("iptorrents"))
  })
})

describe("buildCredentialBlob", () => {
  it("returns the trimmed token itself for token platforms", () => {
    expect(buildCredentialBlob(CREDENTIAL_FORMS.unit3d, values({ token: "  abc123  " }), UA)).toBe(
      "abc123"
    )
  })

  it("pairs cookies with the user agent", () => {
    expect(blob("filelist", { cookies: "uid=123; pass=abc" })).toEqual({
      cookies: "uid=123; pass=abc",
      userAgent: UA,
    })
  })

  it("strips a copied Cookie: prefix", () => {
    expect(blob("retrotoon", { cookies: "Cookie: PHPSESSID=abc123" }).cookies).toBe(
      "PHPSESSID=abc123"
    )
  })

  it("adds the username for avistaz", () => {
    expect(blob("avistaz", { cookies: "love=yes", username: "  bob  " })).toEqual({
      cookies: "love=yes",
      userAgent: UA,
      username: "bob",
    })
  })

  it("pairs the token with the username for animebytes", () => {
    expect(blob("animebytes", { token: "  abc123  ", username: "  bob  " })).toEqual({
      token: "abc123",
      username: "bob",
    })
  })

  it("splits uid and pass out of the digitalcore cookie string", () => {
    expect(blob("digitalcore", { cookies: "uid=56954; pass=abc123def456" })).toEqual({
      uid: "56954",
      pass: "abc123def456",
      userAgent: UA,
    })
  })

  it("omits alt2FAToken entirely when none is entered", () => {
    const built = blob("torrentleech", { username: "bob", password: "hunter2" })
    expect(built).toEqual({ username: "bob", password: "hunter2" })
    expect("alt2FAToken" in built).toBe(false)
  })

  it("includes alt2FAToken when one is entered", () => {
    expect(
      blob("torrentleech", { username: "bob", password: "hunter2", alt2FAToken: " tok123 " })
    ).toEqual({ username: "bob", password: "hunter2", alt2FAToken: "tok123" })
  })

  it("keeps the password exactly as typed", () => {
    // Trimming a password silently changes the secret the user chose.
    expect(blob("torrentleech", { username: "bob", password: "  hunter2  " }).password).toBe(
      "  hunter2  "
    )
  })

  // The adapter takes the cookie path when the blob has cookies, and that
  // session is fingerprinted against the browser it was issued to.
  it("stores a luminance session cookie with the browser's User-Agent and no password", () => {
    expect(
      blob("luminance", { username: " bob ", password: "hunter2", cookies: "Cookie: sid=abc" })
    ).toEqual({ username: "bob", cookies: "sid=abc", userAgent: UA })
  })

  it("stores a luminance password login with no cookie keys", () => {
    expect(blob("luminance", { username: "bob", password: "hunter2" })).toEqual({
      username: "bob",
      password: "hunter2",
    })
  })
})

describe("validateCredentialValues empty fields", () => {
  it("names the missing token", () => {
    expect(validateCredentialValues(CREDENTIAL_FORMS.unit3d, values())).toBe(
      "API token is required"
    )
  })

  it("names the missing cookies", () => {
    expect(validateCredentialValues(CREDENTIAL_FORMS.iptorrents, values())).toBe(
      "Browser cookies are required"
    )
  })

  it("asks for the avistaz username before the cookies", () => {
    expect(validateCredentialValues(CREDENTIAL_FORMS.avistaz, values())).toBe(
      "Username is required"
    )
    expect(validateCredentialValues(CREDENTIAL_FORMS.avistaz, values({ username: "bob" }))).toBe(
      "Browser cookies are required"
    )
  })

  it("asks for the animebytes username before the token", () => {
    expect(validateCredentialValues(CREDENTIAL_FORMS.animebytes, values())).toBe(
      "Username is required"
    )
    expect(validateCredentialValues(CREDENTIAL_FORMS.animebytes, values({ username: "bob" }))).toBe(
      "API token is required"
    )
  })

  it("names the missing session cookies for digitalcore", () => {
    expect(validateCredentialValues(CREDENTIAL_FORMS.digitalcore, values())).toBe(
      "Session cookies are required"
    )
  })

  it("names the missing uid and then the missing pass", () => {
    expect(
      validateCredentialValues(CREDENTIAL_FORMS.digitalcore, values({ cookies: "pass=abc" }))
    ).toBe("Cookie string is missing uid value. Paste the full Cookie header from DevTools.")
    expect(
      validateCredentialValues(CREDENTIAL_FORMS.digitalcore, values({ cookies: "uid=123" }))
    ).toBe("Cookie string is missing pass value. Paste the full Cookie header from DevTools.")
  })

  it("asks for the login username before the password", () => {
    expect(validateCredentialValues(CREDENTIAL_FORMS.torrentleech, values())).toBe(
      "Username is required"
    )
    expect(
      validateCredentialValues(CREDENTIAL_FORMS.torrentleech, values({ username: "bob" }))
    ).toBe("Password is required")
  })

  it("takes a luminance password or a session cookie, checking the cookie as the adapter does", () => {
    const luminance = CREDENTIAL_FORMS.luminance
    expect(validateCredentialValues(luminance, values())).toBe("Username is required")
    expect(validateCredentialValues(luminance, values({ username: "bob" }))).toBe(
      "Password or session cookie is required"
    )
    expect(
      validateCredentialValues(luminance, values({ username: "bob", password: "pw" }))
    ).toBeNull()
    expect(
      validateCredentialValues(luminance, values({ username: "bob", cookies: "sid=abc; cid=1" }))
    ).toBeNull()
    expect(
      validateCredentialValues(luminance, values({ username: "bob", cookies: "cid=1" }))
    ).toContain("no sid cookie")
  })

  it("accepts a complete set", () => {
    expect(
      validateCredentialValues(CREDENTIAL_FORMS.filelist, values({ cookies: "uid=1; pass=2" }))
    ).toBeNull()
  })
})

describe("validateCredentialValues cookie hygiene", () => {
  it("names a bare cookie name pasted on its own", () => {
    expect(
      validateCredentialValues(CREDENTIAL_FORMS.retrotoon, values({ cookies: "PHPSESSID" }))
    ).toContain('you pasted a cookie name ("PHPSESSID")')
    expect(
      validateCredentialValues(CREDENTIAL_FORMS.filelist, values({ cookies: "uid" }))
    ).toContain('you pasted a cookie name ("uid")')
  })

  it("quotes the platform's own example when there is no key=value pair", () => {
    expect(
      validateCredentialValues(CREDENTIAL_FORMS.retrotoon, values({ cookies: "justastring" }))
    ).toContain("PHPSESSID=abc123def456")
  })

  it("rejects a pasted header block without echoing the cookie value", () => {
    const message = validateCredentialValues(
      CREDENTIAL_FORMS.retrotoon,
      values({ cookies: "PHPSESSID=SUPERSECRET\r\nHost: retrotoon.world" })
    )
    expect(message).toContain("U+000D")
    expect(message).not.toContain("SUPERSECRET")
  })

  it("rejects a truncated value", () => {
    expect(
      validateCredentialValues(CREDENTIAL_FORMS.filelist, values({ cookies: "uid=1; pass=abc…" }))
    ).toContain("non-ASCII")
  })

  it("rejects a truncated digitalcore uid or pass before submit", () => {
    expect(
      validateCredentialValues(
        CREDENTIAL_FORMS.digitalcore,
        values({ cookies: "uid=56954; pass=abc123…" })
      )
    ).toBe(
      "Cookie values contain a non-ASCII character, usually a truncation mark. Re-copy the full Cookie header from DevTools."
    )
  })

  it("rejects a control character inside a digitalcore uid or pass before submit", () => {
    expect(
      validateCredentialValues(
        CREDENTIAL_FORMS.digitalcore,
        values({ cookies: "uid=54\u000021; pass=abc" })
      )
    ).toBe("Cookie values contain a control character. Paste the full Cookie header from DevTools.")
  })
})

describe("validateCredentialValues token hygiene", () => {
  // The form shows the adapters' own check, so the pre-save message matches the
  // one a poll would give.
  it("rejects a token carrying a line break inside it", () => {
    expect(validateCredentialValues(CREDENTIAL_FORMS.unit3d, values({ token: "abc\n123" }))).toBe(
      "Invalid API token: it contains a control character (U+000A) at position 3. Re-copy the token with no surrounding text."
    )
  })

  it("rejects a token a browser truncated on copy", () => {
    expect(validateCredentialValues(CREDENTIAL_FORMS.unit3d, values({ token: "abc123…" }))).toBe(
      "Invalid API token: it contains a non-Latin-1 character (U+2026) at position 6, usually a truncation mark. Re-copy the full token."
    )
  })

  it("accepts a token pasted with surrounding whitespace", () => {
    expect(
      validateCredentialValues(CREDENTIAL_FORMS.unit3d, values({ token: "  abc123\n" }))
    ).toBeNull()
  })
})

describe("validateCredentialValues username hygiene", () => {
  // The form shows the AnimeBytes adapter's own check, before the token's.
  it("rejects an animebytes username over 100 characters", () => {
    expect(
      validateCredentialValues(CREDENTIAL_FORMS.animebytes, values({ username: "a".repeat(101) }))
    ).toBe("Invalid username: it is longer than 100 characters.")
  })

  it("rejects an animebytes username carrying a control character", () => {
    expect(
      validateCredentialValues(
        CREDENTIAL_FORMS.animebytes,
        values({ username: "some\u0000one", token: "abc123" })
      )
    ).toBe("Invalid username: it contains a control character (U+0000) at position 4.")
  })
})
