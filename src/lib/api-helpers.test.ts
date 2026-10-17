// src/lib/api-helpers.test.ts

import { describe, expect, it } from "vitest"
import { localDateStr } from "@/lib/formatters"
import { CREDENTIAL_MAX } from "@/lib/limits"
import {
  validateHttpUrl,
  validateLastAccessAt,
  validateMouseholeToken,
  validateMouseholeUrl,
} from "./api-helpers"

describe("validateHttpUrl", () => {
  it("accepts a public HTTPS URL", () => {
    expect(validateHttpUrl("https://aither.cc/api/user")).toBeNull()
  })

  it("rejects loopback hostnames", async () => {
    const response = validateHttpUrl("http://localhost:8080")
    expect(response?.status).toBe(400)
    await expect(response?.json()).resolves.toEqual({
      error: "baseUrl must not target localhost or a private network address",
    })
  })

  it("rejects loopback hostnames with trailing dots", async () => {
    const response = validateHttpUrl("http://localhost.:8080")
    expect(response?.status).toBe(400)
    await expect(response?.json()).resolves.toEqual({
      error: "baseUrl must not target localhost or a private network address",
    })
  })

  it("rejects loopback IPv4 addresses", async () => {
    const response = validateHttpUrl("http://127.0.0.1:8080")
    expect(response?.status).toBe(400)
    await expect(response?.json()).resolves.toEqual({
      error: "baseUrl must not target localhost or a private network address",
    })
  })

  it("rejects RFC1918 private IPv4 ranges", async () => {
    const response = validateHttpUrl("http://192.168.1.25")
    expect(response?.status).toBe(400)
    await expect(response?.json()).resolves.toEqual({
      error: "baseUrl must not target localhost or a private network address",
    })
  })

  it("rejects link-local and metadata IPv4 ranges", async () => {
    const response = validateHttpUrl("http://169.254.169.254/latest/meta-data")
    expect(response?.status).toBe(400)
    await expect(response?.json()).resolves.toEqual({
      error: "baseUrl must not target localhost or a private network address",
    })
  })

  it("rejects loopback IPv6 addresses", async () => {
    const response = validateHttpUrl("http://[::1]/admin")
    expect(response?.status).toBe(400)
    await expect(response?.json()).resolves.toEqual({
      error: "baseUrl must not target localhost or a private network address",
    })
  })

  it("rejects IPv4-mapped IPv6 loopback addresses", async () => {
    const response = validateHttpUrl("http://[::ffff:127.0.0.1]/admin")
    expect(response?.status).toBe(400)
    await expect(response?.json()).resolves.toEqual({
      error: "baseUrl must not target localhost or a private network address",
    })
  })

  it("rejects 10.x.x.x private range", async () => {
    const response = validateHttpUrl("http://10.0.0.1/api")
    expect(response?.status).toBe(400)
  })

  it("rejects 172.16.x.x private range", async () => {
    const response = validateHttpUrl("http://172.16.0.1/api")
    expect(response?.status).toBe(400)
  })

  it("rejects 0.0.0.0", async () => {
    const response = validateHttpUrl("http://0.0.0.0/api")
    expect(response?.status).toBe(400)
  })

  it("rejects IPv6 ULA (fc00::)", async () => {
    const response = validateHttpUrl("http://[fc00::1]/api")
    expect(response?.status).toBe(400)
  })

  it("rejects IPv6 link-local (fe80::)", async () => {
    const response = validateHttpUrl("http://[fe80::1]/api")
    expect(response?.status).toBe(400)
  })

  it("rejects .local mDNS domains", async () => {
    const response = validateHttpUrl("http://tracker.local/api")
    expect(response?.status).toBe(400)
  })

  it("rejects ip6-localhost", async () => {
    const response = validateHttpUrl("http://ip6-localhost/api")
    expect(response?.status).toBe(400)
  })

  it("rejects IPv4-mapped IPv6 hex notation", async () => {
    const response = validateHttpUrl("http://[::ffff:7f00:1]/api")
    expect(response?.status).toBe(400)
  })

  it("rejects shorthand IPv4 loopback (127.1)", async () => {
    const response = validateHttpUrl("http://127.1/api")
    expect(response?.status).toBe(400)
  })

  it("rejects shorthand IPv4 loopback (127.0.1)", async () => {
    const response = validateHttpUrl("http://127.0.1/api")
    expect(response?.status).toBe(400)
  })

  it("rejects single-octet loopback (2130706433)", async () => {
    // 2130706433 = 0x7F000001 = 127.0.0.1
    const response = validateHttpUrl("http://2130706433/api")
    expect(response?.status).toBe(400)
  })

  it("rejects shorthand private range (10.1)", async () => {
    const response = validateHttpUrl("http://10.1/api")
    expect(response?.status).toBe(400)
  })
})

describe("validateMouseholeUrl", () => {
  // A Compose service name is a single label, which must pass the private-address rule.
  it("accepts a plain http URL on a single-label Docker hostname", () => {
    expect(validateHttpUrl("http://mousehole:5010", "Mousehole URL")).toBeNull()
    expect(validateMouseholeUrl("http://mousehole:5010")).toBeNull()
  })

  it("rejects a token in the password slot and points at the token field", async () => {
    const response = validateMouseholeUrl("http://:fake-token-7f3a@mousehole:5010")
    expect(response?.status).toBe(400)
    const body = await response?.json()
    expect(body.error).toMatch(/Mousehole API token field/)
    expect(JSON.stringify(body)).not.toContain("fake-token-7f3a")
  })

  it("rejects a token in the username slot", async () => {
    const response = validateMouseholeUrl("http://fake-token-7f3a@mousehole:5010")
    expect(response?.status).toBe(400)
    await expect(response?.json()).resolves.toMatchObject({
      error: expect.stringMatching(/Mousehole API token field/),
    })
  })

  it("keeps the private-address rule", async () => {
    const response = validateMouseholeUrl("http://127.0.0.1:5010")
    expect(response?.status).toBe(400)
    await expect(response?.json()).resolves.toEqual({
      error: "Mousehole URL must not target localhost or a private network address",
    })
  })
})

describe("validateMouseholeToken", () => {
  it("accepts a plain token", () => {
    expect(validateMouseholeToken("fake-token-7f3a")).toBeNull()
  })

  it("rejects a control character, naming it without echoing the token", async () => {
    const response = validateMouseholeToken("fake-token\r\nleak")
    expect(response?.status).toBe(400)
    const body = await response?.json()
    expect(body.error).toMatch(/control character \(U\+000D\) at position 10/)
    expect(body.error).not.toContain("fake-token")
  })

  it("rejects a non-Latin-1 character, naming it without echoing the token", async () => {
    const response = validateMouseholeToken("fake-token…")
    expect(response?.status).toBe(400)
    const body = await response?.json()
    expect(body.error).toMatch(/non-Latin-1 character \(U\+2026\) at position 10/)
    expect(body.error).not.toContain("fake-token")
  })

  it("rejects a token over the credential limit", async () => {
    const response = validateMouseholeToken("t".repeat(CREDENTIAL_MAX + 1))
    expect(response?.status).toBe(400)
    await expect(response?.json()).resolves.toEqual({
      error: `Mousehole API token must be ${CREDENTIAL_MAX} characters or fewer`,
    })
  })
})

describe("validateLastAccessAt", () => {
  it("accepts a valid past date", () => {
    expect(validateLastAccessAt("2020-01-01")).toBeNull()
  })

  it("accepts today's date", () => {
    expect(validateLastAccessAt(localDateStr())).toBeNull()
  })

  it("rejects a malformed date", async () => {
    const response = validateLastAccessAt("not-a-date")
    expect(response?.status).toBe(400)
    await expect(response?.json()).resolves.toEqual({
      error: "lastAccessAt must be YYYY-MM-DD",
    })
  })

  it("rejects a future date", async () => {
    const response = validateLastAccessAt("2099-01-01")
    expect(response?.status).toBe(400)
    await expect(response?.json()).resolves.toEqual({
      error: "Last login date cannot be in the future",
    })
  })
})
