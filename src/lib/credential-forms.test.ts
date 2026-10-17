// src/lib/credential-forms.test.ts
//
// Pins the stored blob shapes, which are a contract with the adapters'
// parseCredentialJson key lists, and the cookie messages a user acts on.

import { describe, expect, it } from "vitest"
import { VALID_PLATFORM_TYPES } from "@/data/platform-types"
import {
  buildCredentialBlob,
  CREDENTIAL_FORMS,
  credentialFormFor,
  credentialFormForPlatform,
  EMPTY_CREDENTIAL_VALUES,
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
  })
})

describe("credentialFormFor", () => {
  it("hides the Join Date for a gazelle tracker that enriches", () => {
    expect(credentialFormFor({ platform: "gazelle", gazelleEnrich: true }).hidesJoinDate).toBe(true)
  })

  it("shows the Join Date field for a gazelle tracker without enrichment", () => {
    expect(credentialFormFor({ platform: "gazelle" }).hidesJoinDate).toBe(false)
  })

  it("hides the Join Date field for exactly avistaz, digitalcore, filelist, ggn, and retrotoon", () => {
    const hidden = VALID_PLATFORM_TYPES.filter((p) => CREDENTIAL_FORMS[p].hidesJoinDate)
    expect([...hidden].sort()).toEqual(
      ["avistaz", "digitalcore", "filelist", "ggn", "retrotoon"].sort()
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
  it("rejects a token carrying a line break inside it", () => {
    expect(validateCredentialValues(CREDENTIAL_FORMS.unit3d, values({ token: "abc\n123" }))).toBe(
      "API token contains a control character. Re-copy the token with no surrounding text."
    )
  })

  it("accepts a token pasted with surrounding whitespace", () => {
    expect(
      validateCredentialValues(CREDENTIAL_FORMS.unit3d, values({ token: "  abc123\n" }))
    ).toBeNull()
  })
})
