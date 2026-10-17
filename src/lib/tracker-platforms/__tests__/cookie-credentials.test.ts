// src/lib/tracker-platforms/__tests__/cookie-credentials.test.ts
import { describe, expect, it } from "vitest"
import { parseCredentialJson } from "../helpers/cookie-credentials"

describe("parseCredentialJson", () => {
  it("returns the requested fields", () => {
    const creds = parseCredentialJson('{"username":"bob","password":"hunter2"}', "TorrentLeech", [
      "username",
      "password",
    ] as const)

    expect(creds).toEqual({ username: "bob", password: "hunter2" })
  })

  it("keeps extra fields off the required list intact", () => {
    const creds = parseCredentialJson('{"cookies":"a=1","userAgent":"UA","extra":"x"}', "IPT", [
      "cookies",
      "userAgent",
    ] as const)

    expect(creds.cookies).toBe("a=1")
    expect(creds.userAgent).toBe("UA")
  })

  it("does not normalize values - callers decide what may be trimmed", () => {
    const creds = parseCredentialJson('{"password":"  pad  "}', "X", ["password"] as const)

    expect(creds.password).toBe("  pad  ")
  })

  it("names the tracker and every field when the blob is not JSON", () => {
    expect(() =>
      parseCredentialJson("not json", "AvistaZ", ["cookies", "userAgent", "username"] as const)
    ).toThrow("AvistaZ credentials must be a JSON object with cookies, userAgent, and username")
  })

  it("joins two fields with 'and' rather than a comma", () => {
    expect(() =>
      parseCredentialJson("not json", "IPTorrents", ["cookies", "userAgent"] as const)
    ).toThrow("IPTorrents credentials must be a JSON object with cookies and userAgent")
  })

  it("reports the expected types when a field is the wrong type", () => {
    expect(() =>
      parseCredentialJson('{"cookies":"a=1","userAgent":42}', "IPTorrents", [
        "cookies",
        "userAgent",
      ] as const)
    ).toThrow("IPTorrents credentials must contain cookies (string) and userAgent (string)")
  })

  it("rejects a JSON array", () => {
    expect(() => parseCredentialJson("[]", "X", ["cookies"] as const)).toThrow("must contain")
  })

  it("rejects JSON null", () => {
    expect(() => parseCredentialJson("null", "X", ["cookies"] as const)).toThrow("must contain")
  })

  it("names the offending field when a value is blank", () => {
    expect(() =>
      parseCredentialJson('{"cookies":"a=1","userAgent":"   "}', "IPTorrents", [
        "cookies",
        "userAgent",
      ] as const)
    ).toThrow("IPTorrents credentials: userAgent cannot be empty")
  })
})

describe("parseCredentialJson optional fields", () => {
  const BLOB = '{"username":"bob","password":"hunter2","alt2FAToken":"tok123"}'

  it("returns an optional field when present", () => {
    const creds = parseCredentialJson(
      BLOB,
      "TorrentLeech",
      ["username", "password"],
      ["alt2FAToken"]
    )
    expect(creds.alt2FAToken).toBe("tok123")
  })

  it("omits an absent optional field without error", () => {
    const creds = parseCredentialJson(
      '{"username":"bob","password":"hunter2"}',
      "TorrentLeech",
      ["username", "password"],
      ["alt2FAToken"]
    )
    expect(creds.alt2FAToken).toBeUndefined()
  })

  it("throws when a present optional field is not a string", () => {
    expect(() =>
      parseCredentialJson(
        '{"username":"bob","password":"hunter2","alt2FAToken":123}',
        "TorrentLeech",
        ["username", "password"],
        ["alt2FAToken"]
      )
    ).toThrow("TorrentLeech credentials: alt2FAToken must be a string")
  })

  it("throws on a null optional field rather than passing it through", () => {
    expect(() =>
      parseCredentialJson(
        '{"username":"bob","password":"hunter2","alt2FAToken":null}',
        "TorrentLeech",
        ["username", "password"],
        ["alt2FAToken"]
      )
    ).toThrow("alt2FAToken must be a string")
  })

  it("does not require optional fields to be non-empty", () => {
    const creds = parseCredentialJson(
      '{"username":"bob","password":"hunter2","alt2FAToken":""}',
      "TorrentLeech",
      ["username", "password"],
      ["alt2FAToken"]
    )
    expect(creds.alt2FAToken).toBe("")
  })
})
